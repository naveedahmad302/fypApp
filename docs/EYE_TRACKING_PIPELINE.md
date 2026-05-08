# Eye Tracking Pipeline

Complete reference for the v2 ASD eye-tracking inference pipeline as of
PR-H. Documents every transformation between raw camera frames and the
final ``P(ASD)`` value the trained model produces.

The trained model (`backend/app/models/eye_model_v1/`) is a 14-feature
MLP fit on real eye-tracker hardware data. Inference uses a webcam +
MediaPipe, so the pipeline's job is to take noisy webcam landmarks and
deliver a 14-vector that closely resembles the trained-distribution
input. Every stage below contributes to that goal.

```
┌──────────────────┐
│ frontend         │  base64 JPEG/PNG frames + per-frame metadata
│ (RN + Vision     │
│  Camera)         │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│ backend: routers/assessment.py: /api/assessment/eye-tracking     │
│  · payload caps + magic-byte upload validation                   │
│  · ownership = verified Firebase UID                             │
└────────┬─────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│ services/eye_tracking_v2/pipeline.extract_feature_matrix         │
│  (per-frame; emits an (N, 14) matrix in FEATURE_ORDER)           │
│                                                                  │
│   1. JPEG → np.ndarray HxWx3                                     │
│   2. mediapipe_adapter.run_face_mesh                             │
│        → 478 normalized landmarks per frame                      │
│   3. mediapipe_adapter.landmarks_to_feature_vector               │
│        → coordinate transforms (see §2)                          │
│        → iris-size monocular depth photogrammetry (§3, PR-H)     │
│        → 14-vector in FEATURE_ORDER (§1)                         │
│   4. validation.validate_feature_vector → range/NaN guard        │
└────────┬─────────────────────────────────────────────────────────┘
         │  (N, 14) raw feature matrix
         ▼
┌──────────────────────────────────────────────────────────────────┐
│ smoothing.apply_temporal_stabilisation (§4, PR-H)                │
│  · Hampel-style outlier rejection (median + MAD)                 │
│  · first-order EMA (alpha=0.35; ~5-frame window @30fps)          │
│  · forward-fill of dropped rows (preserves N)                    │
└────────┬─────────────────────────────────────────────────────────┘
         │  (N, 14) smoothed
         ▼
┌──────────────────────────────────────────────────────────────────┐
│ calibration.apply_calibration_to_loaded_model (§5, PR-H)         │
│  · loads per-user CalibrationProfile from SQLite                 │
│  · swaps model.mediapipe_stats with user-fitted mean/std         │
│  · no-op when user has not calibrated                            │
└────────┬─────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│ model_runner.run_inference                                       │
│  · preprocessing: trained_scaler | online_standardize |          │
│    domain_adapt   (default: domain_adapt; PR-G + PR-H)           │
│  · estimator.predict_proba                                       │
│  · per-frame mean → ASD probability                              │
└────────┬─────────────────────────────────────────────────────────┘
         │
         ▼
   EyeTrackingResponse  (asd_risk_score, confidence, frame_log)
```

Each numbered section below corresponds to a stage in the diagram.

---

## 1. The 14-feature schema (FEATURE_ORDER)

The trained MLP expects this order **exactly**. Changing it would
silently invalidate every prediction. The constant lives in
`backend/app/services/eye_tracking_v2/config.py:FEATURE_ORDER` and is
asserted in tests.

| Idx | Name                  | Unit | Source                                  |
|-----|-----------------------|------|-----------------------------------------|
| 0   | eye_pos_right_x_mm    | mm   | IPD-scaled outer/inner eye corner mid   |
| 1   | eye_pos_right_y_mm    | mm   | "                                       |
| 2   | eye_pos_right_z_mm    | mm   | iris-size photogrammetry (§3)           |
| 3   | eye_pos_left_x_mm     | mm   | IPD-scaled (mirrored)                   |
| 4   | eye_pos_left_y_mm     | mm   | "                                       |
| 5   | eye_pos_left_z_mm     | mm   | iris-size photogrammetry (§3)           |
| 6   | pupil_right_x_px      | px   | iris cluster centroid in image px       |
| 7   | pupil_right_y_px      | px   | "                                       |
| 8   | pupil_left_x_px       | px   | "                                       |
| 9   | pupil_left_y_px       | px   | "                                       |
| 10  | por_right_x_px        | px   | gaze ray cast onto screen (`por_gain_*`)|
| 11  | por_right_y_px        | px   | "                                       |
| 12  | por_left_x_px         | px   | "                                       |
| 13  | por_left_y_px         | px   | "                                       |

Validator (`validation.py`) enforces shape (N, 14), finiteness, and a
generous physiological range per feature.

---

## 2. Coordinate transforms

Source data: MediaPipe Face Mesh emits landmarks in **normalized image
coordinates** (`x, y ∈ [0, 1]`, origin top-left, +x right, +y down).
Three transforms convert this into the trained-distribution units.

### 2a. Normalised → image pixels

```
px = norm * frame_w
py = norm * frame_h
```

