"""Temporal stabilisation for the (N, 14) feature matrix (PR-H).

Why this module exists
----------------------
Per-frame MediaPipe outputs are noisy. Iris landmarks jitter sub-pixel
between frames, blinks momentarily collapse landmarks toward the eyelid
and produce wildly off-distribution rows, and one bad frame can shift
the whole-batch mean enough to upset the trained model. The legacy
v2 pipeline took a simple ``mean()`` over per-frame predictions, which
relied entirely on the model's robustness to absorb these spikes —
predictions still fluctuated frame-to-frame.

This module adds a small, deterministic, dependency-free numpy
post-processor that runs **between feature extraction and inference**:

1. **Outlier rejection** — drop frames whose 14-vector lies more than
   ``outlier_z`` standard deviations from the per-batch median in
   any feature. Blink frames get caught here because their per-eye
   Y / pupil Y / iris diameter all spike together.
2. **Exponential moving average (EMA)** — smooth the survivors with
   ``alpha`` in the canonical first-order IIR form

       y[k] = alpha * x[k] + (1 - alpha) * y[k-1]

   ``alpha=1.0`` is a no-op (all signal, no smoothing).
   ``alpha=0.0`` would pin every output at the first sample. The
   default ``alpha=0.35`` corresponds to an effective averaging
   window of ~5 frames at 30 fps, balancing latency vs. jitter.
3. **Blink-induced gap filling** — frames the outlier step removed
   are forward-filled from the last good EMA value rather than
   shrinking the matrix, so downstream code that uses ``n_frames``
   for confidence weighting sees a consistent count.

This module is pure-NumPy and has no MediaPipe / FastAPI / sklearn
dependency. The pipeline calls into it after
:func:`extract_feature_matrix` and before :func:`run_inference`.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np

logger = logging.getLogger("eye_tracking_v2.smoothing")


@dataclass(frozen=True)
class SmoothingConfig:
    """Knobs for :func:`apply_temporal_stabilisation`.

    All values are tuned for typical 25–30 fps webcam capture. If the
    capture FPS is much lower or higher, ``alpha`` and ``window`` are
    the parameters most worth retuning.
    """

    # EMA mixing factor for the first-order IIR filter. Smaller =
    # smoother but more lag. 0.35 ≈ 5-frame effective window at 30 fps.
    alpha: float = 0.35

    # Outlier rejection threshold in robust z-units (median + MAD).
    # 3.0 is the classic Hampel-style cutoff: rows that deviate by more
    # than 3× MAD from the median in *any* feature are dropped.
    outlier_z: float = 3.0

    # Fall-back to the simpler median + std rule when the median
    # absolute deviation collapses to zero (which happens on tiny or
    # near-constant batches). Set to ``None`` to disable.
    fallback_std_z: Optional[float] = 4.0

    # Minimum sample size for outlier rejection to even run. Below
    # this threshold the smoothing is just an EMA pass.
    min_samples_for_outlier: int = 5


DEFAULT_SMOOTHING_CONFIG = SmoothingConfig()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def apply_temporal_stabilisation(
    feature_matrix: np.ndarray,
    config: SmoothingConfig = DEFAULT_SMOOTHING_CONFIG,
) -> tuple[np.ndarray, dict[str, int]]:
    """Smooth + de-outlier an (N, 14) raw feature matrix.

    Returns the stabilised matrix (same shape) and a small stats dict
    suitable for logging / response payload::

        {
          "n_in":            <input row count>,
          "n_dropped":       <rows flagged as outliers>,
          "n_out":           <output row count>,
          "alpha":           <ema alpha actually used>,
        }

    The output matrix has the **same row count as the input** — outliers
    are forward-filled from the last good EMA value rather than dropped,
    so downstream confidence calculations see a stable ``n_frames``.
    """
    if feature_matrix.ndim != 2:
        raise ValueError(
            f"feature_matrix must be 2-D (got {feature_matrix.ndim}D)"
        )
    n, d = feature_matrix.shape
    if n == 0:
        return feature_matrix.copy(), {
            "n_in": 0, "n_dropped": 0, "n_out": 0,
            "alpha": float(config.alpha),
        }

    if not (0.0 < config.alpha <= 1.0):
        raise ValueError(
            f"alpha must be in (0, 1] (got {config.alpha})"
        )

    # ----------------------------------------------------------------
    # Stage 1 — robust outlier mask (Hampel-style).
    # ----------------------------------------------------------------
    drop_mask = _outlier_mask(feature_matrix, config)
    n_dropped = int(drop_mask.sum())
    keep_mask = ~drop_mask

    # ----------------------------------------------------------------
    # Stage 2 — first-order EMA over the survivors. Outlier rows are
    # filled from the last good EMA state, so the output is fully
    # populated and aligned with the input row order.
    # ----------------------------------------------------------------
    out = np.empty_like(feature_matrix, dtype=np.float64)
    last_good: Optional[np.ndarray] = None
    for i in range(n):
        x = feature_matrix[i].astype(np.float64, copy=False)
        if keep_mask[i]:
            if last_good is None:
                last_good = x.copy()
            else:
                last_good = config.alpha * x + (1.0 - config.alpha) * last_good
            out[i] = last_good
        else:
            # Outlier — hold the last good EMA value (or zero if we
            # haven't seen a good frame yet — in practice this only
            # happens if the *first* frame is an outlier, which the
            # validator's range guard would already catch).
            out[i] = (
                last_good.copy()
                if last_good is not None
                else np.zeros(d, dtype=np.float64)
            )

    stats = {
        "n_in": int(n),
        "n_dropped": int(n_dropped),
        "n_out": int(n),
        "alpha": float(config.alpha),
    }
    if n_dropped:
        logger.debug(
            "temporal_smoothing: dropped %d/%d outlier rows (alpha=%.2f)",
            n_dropped, n, config.alpha,
        )
    return out, stats


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------
def _outlier_mask(
    feature_matrix: np.ndarray, config: SmoothingConfig
) -> np.ndarray:
    """Return a boolean mask of rows to drop as outliers.

    Uses median + MAD per feature. A row is dropped if **any** feature
    deviates by more than ``outlier_z`` MAD-units from that feature's
    median. MAD is converted to a robust σ-estimate via the standard
    1.4826 factor (Gaussian consistency).
    """
    n = feature_matrix.shape[0]
    if n < config.min_samples_for_outlier:
        return np.zeros(n, dtype=bool)

    median = np.median(feature_matrix, axis=0)
    deviations = np.abs(feature_matrix - median)
    mad = np.median(deviations, axis=0)

    # If MAD == 0 for some feature (degenerate / near-constant column),
    # fall back to a generous mean+std rule to avoid dividing by zero.
    sigma = mad * 1.4826
    if config.fallback_std_z is not None:
        std = feature_matrix.std(axis=0)
        sigma = np.where(sigma < 1e-9, std / max(1e-9, config.outlier_z) * config.fallback_std_z, sigma)
    sigma = np.where(sigma < 1e-9, 1.0, sigma)

    z = deviations / sigma
    # Drop the row if any feature is beyond the threshold.
    return (z > config.outlier_z).any(axis=1)
