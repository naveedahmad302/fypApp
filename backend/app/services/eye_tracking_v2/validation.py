"""Validation utilities for the v2 14-feature pipeline.

Every numeric vector flowing into the trained model passes through these
checks first. The checks are deliberately strict — we'd rather raise
``FeatureValidationError`` than feed garbage into the classifier.
"""

from __future__ import annotations

import logging
from typing import Iterable

import numpy as np

from .config import FEATURE_ORDER

logger = logging.getLogger("eye_tracking_v2.validation")


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

    finite_rows = np.isfinite(mat).all(axis=1)
    dropped = int((~finite_rows).sum())
    if dropped:
        logger.warning(
            "validate_feature_matrix: dropped %d/%d non-finite rows",
            dropped,
            mat.shape[0],
        )
    cleaned = mat[finite_rows]
    if cleaned.size == 0:
        raise FeatureValidationError(
            "All rows in the feature matrix were non-finite"
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
