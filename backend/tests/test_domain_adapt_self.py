"""Tests for the ``domain_adapt_self`` preprocessing mode (PR-I).

The mode computes per-session shift+scale from the *current* batch and
then applies the trained scaler. This serves as implicit per-user
calibration for screening flows where an explicit calibration step
(e.g. multi-direction look-at) is impractical (the target audience is
4-9 yr olds who cannot follow such a flow).
"""

from __future__ import annotations

import math

import numpy as np

from app.services.eye_tracking_v2.config import (
    DEFAULT_PREPROCESSING_MODE,
    _VALID_PREPROCESSING_MODES,
)
from app.services.eye_tracking_v2.model_runner import (
    LoadedModel,
    MediaPipeStats,
    preprocess_matrix,
)


class _StubScaler:
    """Minimal sklearn-compatible scaler for unit tests.

    Mirrors the ``mean_`` / ``scale_`` attributes the real
    StandardScaler exposes and provides a deterministic ``transform``.
    """

    def __init__(self, mean: np.ndarray, scale: np.ndarray):
        self.mean_ = np.asarray(mean, dtype=np.float64)
        self.scale_ = np.asarray(scale, dtype=np.float64)

    def transform(self, X: np.ndarray) -> np.ndarray:
        return (np.asarray(X, dtype=np.float64) - self.mean_) / self.scale_


def _model(scaler: _StubScaler | None, *, with_global_stats: bool = True) -> LoadedModel:
    stats = None
    if with_global_stats:
        stats = MediaPipeStats(
            mean=np.full(14, 999.0),
            std=np.full(14, 7.0),
            n=100,
        )
    return LoadedModel(estimator=object(), scaler=scaler, mediapipe_stats=stats)


def _trained_scaler() -> _StubScaler:
    """Distinct trained mean/std so the rescale is observable."""
    return _StubScaler(
        mean=np.linspace(10.0, 24.0, 14),
        scale=np.linspace(2.0, 4.6, 14),
    )


# ---------------------------------------------------------------------------
# Default registration
# ---------------------------------------------------------------------------
def test_domain_adapt_self_is_registered_and_default():
    """The new mode must be in the valid set AND be the default."""
    assert "domain_adapt_self" in _VALID_PREPROCESSING_MODES
    assert DEFAULT_PREPROCESSING_MODE == "domain_adapt_self"


# ---------------------------------------------------------------------------
# Math: composition with the trained scaler
# ---------------------------------------------------------------------------
def test_self_calibration_is_zero_centred_per_feature():
    """After domain_adapt_self the per-feature mean must be ~0.

    Mathematically: ``aligned = z * trained_std + trained_mean`` then
    ``scaler.transform(aligned) = (aligned - trained_mean) / trained_std =
    z`` — so the output is the per-batch z-score regardless of the
    trained scaler values. The composition recovers a centred batch.
    """
    rng = np.random.default_rng(0)
    # Realistic spread per feature so std is well-defined.
    matrix = rng.normal(loc=500.0, scale=50.0, size=(64, 14))

    scaler = _trained_scaler()
    out = preprocess_matrix(_model(scaler), matrix, mode="domain_adapt_self")

    np.testing.assert_allclose(out.mean(axis=0), np.zeros(14), atol=1e-9)
    np.testing.assert_allclose(out.std(axis=0), np.ones(14), atol=1e-9)


def test_self_calibration_is_invariant_to_input_shift_and_scale():
    """A linear transform of the input must produce the same z-score.

    Since each user's MediaPipe distribution differs by an affine
    factor (shift + scale) from any other user's, the post-mode
    output should be identical for two batches that differ only by
    such a transform.
    """
    rng = np.random.default_rng(1)
    base = rng.normal(loc=0.0, scale=1.0, size=(50, 14))

    user_a = base * 3.0 + 100.0
    user_b = base * 7.5 - 250.0

    scaler = _trained_scaler()
    out_a = preprocess_matrix(_model(scaler), user_a, mode="domain_adapt_self")
    out_b = preprocess_matrix(_model(scaler), user_b, mode="domain_adapt_self")

    np.testing.assert_allclose(out_a, out_b, atol=1e-9)