Used directly for pupil and PoR (px features 6–13).

### 2b. Image pixels → mm (IPD scaling)

We don't know the user's true mm-scale eye position from a single
camera, so we anchor on the **inter-pupillary distance** (IPD ≈ 63 mm,
adult population mean). Steps:

1. Compute the inter-eye distance in normalised units between the inner
   eye corners.
2. Define `mm_per_unit = ipd_mm / inter_eye_norm`.
3. Multiply normalised offsets from the head centre by `mm_per_unit`
   to get mm-scale (X, Y) for each eye.

This collapses individual differences in head size into the trained
model's distribution. Per-user calibration (§5) refines this further.

### 2c. PoR (Point of Regard)

The trained model includes a 2-D screen-space gaze point per eye. We
estimate it by projecting the gaze direction onto the screen plane.
Gaze direction = vector from eye centre to iris centre, scaled by
`por_gain_x` and `por_gain_y` (see `AdapterConfig`). Calibration
overrides these gains for per-user accuracy.

---

## 3. Z (depth) — iris-size monocular photogrammetry (PR-H)

**Why we changed it.** MediaPipe's relative-depth channel produces a
near-constant Z that the trained model never learned to use, so the
trained ASD decision boundary along Z was effectively dead.

**What we do now.** The horizontal iris diameter has very low
inter-individual variation (11.7 ± 0.5 mm in adults). We can therefore
treat it as a known reference length and back out distance:

```
Z_mm  =  focal_length_px  ×  iris_diameter_mm  /  iris_diameter_px
```

Implementation lives in
`mediapipe_adapter.landmarks_to_feature_vector` step 2a:

* `iris_diameter_px` = max pairwise distance among the 5 iris landmarks
  per eye (idx 468–472 left, 473–477 right) projected to image
  pixels.
* `focal_length_px` defaults to `frame_w` (≈70° HFOV phone front
  camera). Set explicitly in `AdapterConfig.focal_length_px` when the
  device is known.
* `iris_diameter_mm` = `AdapterConfig.iris_diameter_mm` (default 11.7).
* Z is clipped to `[depth_min_mm, depth_max_mm]` (default
  100–1500 mm). Out-of-window values usually mean iris occlusion or a
  degenerate frame; the validator's range guard catches the rest.

Each eye gets its own Z (head yaw makes them differ slightly).

---

## 4. Temporal stabilisation (PR-H)

Module: `eye_tracking_v2/smoothing.py`.

Two stages over the (N, 14) matrix:

### 4a. Outlier rejection

Hampel-style filter using the per-feature **median + median absolute
deviation** (MAD):

```
σ_robust = MAD * 1.4826
z[i, j] = |x[i, j] - median[j]| / σ_robust[j]
drop row i  ⇔  any j such that z[i, j] > outlier_z   (default 3.0)
```

Blink rows get caught here because per-eye Y, pupil Y, and iris
diameter all spike together. When MAD collapses to zero on a tiny
batch we fall back to a generous mean+std rule
(`SmoothingConfig.fallback_std_z`).

Below `min_samples_for_outlier` the rejector is skipped — MAD is too
noisy on tiny samples.

### 4b. EMA + forward-fill

First-order IIR:

```
y[k] = alpha * x[k] + (1 - alpha) * y[k-1]    (alpha = 0.35)
```

Outlier rows are forward-filled from the last good `y` so the matrix
stays length-N (downstream confidence weighting expects a stable
frame count).

---

## 5. Per-user calibration (PR-H)

Modules:
* `eye_tracking_v2/calibration.py` — profile dataclass + builder
* `services/calibration_store.py` — SQLite persistence
* `routers/assessment.py` — HTTP API

### Why

The global `mediapipe_stats.npz` (PR-G) is the *average* MediaPipe
distribution from a synthetic representative sample. Real users vary
in IPD, eye shape, head pose habits, and camera focal length. With a
calibration profile we replace the global mean/std with the **user's
own** mean/std before domain_adapt, so the affine map lands the
user's vectors in the trained distribution far more tightly.

### Capture flow

1. UI asks the user to look at five screen targets (centre + four
   cardinals). For each, capture ~1 s of frames.
2. Run the same `extract_feature_matrix` pipeline on the captured
   frames to get per-direction batches of 14-vectors.
3. Send all batches to `POST /api/assessment/calibration` (one
   `samples` group per direction).
4. Server computes pooled mean / std per feature, stores it in SQLite
   keyed by the verified Firebase UID.
5. Subsequent inferences for this user read the profile and pass it
   to `apply_calibration_to_loaded_model` before `run_inference`.

### Endpoints

| Method | Path                              | Behaviour |
|--------|-----------------------------------|-----------|
| POST   | `/api/assessment/calibration`     | Build + upsert. 200 on success. |
| GET    | `/api/assessment/calibration`     | `{has_calibration, profile?}`. |
| DELETE | `/api/assessment/calibration`     | 204 on success. |

All require a valid Firebase ID token; the UID is the storage key.

