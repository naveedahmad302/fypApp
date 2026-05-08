"""Tests for the ``domain_adapt`` preprocessing mode (PR-G).

The mode exists to bridge the distribution gap between the trained
eye-tracker data the MLP was fit on and the MediaPipe approximations
this backend actually receives. Tests cover:

* identity behaviour when MediaPipe stats coincide with trained stats
* the mathematical contract (per-feature affine, then trained scaler)
* graceful fallback to ``online_standardize`` when stats are missing
* refusal to silently produce wrong values when the scaler is missing
* loading of ``mediapipe_stats.npz`` from disk
* on the real shipped artefact, P(ASD) is finite and bounded
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("ASD_AUTH_TEST_MODE", "true")

from app.services.eye_tracking_v2 import (  # noqa: E402
    FEATURE_ORDER,
    LoadedModel,
    MediaPipeStats,
    preprocess_matrix,
    run_inference,
)
from app.services.eye_tracking_v2.config import MODEL_ROOT  # noqa: E402
from app.services.eye_tracking_v2.model_runner import (  # noqa: E402
    _load_mediapipe_stats,
    load_model,
)
from app.services.eye_tracking_v2.validation import (  # noqa: E402
    FeatureValidationError,
)


# ---------------------------------------------------------------------------
# Helpers — small in-memory fakes so unit tests don't need the real
# trained artefacts on disk.
# ---------------------------------------------------------------------------
class _DummyScaler:
    """Pure-Python stand-in for sklearn StandardScaler."""

    def __init__(self, mean: np.ndarray, scale: np.ndarray) -> None:
        self.mean_ = np.asarray(mean, dtype=np.float64)
        self.scale_ = np.asarray(scale, dtype=np.float64)

    def transform(self, X: np.ndarray) -> np.ndarray:
        return (np.asarray(X, dtype=np.float64) - self.mean_) / self.scale_


class _IdentityEstimator:
    """Stub estimator: probability is just the magnitude of the input."""

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        # Pure shape passthrough — used to verify run_inference plumbing.
        n = X.shape[0]
        return np.tile([[0.4, 0.6]], (n, 1))


def _model_with(
    mp_mean: np.ndarray | None,
    mp_std: np.ndarray | None,
    scaler_mean: np.ndarray | None,
    scaler_std: np.ndarray | None,
) -> LoadedModel:
    """Build a LoadedModel with optional scaler / MediaPipe stats."""
    scaler: Any = None
    if scaler_mean is not None and scaler_std is not None:
        scaler = _DummyScaler(scaler_mean, scaler_std)
    mp = None
    if mp_mean is not None and mp_std is not None:
        mp = MediaPipeStats(mean=mp_mean, std=mp_std, n=4096)
    return LoadedModel(
        estimator=_IdentityEstimator(), scaler=scaler, mediapipe_stats=mp
    )


def _example_matrix() -> np.ndarray:
    rng = np.random.default_rng(0xA5D)
    # Coarse MediaPipe-style values (positive offsets from camera centre).
    return rng.normal(loc=200.0, scale=15.0, size=(8, 14))


# ---------------------------------------------------------------------------
# Mathematical contract
# ---------------------------------------------------------------------------
def test_identity_when_distributions_coincide():
    """If MediaPipe stats == trained scaler stats, domain_adapt is the
    same as trained_scaler alone (the affine part collapses to identity)."""
    mean = np.full(14, 100.0)
    std = np.full(14, 5.0)
    model = _model_with(
        mp_mean=mean, mp_std=std, scaler_mean=mean, scaler_std=std
    )

    X = _example_matrix()
    via_domain_adapt = preprocess_matrix(model, X, mode="domain_adapt")
    via_trained_scaler = preprocess_matrix(model, X, mode="trained_scaler")
    np.testing.assert_allclose(
        via_domain_adapt, via_trained_scaler, rtol=1e-12, atol=1e-12
    )


def test_affine_then_scale_matches_explicit_formula():
    """End-to-end: affine map, then standard scaler — verify against the
    closed-form ``(x - mp_mean)/mp_std * trained_std + trained_mean``,
    then ``(.. - trained_mean)/trained_std`` which simplifies to
    ``(x - mp_mean) / mp_std``."""
    rng = np.random.default_rng(7)
    mp_mean = rng.uniform(-10, 10, 14)
    mp_std = rng.uniform(1, 5, 14)
    tr_mean = rng.uniform(100, 200, 14)
    tr_std = rng.uniform(10, 50, 14)
    model = _model_with(mp_mean, mp_std, tr_mean, tr_std)

    X = rng.normal(loc=mp_mean, scale=mp_std * 2, size=(32, 14))
    actual = preprocess_matrix(model, X, mode="domain_adapt")
    # Algebraically equivalent: the trained-mean shift cancels,
    # the trained-std cancels, leaving the simple z-score against MP.
    expected = (X - mp_mean) / mp_std
    np.testing.assert_allclose(actual, expected, rtol=1e-9, atol=1e-9)


def test_post_transform_sample_is_centered_at_origin():
    """When fed a draw from N(mp_mean, mp_std), domain_adapt should
    output something close to N(0, 1) per feature."""
    rng = np.random.default_rng(11)
    mp_mean = rng.uniform(50, 250, 14)
    mp_std = rng.uniform(2, 10, 14)
    tr_mean = rng.uniform(100, 600, 14)
    tr_std = rng.uniform(5, 50, 14)
    model = _model_with(mp_mean, mp_std, tr_mean, tr_std)

    X = rng.normal(mp_mean, mp_std, size=(4096, 14))
    Y = preprocess_matrix(model, X, mode="domain_adapt")
    assert np.all(np.abs(Y.mean(axis=0)) < 0.05), Y.mean(axis=0)
    assert np.all(np.abs(Y.std(axis=0) - 1.0) < 0.05), Y.std(axis=0)


# ---------------------------------------------------------------------------
# Fallback / robustness
# ---------------------------------------------------------------------------
def test_falls_back_to_online_standardize_when_stats_missing(caplog):
    model = _model_with(
        mp_mean=None, mp_std=None,
        scaler_mean=np.zeros(14), scaler_std=np.ones(14),
    )
    X = _example_matrix()
    with caplog.at_level("WARNING"):
        out = preprocess_matrix(model, X, mode="domain_adapt")
    # Should match online_standardize: per-batch z-score.
    expected = (X - X.mean(axis=0, keepdims=True)) / X.std(
        axis=0, keepdims=True
    )
    np.testing.assert_allclose(out, expected, rtol=1e-9, atol=1e-9)
    assert "domain_adapt requested but mediapipe_stats" in caplog.text


def test_falls_back_when_scaler_missing(caplog):
    model = _model_with(
        mp_mean=np.zeros(14), mp_std=np.ones(14),
        scaler_mean=None, scaler_std=None,
    )
    X = _example_matrix()
    with caplog.at_level("WARNING"):
        out = preprocess_matrix(model, X, mode="domain_adapt")
    expected = (X - X.mean(axis=0, keepdims=True)) / X.std(
        axis=0, keepdims=True
    )
    np.testing.assert_allclose(out, expected, rtol=1e-9, atol=1e-9)
    assert "domain_adapt requested but scaler" in caplog.text


def test_zero_mp_std_does_not_divide_by_zero():
    """A degenerate MediaPipe std (e.g. always-zero feature) must not
    produce NaN/inf — the helper floors std to 1.0 in that case."""
    model = _model_with(
        mp_mean=np.zeros(14),
        mp_std=np.zeros(14),  # pathological: all-zero std
        scaler_mean=np.zeros(14),
        scaler_std=np.ones(14),
    )
    X = np.zeros((4, 14))
    out = preprocess_matrix(model, X, mode="domain_adapt")
    assert np.isfinite(out).all()


# ---------------------------------------------------------------------------
# On-disk artefact
# ---------------------------------------------------------------------------
def test_mediapipe_stats_npz_loads_with_correct_shape():
    """The shipped artefact must validate via the loader."""
    path = MODEL_ROOT / "mediapipe_stats.npz"
    assert path.is_file(), (
        "mediapipe_stats.npz should ship with the model artefacts; "
        "rebuild via backend/scripts/build_mediapipe_stats.py if missing."
    )
    stats = _load_mediapipe_stats(path)
    assert stats.mean.shape == (len(FEATURE_ORDER),)
    assert stats.std.shape == (len(FEATURE_ORDER),)
    assert np.all(stats.std > 0)
    assert stats.n > 0


def test_mediapipe_stats_loader_rejects_bad_shape(tmp_path):
    bad = tmp_path / "bad_stats.npz"
    np.savez(
        bad,
        mean=np.zeros(13),  # wrong feature count
        std=np.ones(13),
        n=np.array([10]),
    )
    with pytest.raises(FeatureValidationError) as exc:
        _load_mediapipe_stats(bad)
    assert "wrong shape" in str(exc.value)


def test_mediapipe_stats_loader_rejects_nonpositive_std(tmp_path):
    bad = tmp_path / "bad_stats.npz"
    std = np.ones(14)
    std[3] = 0.0
    np.savez(bad, mean=np.zeros(14), std=std, n=np.array([10]))
    with pytest.raises(FeatureValidationError) as exc:
        _load_mediapipe_stats(bad)
    assert "non-positive" in str(exc.value)


# ---------------------------------------------------------------------------
# End-to-end: real model + run_inference
# ---------------------------------------------------------------------------
def test_real_model_domain_adapt_returns_finite_probability():
    """With the shipped artefacts, domain_adapt must return a finite
    P(ASD) in [0, 1] on a MediaPipe-shaped input."""
    if not (MODEL_ROOT / "autism_model_weights.npz").is_file():
        pytest.skip("model artefact not present in this checkout")
    model = load_model(MODEL_ROOT)
    if model.mediapipe_stats is None:
        pytest.skip("mediapipe_stats.npz not present in this checkout")

    rng = np.random.default_rng(123)
    # Sample around the MediaPipe mean ± half a std on each axis.
    X = (
        model.mediapipe_stats.mean
        + rng.normal(size=(40, 14)) * model.mediapipe_stats.std * 0.4
    )
    result = run_inference(model, X, preprocessing_mode="domain_adapt")
    assert 0.0 <= result.asd_probability <= 1.0
    assert np.isfinite(result.asd_probability)
    assert result.n_frames_used > 0


def test_real_model_trained_scaler_saturates_on_mediapipe_input():
    """Documents the failure mode that motivated domain_adapt — the
    same input that domain_adapt handles cleanly drives trained_scaler
    to a saturated probability. Pinned so a future regression that
    silently flips the default doesn't go unnoticed."""
    if not (MODEL_ROOT / "autism_model_weights.npz").is_file():
        pytest.skip("model artefact not present in this checkout")
    model = load_model(MODEL_ROOT)
    if model.mediapipe_stats is None:
        pytest.skip("mediapipe_stats.npz not present in this checkout")

    rng = np.random.default_rng(456)
    X = (
        model.mediapipe_stats.mean
        + rng.normal(size=(40, 14)) * model.mediapipe_stats.std * 0.4
    )
    trained = run_inference(model, X, preprocessing_mode="trained_scaler")
    domain = run_inference(model, X.copy(), preprocessing_mode="domain_adapt")
    # trained_scaler saturates near 0 or 1; domain_adapt must be
    # strictly closer to the decision boundary.
    distance_from_half_trained = abs(trained.asd_probability - 0.5)
    distance_from_half_domain = abs(domain.asd_probability - 0.5)
    assert distance_from_half_domain < distance_from_half_trained
