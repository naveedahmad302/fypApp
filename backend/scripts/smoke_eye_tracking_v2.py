"""Offline smoke test for the v2 eye-tracking pipeline.

Runs three checks without requiring a real webcam:

1. Adapter sanity — fabricate a minimal Face Mesh-shaped landmark list
   and verify ``landmarks_to_feature_vector`` returns a 14-vector with
   the documented unit conventions (mm for eye position, px for pupil
   and PoR).

2. Validation — confirm ``validate_feature_vector`` rejects bad shapes
   and NaN payloads.

3. Inference fallback — call ``run_inference`` with a stub estimator to
   exercise the scaler / probability aggregation path without touching
   the disk.

Run from the repo root::

    python -m backend.scripts.smoke_eye_tracking_v2
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from types import SimpleNamespace

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

logging.basicConfig(level=logging.INFO, format="%(name)s | %(message)s")
log = logging.getLogger("smoke")

from backend.app.services.eye_tracking_v2 import (  # noqa: E402
    DEFAULT_ADAPTER_CONFIG,
    FEATURE_ORDER,
    FeatureValidationError,
    LoadedModel,
    feature_vector_dict,
    landmarks_to_feature_vector,
    run_inference,
    validate_feature_matrix,
    validate_feature_vector,
)


def _fake_landmarks() -> list[SimpleNamespace]:
    """Construct 478 landmarks with realistic relative positions."""
    pts = [SimpleNamespace(x=0.5, y=0.5, z=0.0) for _ in range(478)]
    # Eye corners (anatomical convention; image-left = user's right).
    # Right outer (33), right inner (133)
    pts[33] = SimpleNamespace(x=0.40, y=0.45, z=-0.02)
    pts[133] = SimpleNamespace(x=0.46, y=0.45, z=-0.02)
    # Left inner (362), left outer (263)
    pts[362] = SimpleNamespace(x=0.54, y=0.45, z=-0.02)
    pts[263] = SimpleNamespace(x=0.60, y=0.45, z=-0.02)
    # Iris (5 pts each). Right iris cluster around 0.43, left around 0.57.
    for i in (468, 469, 470, 471, 472):
        pts[i] = SimpleNamespace(x=0.57, y=0.45, z=-0.02)  # user's left iris
    for i in (473, 474, 475, 476, 477):
        pts[i] = SimpleNamespace(x=0.43, y=0.45, z=-0.02)  # user's right iris
    return pts


def check_adapter() -> np.ndarray:
    log.info("== adapter check ==")
    landmarks = _fake_landmarks()
    fv = landmarks_to_feature_vector(
        landmarks, frame_w=640, frame_h=480, frame_index=0,
        config=DEFAULT_ADAPTER_CONFIG,
    )
    assert fv is not None, "adapter returned None on valid landmarks"
    assert fv.values.shape == (14,)
    d = feature_vector_dict(fv.values)
    log.info("feature vector:")
    for k, v in d.items():
        log.info("  %-22s %.3f", k, v)
    # Spot-checks: pupil positions should land near the iris pixel coords.
    assert 270 < d["pupil_right_x_px"] < 280, d["pupil_right_x_px"]
    assert 360 < d["pupil_left_x_px"] < 370, d["pupil_left_x_px"]
    # Eye positions should be roughly +/- 30 mm horizontally given IPD=63.
    assert d["eye_pos_right_x_mm"] < d["eye_pos_left_x_mm"]
    return fv.values


def check_validation(vec: np.ndarray) -> None:
    log.info("== validation check ==")
    validate_feature_vector(vec, feature_names=FEATURE_ORDER)
    bad = vec.copy()
    bad[0] = np.nan
    try:
        validate_feature_vector(bad)
    except FeatureValidationError as exc:
        log.info("rejected NaN as expected: %s", exc)
    else:
        raise AssertionError("validator failed to reject NaN")
    # Wrong shape.
    try:
        validate_feature_vector(np.zeros(13))
    except FeatureValidationError:
        log.info("rejected wrong shape as expected")
    else:
        raise AssertionError("validator failed to reject wrong shape")


class _StubEstimator:
    def predict_proba(self, X):
        # Return an obvious 0.7 ASD probability regardless of input.
        return np.tile([[0.3, 0.7]], (X.shape[0], 1))


def check_inference(vec: np.ndarray) -> None:
    log.info("== inference check ==")
    matrix = np.tile(vec, (5, 1))
    cleaned = validate_feature_matrix(matrix, feature_names=FEATURE_ORDER)
    assert cleaned.shape == (5, 14)
    model = LoadedModel(estimator=_StubEstimator())
    result = run_inference(model, cleaned)
    log.info(
        "inference result: prob=%.3f confidence=%.3f n=%d",
        result.asd_probability,
        result.confidence,
        result.n_frames_used,
    )
    assert abs(result.asd_probability - 0.7) < 1e-6
    assert 0.0 <= result.confidence <= 1.0
    assert result.n_frames_used == 5


def check_real_model(vec: np.ndarray) -> None:
    """If the real artefact is present, run a probability sanity check.

    Skipped silently when artefacts are missing so the smoke test still
    runs in CI / fresh checkouts.
    """
    log.info("== real-model check ==")
    from backend.app.services.eye_tracking_v2 import (
        load_model,
        run_inference,
    )
    from backend.app.services.eye_tracking_v2.config import MODEL_ROOT

    try:
        model = load_model(MODEL_ROOT)
    except FileNotFoundError as exc:
        log.info("skipped (artefact missing): %s", exc)
        return

    log.info("loaded %s", model.artefact_path.name)
    # Build a 5-frame batch with slight per-frame variation.
    batch = np.tile(vec, (5, 1)).astype(np.float64)
    batch[:, 6] += np.linspace(-2.0, 2.0, 5)  # nudge pupil_right_x_px

    online = run_inference(model, batch, preprocessing_mode="online_standardize")
    log.info(
        "online_standardize: P(ASD)=%.3f confidence=%.3f n=%d",
        online.asd_probability,
        online.confidence,
        online.n_frames_used,
    )
    assert 0.0 <= online.asd_probability <= 1.0


def main() -> int:
    vec = check_adapter()
    check_validation(vec)
    check_inference(vec)
    check_real_model(vec)
    log.info("all v2 smoke checks passed")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
