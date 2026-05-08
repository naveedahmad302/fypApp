"""Tests for the per-user calibration profile + store (PR-H)."""

from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import pytest

from app.services.eye_tracking_v2 import calibration as cal_mod
from app.services.eye_tracking_v2.calibration import (
    CALIBRATION_SCHEMA_VERSION,
    CalibrationError,
    CalibrationProfile,
    CalibrationSample,
    apply_calibration_to_loaded_model,
    build_profile_from_samples,
)
from app.services.eye_tracking_v2.config import FEATURE_ORDER
from app.services.eye_tracking_v2.model_runner import (
    LoadedModel,
    MediaPipeStats,
)


def _samples(direction: str, n: int = 20, seed: int = 0) -> CalibrationSample:
    rng = np.random.default_rng(seed)
    return CalibrationSample(
        direction=direction,
        frame_vectors=rng.normal(0.0, 1.0, size=(n, len(FEATURE_ORDER))),
    )


def test_build_profile_concatenates_directions_and_computes_stats():
    samples = [_samples(d, n=10, seed=i)
               for i, d in enumerate(["center", "left", "right", "up", "down"])]
    profile = build_profile_from_samples("user-1", samples)
    assert profile.user_id == "user-1"
    assert profile.schema_version == CALIBRATION_SCHEMA_VERSION
    assert profile.n_samples == 50
    assert profile.feature_mean.shape == (14,)
    assert profile.feature_std.shape == (14,)
    assert (profile.feature_std > 0).all()


def test_build_profile_below_minimum_frames_raises():
    with pytest.raises(CalibrationError):
        build_profile_from_samples("u", [_samples("center", n=5)])


def test_build_profile_rejects_wrong_shape():
    bad = CalibrationSample(direction="center",
                            frame_vectors=np.zeros((10, 7)))  # not 14-wide
    with pytest.raises(CalibrationError):
        build_profile_from_samples(
            "u", [bad, _samples("left", n=30)]
        )


def test_build_profile_rejects_nonfinite():
    arr = np.zeros((40, 14))
    arr[0, 0] = np.nan
    with pytest.raises(CalibrationError):
        build_profile_from_samples(
            "u", [CalibrationSample(direction="center", frame_vectors=arr)]
        )


def test_build_profile_floors_zero_std():
    """Constant column ⇒ floored std (avoid /0 in domain_adapt)."""
    arr = np.zeros((40, 14))  # zero variance
    profile = build_profile_from_samples(
        "u", [CalibrationSample(direction="center", frame_vectors=arr)]
    )
    assert (profile.feature_std >= cal_mod.MIN_CALIBRATION_STD).all()


def test_to_dict_from_dict_round_trips():
    samples = [_samples("center", n=40)]
    p1 = build_profile_from_samples("u", samples)
    blob = p1.to_dict()
    p2 = CalibrationProfile.from_dict(blob)
    assert p2.user_id == p1.user_id
    np.testing.assert_allclose(p2.feature_mean, p1.feature_mean)
    np.testing.assert_allclose(p2.feature_std, p1.feature_std)
    assert p2.schema_version == p1.schema_version


def test_from_dict_rejects_schema_mismatch():
    blob = {
        "user_id": "u",
        "schema_version": CALIBRATION_SCHEMA_VERSION + 99,
        "feature_order": list(FEATURE_ORDER),
        "feature_mean": [0.0] * 14,
        "feature_std": [1.0] * 14,
        "n_samples": 50,
        "captured_at": datetime.now(timezone.utc).isoformat(),
    }
    with pytest.raises(ValueError):
        CalibrationProfile.from_dict(blob)


def test_from_dict_rejects_feature_order_mismatch():
    blob = {
        "user_id": "u",
        "schema_version": CALIBRATION_SCHEMA_VERSION,
        "feature_order": ["wrong"] * 14,
        "feature_mean": [0.0] * 14,
        "feature_std": [1.0] * 14,
        "n_samples": 50,
        "captured_at": datetime.now(timezone.utc).isoformat(),
    }
    with pytest.raises(ValueError):
        CalibrationProfile.from_dict(blob)


def test_apply_calibration_swaps_mediapipe_stats():
    """The returned LoadedModel uses the per-user mean/std, not the global."""

    class _Estimator:
        def predict_proba(self, X):  # pragma: no cover - not called here
            return np.zeros((X.shape[0], 2))

    base = LoadedModel(
        estimator=_Estimator(),
        scaler=None,
        feature_names=FEATURE_ORDER,
        metadata={},
        mediapipe_stats=MediaPipeStats(
            mean=np.full(14, 5.0),
            std=np.full(14, 2.0),
            n=100,
        ),
    )

    profile = build_profile_from_samples("u", [_samples("center", n=40)])
    swapped = apply_calibration_to_loaded_model(base, profile)
    assert swapped is not base
    assert swapped.estimator is base.estimator
    assert swapped.mediapipe_stats is not None
    np.testing.assert_allclose(swapped.mediapipe_stats.mean, profile.feature_mean)
    np.testing.assert_allclose(swapped.mediapipe_stats.std, profile.feature_std)


def test_apply_calibration_with_none_returns_input():
    base = LoadedModel(estimator=object(), feature_names=FEATURE_ORDER)
    out = apply_calibration_to_loaded_model(base, None)
    assert out is base
