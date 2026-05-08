# Eye-tracking model v1 (trained Keras MLP, NumPy port)

This directory ships the trained eye-tracking model that powers the v2
pipeline (`backend/app/services/eye_tracking_v2/`).

## Files in this directory

| File | Purpose |
|---|---|
| `autism_model_weights.npz` | NumPy-extracted weights of the trained Keras MLP. Loaded at runtime via `keras_mlp.py` — no TensorFlow / Keras dependency. |
| `scaler.pkl` | sklearn `StandardScaler` fitted on the original eye-tracker training data. Used by both `EYE_TRACKING_PREPROC=trained_scaler` and `EYE_TRACKING_PREPROC=domain_adapt`. |
| `mediapipe_stats.npz` | Per-feature mean/std of the MediaPipe-derived input distribution. Used by `EYE_TRACKING_PREPROC=domain_adapt` to bridge to the trained scale. Rebuild via `python -m backend.scripts.build_mediapipe_stats`. |
| `label_encoder.pkl` | sklearn `LabelEncoder`. Reference only — the class index mapping is also in `metadata.json`. |
| `metadata.json` | Class index, feature names, training-distribution notes. |

## Architecture

```
Input(14)
  ↓ Dense(128, ReLU)
  ↓ Dropout(0.2)        # inactive at inference
  ↓ Dense(64, ReLU)
  ↓ Dropout(0.2)        # inactive at inference
  ↓ Dense(2, Softmax)   # [P(ASD), P(Neurotypical)]
```

Loss: `sparse_categorical_crossentropy`, optimiser: Adam(1e-3),
trained with EarlyStopping(patience=3).

`label_encoder.classes_ = ['ASD', 'Neurotypical']` ⇒ column 0 is the
ASD probability (`positive_class_index = 0` in `metadata.json`).

## Feature schema (canonical, must NOT reorder)

```
0  Eye Position Right X [mm]
1  Eye Position Right Y [mm]
2  Eye Position Right Z [mm]
3  Eye Position Left  X [mm]
4  Eye Position Left  Y [mm]
5  Eye Position Left  Z [mm]
6  Pupil Position Right X [px]
7  Pupil Position Right Y [px]
8  Pupil Position Left  X [px]
9  Pupil Position Left  Y [px]
10 Point of Regard Right X [px]
11 Point of Regard Right Y [px]
12 Point of Regard Left  X [px]
13 Point of Regard Left  Y [px]
```

## Re-generating `autism_model_weights.npz`

If you re-train the network, run:

```bash
python backend/scripts/convert_keras_h5_to_npz.py \
  --src path/to/autism_model.h5 \
  --dst backend/app/models/eye_model_v1/autism_model_weights.npz
```

The script uses `h5py` only — no TensorFlow runtime needed.

## Important — distribution mismatch

The `scaler.pkl` shipped here was fit on a **real eye-tracker dataset**
(viewing distance ≈ 510 mm, sensor-coordinate pupil/PoR pixel ranges).
This backend feeds the model 14-vectors **approximated from a webcam
via MediaPipe** — the absolute scale of those approximations is very
different. Applying the trained scaler to webcam data places inputs
several σ outside the training distribution, which collapses the
softmax output toward a degenerate value.

The pipeline therefore defaults to (PR-G):

```
EYE_TRACKING_PREPROC=domain_adapt
```

which applies a per-feature affine map

```
x_aligned = (x_raw - mp_mean) / mp_std * trained_std + trained_mean
```

before the trained scaler. The MediaPipe stats `(mp_mean, mp_std)` come
from `mediapipe_stats.npz` shipped in this directory and are sampled
over a broad, plausible head-pose distribution — see
`backend/scripts/build_mediapipe_stats.py`. The aligned input lives in
the same space the MLP saw at training time, so the trained decision
boundary is meaningful again.

Fallback chain when `domain_adapt` is selected but stats / scaler are
missing: a warning is logged and the system degrades to
`online_standardize` rather than producing silently wrong outputs.

The earlier workaround `EYE_TRACKING_PREPROC=online_standardize`
(per-batch z-score) is still available; use it only when the trained
decision boundary is not trusted on a particular input.

You can switch to the device-trained scaler directly with:

```
EYE_TRACKING_PREPROC=trained_scaler
```

— useful only when wiring in a real eye-tracker that produces
hardware-equivalent values; saturates at P(ASD) ≈ 1.0 on MediaPipe
inputs.

## Selecting the backend at runtime

| Env var | Effect |
|---|---|
| `EYE_TRACKING_BACKEND=new_model` (default) | Use the trained MLP. Falls back to legacy MediaPipe behavioural pipeline if any artefact is missing. |
| `EYE_TRACKING_BACKEND=legacy_mediapipe` | Force the original 8-dimensional behavioural pipeline. |
| `EYE_TRACKING_PREPROC=domain_adapt_self` (default since PR-I) | Per-session "self" calibration: `mp_mean / mp_std` come from the current batch, then the trained scaler. Implicit per-user calibration with no UI step. |
| `EYE_TRACKING_PREPROC=domain_adapt` | Same affine but using the global `mediapipe_stats.npz`. |
| `EYE_TRACKING_PREPROC=online_standardize` | Per-batch z-score (legacy workaround for MediaPipe inputs). |
| `EYE_TRACKING_PREPROC=trained_scaler` | Apply the saved StandardScaler directly (real eye-tracker hardware only). |
| `EYE_TRACKING_PREPROC=none` | Pass raw values straight to the MLP (debug only). |
