"""Tests for the iris-size monocular depth photogrammetry (PR-H)."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Sequence

import pytest

from app.services.eye_tracking_v2.config import (
    AdapterConfig,
    DEFAULT_ADAPTER_CONFIG,
)
from app.services.eye_tracking_v2.mediapipe_adapter import (
    LEFT_EYE_INNER,
    LEFT_EYE_OUTER,
    LEFT_IRIS,
    RIGHT_EYE_INNER,
    RIGHT_EYE_OUTER,
    RIGHT_IRIS,
    landmarks_to_feature_vector,
)


@dataclass
class _Lm:
    """Minimal stand-in for MediaPipe NormalizedLandmark."""

    x: float
    y: float
    z: float = 0.0


# ---------------------------------------------------------------------------
# Helper: build a synthetic 478-landmark vector with a configurable face
# geometry (IPD-norm and per-eye iris radius in pixels).
# ---------------------------------------------------------------------------
def _make_landmarks(
    *,
    frame_w: int,
    frame_h: int,
    right_centre: tuple[float, float] = (0.40, 0.50),
    left_centre: tuple[float, float] = (0.60, 0.50),
    right_iris_r_px: float = 12.0,
    left_iris_r_px: float = 12.0,
) -> Sequence[_Lm]:
    """Synthesize a 478-landmark face mesh with controlled iris size."""
    n = 478
    lms = [_Lm(0.5, 0.5, 0.0) for _ in range(n)]

    # Eye corners — wide apart so the IPD scaling has something to chew on.
    lms[RIGHT_EYE_OUTER] = _Lm(right_centre[0] - 0.06, right_centre[1])
    lms[RIGHT_EYE_INNER] = _Lm(right_centre[0] + 0.06, right_centre[1])
    lms[LEFT_EYE_INNER] = _Lm(left_centre[0] - 0.06, left_centre[1])
    lms[LEFT_EYE_OUTER] = _Lm(left_centre[0] + 0.06, left_centre[1])

    # Right iris: 5 landmarks roughly on a horizontal pair around the
    # iris centre, separated by ``right_iris_r_px`` pixels in image space.
    iris_r_norm = right_iris_r_px / float(frame_w)
    rx, ry = right_centre
    iris_pts_r = [
        (rx, ry),
        (rx - iris_r_norm, ry),
        (rx + iris_r_norm, ry),
        (rx, ry - iris_r_norm),
        (rx, ry + iris_r_norm),
    ]
    for idx, p in zip(RIGHT_IRIS, iris_pts_r):
        lms[idx] = _Lm(p[0], p[1])

    iris_l_r_norm = left_iris_r_px / float(frame_w)
    lx, ly = left_centre
    iris_pts_l = [
        (lx, ly),
        (lx - iris_l_r_norm, ly),
        (lx + iris_l_r_norm, ly),
        (lx, ly - iris_l_r_norm),
        (lx, ly + iris_l_r_norm),
    ]
    for idx, p in zip(LEFT_IRIS, iris_pts_l):
        lms[idx] = _Lm(p[0], p[1])

    return lms


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
def test_z_recovers_known_distance_at_default_focal():
    """If we synthesize an iris diameter consistent with a known distance,
    the photogrammetry math must recover that distance.

    Using ``focal_px = frame_w = 1000`` and the canonical
    iris_diameter_mm = 11.7, an iris diameter of 23.4 px means

        Z = 1000 * 11.7 / 23.4 = 500 mm

    """
    frame_w = 1000
    frame_h = 1000
    iris_radius_px = 11.7  # diameter == 23.4 px → expected Z = 500 mm

    lms = _make_landmarks(
        frame_w=frame_w,
        frame_h=frame_h,
        right_iris_r_px=iris_radius_px,
        left_iris_r_px=iris_radius_px,
    )

    fv = landmarks_to_feature_vector(lms, frame_w, frame_h)
    assert fv is not None and fv.landmarks_present
    # Indices 2 (right Z) and 5 (left Z) per FEATURE_ORDER.
    assert math.isclose(fv.values[2], 500.0, rel_tol=0.05), fv.values[2]
    assert math.isclose(fv.values[5], 500.0, rel_tol=0.05), fv.values[5]


def test_z_clamped_to_depth_bounds():
    """Pathologically small iris (camera very far) clamps to depth_max_mm.

    Default depth_max is 1500 mm; with focal_px=1000 and iris=11.7 mm
    that means iris diameter must be at least 7.8 px before clamping
    kicks in. Use radius=2 px → diameter 4 px → Z=2925 mm → clamped.
    """
    cfg = AdapterConfig()  # default depth window 100–1500 mm
    frame_w, frame_h = 1000, 1000
    lms = _make_landmarks(
        frame_w=frame_w, frame_h=frame_h,
        right_iris_r_px=2.0, left_iris_r_px=2.0,
    )

    fv = landmarks_to_feature_vector(lms, frame_w, frame_h, config=cfg)
    assert fv is not None
    assert fv.values[2] == pytest.approx(cfg.depth_max_mm), fv.values[2]
    assert fv.values[5] == pytest.approx(cfg.depth_max_mm), fv.values[5]


def test_z_per_eye_can_differ():
    """Asymmetric iris diameters → asymmetric Z. Validates per-eye Z."""
    frame_w, frame_h = 1000, 1000
    lms = _make_landmarks(
        frame_w=frame_w, frame_h=frame_h,
        right_iris_r_px=10.0, left_iris_r_px=14.0,
    )
    fv = landmarks_to_feature_vector(lms, frame_w, frame_h)
    assert fv is not None
    z_right = fv.values[2]
    z_left = fv.values[5]
    # Right has smaller iris → further away → larger Z.
    assert z_right > z_left


def test_explicit_focal_length_overrides_default():
    """If ``focal_length_px`` is set, it replaces the frame_w heuristic."""
    cfg = AdapterConfig(focal_length_px=800.0)
    frame_w, frame_h = 1000, 1000
    iris_radius_px = 11.7  # diameter 23.4 px
    lms = _make_landmarks(
        frame_w=frame_w, frame_h=frame_h,
        right_iris_r_px=iris_radius_px, left_iris_r_px=iris_radius_px,
    )
    fv = landmarks_to_feature_vector(lms, frame_w, frame_h, config=cfg)
    # Z = 800 * 11.7 / 23.4 = 400 mm
    assert fv is not None
    assert math.isclose(fv.values[2], 400.0, rel_tol=0.05)
    assert math.isclose(fv.values[5], 400.0, rel_tol=0.05)


def test_default_config_uses_iris_diameter_117_mm():
    assert DEFAULT_ADAPTER_CONFIG.iris_diameter_mm == 11.7
    assert DEFAULT_ADAPTER_CONFIG.depth_min_mm < DEFAULT_ADAPTER_CONFIG.depth_max_mm
