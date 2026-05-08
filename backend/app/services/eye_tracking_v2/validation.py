"""Validation utilities for the v2 14-feature pipeline.

Every numeric vector flowing into the trained model passes through these
checks first. The checks are deliberately strict — we'd rather raise
``FeatureValidationError`` than feed garbage into the classifier.

ML hardening (PR-F): in addition to the structural / NaN checks below,
each feature has a *physical sanity range* defined in
:data:`FEATURE_RANGE_BOUNDS`. Vectors outside those bounds (e.g. a 3 m
eye-to-camera distance, or a pupil at column -1e9 px) are far enough out
of the training distribution that classifying them is meaningless and
also cheaply identifies attempts to fuzz the model with crafted inputs.
The runtime policy is row-drop (consistent with how non-finite rows are
handled), with the count logged so it can be alerted on.
"""

from __future__ import annotations

import logging
from typing import Iterable

import numpy as np

from .config import FEATURE_ORDER

logger = logging.getLogger("eye_tracking_v2.validation")


# ---------------------------------------------------------------------------
# Physical sanity ranges for each of the 14 features. Values outside
# the (min, max) interval indicate either a sensor failure (face out of
# frame, MediaPipe gave up) or an adversarial input. Bounds are
# intentionally generous — well outside any plausible head pose for a
# child sitting in front of a tablet — so legitimate users are never
# clipped.
#
# eye_pos_*_mm — depth/lateral offset from the camera. The bounds
#   accommodate two very different input regimes that this code may
#   receive a 14-vector from:
#     a) Real eye-tracker hardware → Z ≈ 200..1100 mm, X/Y ≈ ±100 mm
#        (the distribution the MLP was trained on).
#     b) MediaPipe Face Mesh → Z is unitless and roughly in
#        [-100, +100], X/Y are pixel-derived approximations centred on
#        the eye region (~150..280 px).
#   Bounds therefore have to be the union of both regimes — narrower
#   bounds were tried in PR-F but rejected the entire MediaPipe input
#   distribution.
# pupil_*_px    — sensor coords for a 1080p camera fit comfortably in
#                 [-200, 2200] (tiny negative margin lets the iris just
#                 outside the frame still validate).
# por_*_px      — Point of Regard on a 1920×1080 screen, with a generous
#                 ±400 px margin for off-screen gaze.
# ---------------------------------------------------------------------------
FEATURE_RANGE_BOUNDS: dict[str, tuple[float, float]] = {
    "eye_pos_right_x_mm": (-500.0, 500.0),
    "eye_pos_right_y_mm": (-500.0, 500.0),
    "eye_pos_right_z_mm": (-200.0, 2000.0),
    "eye_pos_left_x_mm":  (-500.0, 500.0),
    "eye_pos_left_y_mm":  (-500.0, 500.0),
    "eye_pos_left_z_mm":  (-200.0, 2000.0),
    "pupil_right_x_px":   (-300.0, 4000.0),
    "pupil_right_y_px":   (-300.0, 4000.0),
    "pupil_left_x_px":    (-300.0, 4000.0),
    "pupil_left_y_px":    (-300.0, 4000.0),
    "por_right_x_px":     (-2400.0, 4400.0),
    "por_right_y_px":     (-1400.0, 2400.0),
    "por_left_x_px":      (-2400.0, 4400.0),
    "por_left_y_px":      (-1400.0, 2400.0),
}

assert set(FEATURE_RANGE_BOUNDS.keys()) == set(FEATURE_ORDER), (
    "FEATURE_RANGE_BOUNDS must declare bounds for every feature in "
    "FEATURE_ORDER"
)


def _row_within_bounds(row: np.ndarray) -> bool:
    """True iff every feature in ``row`` is inside its sanity range."""
    for idx, name in enumerate(FEATURE_ORDER):
        low, high = FEATURE_RANGE_BOUNDS[name]
        if not (low <= float(row[idx]) <= high):
            return False
    return True


class FeatureValidationError(ValueError):
    """Raised when a 14-feature vector / matrix fails validation."""


