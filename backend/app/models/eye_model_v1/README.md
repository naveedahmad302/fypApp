# Eye-tracking model v1

Place the trained model artefacts here. The v2 pipeline (see
`backend/app/services/eye_tracking_v2/`) auto-loads anything it finds.

## Expected files

| File                             | Required | Notes |
|----------------------------------|----------|-------|
| `model.joblib` or `model.pkl`    | yes      | sklearn estimator (or anything with `predict_proba` / `decision_function` / `predict`) |
| `scaler.joblib` or `scaler.pkl`  | optional | Applied with `scaler.transform(X)` before inference |
| `feature_names.json`             | optional | List of 14 strings; cross-checked against the adapter |
| `metadata.json`                  | optional | Free-form dict, surfaced into inference output |

## Feature schema (canonical, do NOT reorder)

The adapter (`mediapipe_adapter.py`) emits columns in **exactly** this order:

```
0  eye_pos_right_x_mm
1  eye_pos_right_y_mm
2  eye_pos_right_z_mm
3  eye_pos_left_x_mm
4  eye_pos_left_y_mm
5  eye_pos_left_z_mm
6  pupil_right_x_px
7  pupil_right_y_px
8  pupil_left_x_px
9  pupil_left_y_px
10 por_right_x_px
11 por_right_y_px
12 por_left_x_px
13 por_left_y_px
```

If the trained model expects a different column order, write the order it
expects into `feature_names.json` — the loader will warn loudly when the
expected order disagrees with the adapter.

## Class index

If the trained label encoding is ASD = 0 / control = 1 (i.e. the model
returns the **probability of control** at column 1), set
`metadata.json` to `{"positive_class_index": 0}` so the runner inverts
the probability to mean "ASD likelihood".

## Selecting the backend at runtime

| Env var                          | Effect |
|----------------------------------|--------|
| `EYE_TRACKING_BACKEND=new_model` | (default) Use the trained model. Falls back to legacy MediaPipe on missing artefact. |
| `EYE_TRACKING_BACKEND=legacy_mediapipe` | Force the original 8-dimensional behavioural pipeline. |