### Validation

`MIN_CALIBRATION_FRAMES = 30` total across all directions; below this
the per-feature std is too noisy to trust. Per-feature std is floored
at `MIN_CALIBRATION_STD = 1e-3` to avoid divide-by-zero in
`domain_adapt`. Schema-version mismatches (e.g. on an upgrade that
changes `FEATURE_ORDER`) are silently discarded so the user falls
back to the global stats rather than crashing.

---

## 6. Preprocessing modes (PR-G + PR-H + PR-I)

`EYE_TRACKING_PREPROC` env var — default `domain_adapt_self` (PR-I):

| Mode | Transform applied to (N, 14) before estimator |
|------|------------------------------------------------|
| `trained_scaler`     | `(x − scaler.mean_) / scaler.scale_` directly. Saturates because scaler was fit on hardware-eye-tracker data, not MediaPipe. Kept as a baseline / for reproducibility. |
| `online_standardize` | Per-batch z-score (own mean/std). Always responsive but uses the model's decision boundary on a different distribution than training. |
| `domain_adapt`       | Affine `(x − mp_mean) / mp_std × trained_std + trained_mean` then trained_scaler, where `mp_mean / mp_std` come from the global `mediapipe_stats.npz` artefact. PR-H's saved per-user profile (§5) overrides the global stats when present. |
| `domain_adapt_self`  | Same composition as `domain_adapt`, but `mp_mean / mp_std` are computed **from the current session itself**. Implicit per-user calibration with no UI step. **Default since PR-I.** Falls back to `domain_adapt` for batches < 2 frames; falls back to `online_standardize` if `scaler.pkl` is absent. |

### Why `domain_adapt_self` is the default

The target audience for this screening flow is 4–9 yr olds, who
cannot follow a multi-step calibration UI. `domain_adapt_self`
computes the per-user shift+scale from the same camera capture used
for prediction, which means every session is implicitly calibrated
against its own input distribution before the trained decision
boundary is applied — no extra UI step, no kid cooperation required.

Mathematically this is "online_standardize that respects the trained
decision boundary":

```
z       = (x − x.mean(0)) / x.std(0)         # per-batch z
aligned = z × scaler.scale_ + scaler.mean_   # rescale to trained
result  = scaler.transform(aligned)          # then trained scaler
```

The composition recovers the trained-distribution geometry and leaves
the model's decision boundary meaningful while removing the bias from
the global synthetic stats.

---

## 7. Inference

`run_inference(model, matrix, preprocessing_mode)`:

1. Apply the preprocessing mode (above).
2. `model.estimator.predict_proba(X)` → (N, 2) matrix of class
   probabilities.
3. ASD probability = mean of column 1 across all rows.
4. Confidence = mean of `max(p_neg, p_pos)` across rows.
5. Return `InferenceResult(asd_probability, confidence,
   n_frames_used)`.

The trained estimator is a Keras MLP loaded from
`autism_model_weights.npz` (Dense 14 → 128 → 64 → 2 softmax). The
weights are extracted from the original `.h5` via
`scripts/convert_keras_h5_to_npz.py` to keep TensorFlow out of
production runtime.

---

## 8. Frame metadata + assessment record

Each call writes an `assessments` row (status `completed | failed`)
keyed by the verified UID. The full per-frame log is included in the
response (`frame_log`) and rendered by the React Native UI.

The `model_features` payload reports the post-smoothing (N, 14)
matrix (capped to `MAX_PER_FRAME_FEATURES_RETURNED` rows for response
size) so the frontend can plot the actual numbers fed to the model.

---

## 9. What this pipeline does NOT do

* **Retrain the trained MLP.** The artefact is fixed; PR-G and PR-H
  improve the *input* the model sees.
* **Mm-true gaze tracking.** Webcam + MediaPipe will never match a
  hardware eye-tracker. We approximate; calibration plus iris-size
  depth get us as close as a single front camera allows.
* **3-D head pose correction.** Eye Y stability under head pitch is
  not yet decoupled. A future PR could add a SolvePnP-based head pose
  rotation before the IPD scaling.

---

## Tests

| Test file                                         | Coverage |
|---------------------------------------------------|----------|
| `test_iris_depth_photogrammetry.py`               | §3 — Z accuracy, clamping, per-eye difference |
| `test_temporal_smoothing.py`                      | §4 — outlier reject, EMA identity, NaN/shape guards |
| `test_calibration_profile.py`                     | §5 — profile build, schema round-trip, model swap |
| `test_calibration_endpoint.py`                    | §5 — POST/GET/DELETE, auth isolation, validation |
| `test_domain_adapt_preprocessing.py` (PR-G)       | §6 — domain_adapt vs trained_scaler vs online_standardize |
| `test_domain_adapt_self.py` (PR-I)                | §6 — domain_adapt_self z-score property, invariance, fallbacks |
| `test_eye_tracking_v2_*.py`                       | §1 §2 §7 — adapter, validator, model runner |

Run all backend tests with `cd backend && poetry run pytest`.