def validate_feature_vector(
    vec: np.ndarray,
    feature_names: Iterable[str] | None = None,
) -> np.ndarray:
    """Validate a single 14-dim feature vector.

    Returns the input unchanged if valid. Raises
    :class:`FeatureValidationError` otherwise. The optional
    ``feature_names`` argument lets callers cross-check the order against
    what the trained model was given at fit time.
    """
    if not isinstance(vec, np.ndarray):
        raise FeatureValidationError(
            f"Expected numpy.ndarray, got {type(vec).__name__}"
        )
    if vec.ndim != 1:
        raise FeatureValidationError(
            f"Expected 1-D vector, got shape {vec.shape}"
        )
    if vec.size != len(FEATURE_ORDER):
        raise FeatureValidationError(
            f"Expected {len(FEATURE_ORDER)} features, got {vec.size}"
        )
    if not np.isfinite(vec).all():
        bad = np.where(~np.isfinite(vec))[0].tolist()
        raise FeatureValidationError(
            f"Non-finite values at feature indices {bad}"
        )

    if feature_names is not None:
        expected = tuple(feature_names)
        if expected and tuple(expected) != FEATURE_ORDER:
            raise FeatureValidationError(
                "Feature ordering mismatch.\n"
                f"  pipeline order : {FEATURE_ORDER}\n"
                f"  expected order : {expected}"
            )
    return vec


def validate_feature_matrix(
    mat: np.ndarray,
    feature_names: Iterable[str] | None = None,
) -> np.ndarray:
    """Validate an (N, 14) matrix where each row is a per-frame vector.

    Drops rows that contain any non-finite value and returns the cleaned
    matrix. Raises if the matrix has the wrong feature dimension or if
    every row was bad.
    """
    if not isinstance(mat, np.ndarray):
        raise FeatureValidationError(
            f"Expected numpy.ndarray, got {type(mat).__name__}"
        )
    if mat.ndim != 2:
        raise FeatureValidationError(
            f"Expected 2-D matrix, got shape {mat.shape}"
        )
    if mat.shape[1] != len(FEATURE_ORDER):
        raise FeatureValidationError(
            f"Expected {len(FEATURE_ORDER)} feature columns, got {mat.shape[1]}"
        )

    if feature_names is not None:
        expected = tuple(feature_names)
        if expected and tuple(expected) != FEATURE_ORDER:
            raise FeatureValidationError(
                "Feature ordering mismatch.\n"
                f"  pipeline order : {FEATURE_ORDER}\n"
                f"  expected order : {expected}"
            )

    # Pass 1 — structural NaN/inf check.
    finite_rows = np.isfinite(mat).all(axis=1)
    dropped_nonfinite = int((~finite_rows).sum())
    if dropped_nonfinite:
        logger.warning(
            "validate_feature_matrix: dropped %d/%d non-finite rows",
            dropped_nonfinite,
            mat.shape[0],
        )
    cleaned = mat[finite_rows]
    if cleaned.size == 0:
        raise FeatureValidationError(
            "All rows in the feature matrix were non-finite"
        )

    # Pass 2 — physical sanity range check. Drop rows whose feature
    # values are wildly outside what real webcam capture can produce so
    # the trained model never sees out-of-distribution inputs (and so
    # crafted-input attacks against the model are filtered before it
    # ever runs).
    in_bounds = np.array(
        [_row_within_bounds(row) for row in cleaned], dtype=bool
    )
    dropped_oob = int((~in_bounds).sum())
    if dropped_oob:
        logger.warning(
            "validate_feature_matrix: dropped %d/%d rows out of physical range",
            dropped_oob,
            cleaned.shape[0],
        )
    cleaned = cleaned[in_bounds]
    if cleaned.size == 0:
        raise FeatureValidationError(
            "All rows fell outside the physical sanity ranges; the input "
            "is either malformed or the camera failed to track."
        )
    return cleaned


def summarise(mat: np.ndarray) -> dict[str, list[float]]:
    """Return a per-feature mean/std summary for logging / debugging."""
    if mat.size == 0:
        return {}
    means = mat.mean(axis=0).tolist()
    stds = mat.std(axis=0).tolist()
    return {
        name: [round(float(means[i]), 3), round(float(stds[i]), 3)]
        for i, name in enumerate(FEATURE_ORDER)
    }
