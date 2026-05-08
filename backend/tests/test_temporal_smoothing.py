"""Tests for the temporal stabilisation module (PR-H)."""

from __future__ import annotations

import numpy as np
import pytest

from app.services.eye_tracking_v2.smoothing import (
    DEFAULT_SMOOTHING_CONFIG,
    SmoothingConfig,
    apply_temporal_stabilisation,
)


def _signal(n: int, d: int = 14, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    base = rng.normal(0.0, 1.0, size=(n, d))
    # add a slow drift per feature so EMA has something to track
    drift = np.linspace(0.0, 1.0, n)[:, None] * np.arange(1, d + 1) * 0.1
    return base + drift


def test_zero_rows_returns_empty_no_crash():
    out, stats = apply_temporal_stabilisation(np.empty((0, 14)))
    assert out.shape == (0, 14)
    assert stats == {"n_in": 0, "n_dropped": 0, "n_out": 0,
                     "alpha": DEFAULT_SMOOTHING_CONFIG.alpha}


def test_alpha_one_is_identity_when_outlier_disabled():
    """alpha=1 + outlier-detection-disabled → output equals input.

    We bypass outlier detection (raise ``min_samples_for_outlier``
    above the test batch) so the test isolates the EMA path: alpha=1
    means ``y[k] = x[k]``.
    """
    rng = np.random.default_rng(42)
    sig = rng.normal(0.0, 1.0, size=(20, 14))
    out, stats = apply_temporal_stabilisation(
        sig,
        SmoothingConfig(alpha=1.0, min_samples_for_outlier=10_000),
    )
    assert stats["n_dropped"] == 0
    np.testing.assert_allclose(out, sig)


def test_ema_reduces_pointwise_variance():
    """alpha < 1 must reduce the variance of the smoothed signal."""
    sig = _signal(50)
    out, _ = apply_temporal_stabilisation(sig, SmoothingConfig(alpha=0.2))
    # Pointwise diff is dampened relative to the input.
    in_var = np.var(np.diff(sig, axis=0))
    out_var = np.var(np.diff(out, axis=0))
    assert out_var < in_var, (in_var, out_var)


def test_outlier_dropped_then_filled_from_last_good():
    """A spike row is flagged and forward-filled from the last good EMA."""
    n, d = 30, 14
    sig = np.zeros((n, d))
    # Inject a single spike at index 15 with extreme values.
    sig[15] = np.full(d, 100.0)
    out, stats = apply_temporal_stabilisation(
        sig, SmoothingConfig(alpha=1.0, outlier_z=3.0)
    )
    assert stats["n_dropped"] >= 1
    # Output at the spike row should be close to zero (filled from last good).
    assert np.max(np.abs(out[15])) < 1.0


def test_output_row_count_matches_input():
    """Outliers are filled, never dropped — n_out == n_in."""
    sig = _signal(40)
    sig[10] = np.full(14, 50.0)  # outlier
    out, stats = apply_temporal_stabilisation(sig)
    assert out.shape == sig.shape
    assert stats["n_in"] == sig.shape[0]
    assert stats["n_out"] == sig.shape[0]


def test_invalid_alpha_raises():
    with pytest.raises(ValueError):
        apply_temporal_stabilisation(_signal(5), SmoothingConfig(alpha=0.0))
    with pytest.raises(ValueError):
        apply_temporal_stabilisation(_signal(5), SmoothingConfig(alpha=1.5))


def test_invalid_shape_raises():
    with pytest.raises(ValueError):
        apply_temporal_stabilisation(np.zeros(14))  # 1-D


def test_below_minimum_samples_skips_outlier_rejection():
    """Tiny batches don't get outlier-flagged — the median + MAD is unreliable."""
    sig = np.zeros((3, 14))
    sig[1] = np.full(14, 100.0)
    out, stats = apply_temporal_stabilisation(
        sig, SmoothingConfig(alpha=1.0, outlier_z=3.0,
                             min_samples_for_outlier=10)
    )
    assert stats["n_dropped"] == 0
    # Without smoothing or outlier reject, output equals input.
    np.testing.assert_allclose(out, sig)