def test_self_calibration_independent_of_global_stats():
    """``mediapipe_stats`` must NOT influence the result.

    The whole point of self-calibration is to use the session's own
    distribution. The output should be identical whether or not the
    global stats artefact is present.
    """
    rng = np.random.default_rng(2)
    matrix = rng.normal(loc=42.0, scale=10.0, size=(20, 14))

    scaler = _trained_scaler()
    out_with = preprocess_matrix(_model(scaler, with_global_stats=True), matrix, mode="domain_adapt_self")
    out_without = preprocess_matrix(_model(scaler, with_global_stats=False), matrix, mode="domain_adapt_self")

    np.testing.assert_allclose(out_with, out_without, atol=1e-12)


# ---------------------------------------------------------------------------
# Edge cases / fallbacks
# ---------------------------------------------------------------------------
def test_self_calibration_floors_zero_std_columns():
    """A constant-column input must not divide by zero.

    The mode should floor near-zero std at 1e-3 (matches
    MIN_CALIBRATION_STD). The result for the constant column is
    finite — exact numeric value is implementation detail; we just
    check finiteness and that other columns are still z-scored.
    """
    rng = np.random.default_rng(3)
    matrix = rng.normal(loc=0.0, scale=1.0, size=(20, 14))
    matrix[:, 5] = 7.0  # constant column

    scaler = _trained_scaler()
    out = preprocess_matrix(_model(scaler), matrix, mode="domain_adapt_self")

    assert np.isfinite(out).all()
    # Every non-constant column should be z-scored to ~0 mean.
    keep = list(range(14))
    keep.remove(5)
    np.testing.assert_allclose(out[:, keep].mean(axis=0), np.zeros(13), atol=1e-9)


def test_single_frame_falls_back_to_global_domain_adapt():
    """With a 1-row batch we cannot compute std → fall back."""
    matrix = np.full((1, 14), 250.0)

    scaler = _trained_scaler()
    out = preprocess_matrix(_model(scaler), matrix, mode="domain_adapt_self")

    # Same row should not blow up to NaN/inf, must be finite.
    assert out.shape == (1, 14)
    assert np.isfinite(out).all()


def test_missing_scaler_falls_back_to_online_standardize():
    """If ``scaler.pkl`` is absent the mode degrades gracefully."""
    rng = np.random.default_rng(4)
    matrix = rng.normal(loc=10.0, scale=2.0, size=(8, 14))

    out = preprocess_matrix(
        _model(scaler=None, with_global_stats=False),
        matrix,
        mode="domain_adapt_self",
    )

    # online_standardize is per-batch z-score → mean ≈ 0, std ≈ 1.
    np.testing.assert_allclose(out.mean(axis=0), np.zeros(14), atol=1e-9)
    np.testing.assert_allclose(out.std(axis=0), np.ones(14), atol=1e-9)


# ---------------------------------------------------------------------------
# Behavioural contrast vs the other modes
# ---------------------------------------------------------------------------
def test_self_calibration_differs_from_global_domain_adapt():
    """Self vs global must produce *different* outputs for typical input.

    If they were identical there'd be no point in adding the new mode.
    """
    rng = np.random.default_rng(5)
    matrix = rng.normal(loc=600.0, scale=30.0, size=(24, 14))

    scaler = _trained_scaler()
    model = _model(scaler)

    out_self = preprocess_matrix(model, matrix, mode="domain_adapt_self")
    out_global = preprocess_matrix(model, matrix, mode="domain_adapt")

    diff = float(np.linalg.norm(out_self - out_global))
    assert math.isfinite(diff)
    assert diff > 1e-3
