"""Tests for the v2 eye-tracking range / sanity guards introduced in PR-F.

The structural validators (shape / NaN) were already covered indirectly
via the smoke script; this module pins the per-feature physical-range
behaviour so a contributor can't widen the bounds (or remove them)
without flagging the change.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("ASD_AUTH_TEST_MODE", "true")

from app.services.eye_tracking_v2.config import FEATURE_ORDER  # noqa: E402
from app.services.eye_tracking_v2.validation import (  # noqa: E402
    FEATURE_RANGE_BOUNDS,
    FeatureValidationError,
    validate_feature_matrix,
)


def _plausible_row() -> np.ndarray:
    """A 14-feature row well inside every sanity bound."""
    return np.array(
        [
            -30.0, -10.0, 600.0,   # eye_pos_right_xyz mm
             30.0, -10.0, 600.0,   # eye_pos_left_xyz  mm
            900.0, 540.0,          # pupil_right xy px
            1020.0, 540.0,         # pupil_left  xy px
            960.0, 540.0,          # por_right   xy px
            960.0, 540.0,          # por_left    xy px
        ],
        dtype=np.float64,
    )


def test_plausible_matrix_passes_unchanged():
    rows = np.stack([_plausible_row() for _ in range(5)])
    cleaned = validate_feature_matrix(rows)
    assert cleaned.shape == rows.shape
    np.testing.assert_array_equal(cleaned, rows)


def test_row_with_eye_distance_out_of_range_is_dropped():
    bad = _plausible_row()
    bad[FEATURE_ORDER.index("eye_pos_right_z_mm")] = 5000.0  # > 2000 mm
    mat = np.stack([_plausible_row(), bad, _plausible_row()])
    cleaned = validate_feature_matrix(mat)
    assert cleaned.shape == (2, 14)


def test_row_with_negative_pupil_far_below_floor_is_dropped():
    bad = _plausible_row()
    bad[FEATURE_ORDER.index("pupil_left_x_px")] = -1e6
    mat = np.stack([_plausible_row(), bad])
    cleaned = validate_feature_matrix(mat)
    assert cleaned.shape == (1, 14)


def test_row_with_por_in_far_off_screen_is_dropped():
    bad = _plausible_row()
    bad[FEATURE_ORDER.index("por_right_x_px")] = 1e7
    mat = np.stack([bad, _plausible_row()])
    cleaned = validate_feature_matrix(mat)
    assert cleaned.shape == (1, 14)


def test_all_oob_matrix_raises_with_clear_message():
    bad = _plausible_row()
    bad[FEATURE_ORDER.index("eye_pos_left_z_mm")] = 1e9
    mat = np.stack([bad, bad])
    with pytest.raises(FeatureValidationError) as excinfo:
        validate_feature_matrix(mat)
    msg = str(excinfo.value).lower()
    assert "physical sanity" in msg or "physical range" in msg


def test_bounds_cover_every_feature():
    """Defensive contract: range bounds and feature order must align."""
    assert set(FEATURE_RANGE_BOUNDS.keys()) == set(FEATURE_ORDER)
    for low, high in FEATURE_RANGE_BOUNDS.values():
        assert low < high


def test_nonfinite_takes_priority_over_range_check():
    """A row with NaN is dropped by pass 1; pass 2 never sees it."""
    bad = _plausible_row()
    bad[3] = np.nan
    mat = np.stack([_plausible_row(), bad])
    cleaned = validate_feature_matrix(mat)
    assert cleaned.shape == (1, 14)
    assert np.isfinite(cleaned).all()
