# Eye-tracking model v1 (trained Keras MLP, NumPy port)

This directory ships the trained eye-tracking model that powers the v2
pipeline (`backend/app/services/eye_tracking_v2/`).

## Files in this directory

| File | Purpose |
|---|---|
| `autism_model_weights.npz` | NumPy-extracted weights of the trained Keras MLP. Loaded at runtime via `keras_mlp.py` — no TensorFlow / Keras dependency. |
| `scaler.pkl` | sklearn `StandardScaler` fitted on the original eye-tracker training data. Optional at runtime; only used when `EYE_TRACKING_PREPROC=trained_scaler`. |
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

The pipeline therefore defaults to:

```
EYE_TRACKING_PREPROC=online_standardize
```

which z-scores each request's batch using its own per-column mean/std.
This keeps the MLP's input statistics close to the (zero-mean,
unit-variance) regime it was trained on, regardless of camera or
screen geometry.

You can switch back to the device-trained scaler with:

```
EYE_TRACKING_PREPROC=trained_scaler
```

— useful only when wiring in a real eye-tracker that produces
hardware-equivalent values.

## Selecting the backend at runtime

| Env var | Effect |
|---|---|
| `EYE_TRACKING_BACKEND=new_model` (default) | Use the trained MLP. Falls back to legacy MediaPipe behavioural pipeline if any artefact is missing. |
| `EYE_TRACKING_BACKEND=legacy_mediapipe` | Force the original 8-dimensional behavioural pipeline. |
| `EYE_TRACKING_PREPROC=online_standardize` (default) | Z-score per batch. Recommended for MediaPipe-fed inputs. |
| `EYE_TRACKING_PREPROC=trained_scaler` | Apply the saved StandardScaler. |
| `EYE_TRACKING_PREPROC=none` | Pass raw values straight to the MLP (debug only). |
