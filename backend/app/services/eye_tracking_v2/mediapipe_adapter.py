"""Adapter: MediaPipe Face Mesh → 14 raw eye-tracker features.

This module converts the per-frame output of MediaPipe Face Mesh + Iris
landmarks into the **exact 14-feature vector schema** that the trained
model was fit on.

Schema (canonical order, see ``config.FEATURE_ORDER``)::

    [0..2]  Eye Position Right       (X, Y, Z) mm
    [3..5]  Eye Position Left        (X, Y, Z) mm
    [6..7]  Pupil Position Right     (X, Y) px
    [8..9]  Pupil Position Left      (X, Y) px
    [10..11] Point of Regard Right   (X, Y) px
    [12..13] Point of Regard Left    (X, Y) px

Mapping assumptions (READ THIS BEFORE TUNING)
---------------------------------------------
The model was originally trained on data from a real eye-tracking device
(measurements in millimetres for 3D eye position, in pixels for 2D pupil /
gaze coordinates). We don't have a hardware tracker — we approximate each
of the 14 inputs from a single RGB webcam frame using MediaPipe Face Mesh
+ Iris landmarks. The mapping is:

* **Eye Position X, Y (mm)** — the 2-D centre of each eye in
  camera-centric coordinates, in millimetres. We anchor the unitless →
  mm scaling using the **inter-pupillary distance** (IPD): we measure
  the iris-to-iris distance in MediaPipe's normalised landmark space
  and scale so that distance equals ``ipd_mm`` (default 63 mm).
* **Eye Position Z (mm)** — depth from camera plane, computed by
  **monocular iris-size photogrammetry** (PR-H). The horizontal iris
  diameter is biologically very stable (≈ 11.7 mm), so given an
  estimate of the camera's effective focal length in pixels we recover

      Z_mm  =  focal_length_px  ×  iris_diameter_mm  /  iris_diameter_px

  This is a real metric Z. It replaces the previous strategy of
  scaling MediaPipe's unitless relative-depth channel by the IPD
  factor, which produced a near-zero, near-constant Z that the
  trained model never used productively.
* **Pupil Position (X, Y) px** — the iris centre projected to image
  pixel coordinates (multiplying normalised landmark coords by the
  frame width / height).
* **Point of Regard (X, Y) px** — the estimated screen-pixel location
  the user is looking at, computed by extrapolating the pupil offset
  relative to the eye centre, scaled by ``por_gain_*`` and re-mapped
  onto the assumed screen resolution. This is approximate; per-user
  calibration (PR-H, see ``calibration.py``) tightens it.

Anatomical convention
---------------------
The training dataset uses anatomical labels: "Right" = user's right eye,
which is on the **left side of the camera image**. MediaPipe's iris
landmark indices follow the same convention (468–472 are the user's left
iris, 473–477 are the user's right iris). We map carefully:

    ANATOMICAL_RIGHT_IRIS = 473..477   # user's right eye
    ANATOMICAL_LEFT_IRIS  = 468..472   # user's left eye

Limitations
-----------
* Point of Regard is approximate without per-user calibration.
* Default focal length is heuristic (≈ frame width); accuracy improves
  when the frontend supplies the device's actual focal length in
  ``AdapterConfig.focal_length_px``.
* Iris-size depth assumes the iris is fully visible. Heavy squinting or
  partial occlusion produces an unreliable Z; the validator's range
  bounds catch the worst offenders before they reach the model.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Optional, Sequence

import numpy as np

from .config import AdapterConfig, DEFAULT_ADAPTER_CONFIG, FEATURE_ORDER

logger = logging.getLogger("eye_tracking_v2.adapter")

# ---------------------------------------------------------------------------
# MediaPipe Face Mesh + Iris landmark indices (anatomical convention)
# ---------------------------------------------------------------------------
# 478 total landmarks (468 face + 10 iris). The legacy module uses
# image-perspective labels ("LEFT" = image-left). We use anatomical
# labels here to match the training dataset.

# User's RIGHT eye (image-left side) — MediaPipe iris indices 473..477
RIGHT_IRIS = (473, 474, 475, 476, 477)
RIGHT_EYE_OUTER = 33    # outer corner (toward the temple)
RIGHT_EYE_INNER = 133   # inner corner (toward the nose)

# User's LEFT eye (image-right side) — MediaPipe iris indices 468..472
LEFT_IRIS = (468, 469, 470, 471, 472)
LEFT_EYE_INNER = 362
LEFT_EYE_OUTER = 263


@dataclass(frozen=True)
class FrameVector:
    """A single per-frame 14-feature vector + provenance metadata."""

    values: np.ndarray  # shape (14,), dtype float64
    frame_index: int
    landmarks_present: bool
    notes: str = ""


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------
def _xyz(landmarks: Sequence, idx: int) -> tuple[float, float, float]:
    """Return MediaPipe NormalizedLandmark XYZ in unitless coordinates."""
    lm = landmarks[idx]
    return (float(lm.x), float(lm.y), float(lm.z))


def _mean_xyz(
    landmarks: Sequence, indices: Sequence[int]
) -> tuple[float, float, float]:
    pts = np.asarray([_xyz(landmarks, i) for i in indices], dtype=np.float64)
    mean = pts.mean(axis=0)
    return float(mean[0]), float(mean[1]), float(mean[2])


def _midpoint(
    a: tuple[float, float, float], b: tuple[float, float, float]
) -> tuple[float, float, float]:
    return ((a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5)


def _norm_distance(
    a: tuple[float, float, float], b: tuple[float, float, float]
) -> float:
    return math.sqrt(sum((a[i] - b[i]) ** 2 for i in range(3)))


# ---------------------------------------------------------------------------
# Public adapter
# ---------------------------------------------------------------------------
def landmarks_to_feature_vector(
    landmarks: Sequence,
    frame_w: int,
    frame_h: int,
    frame_index: int = 0,
    config: AdapterConfig = DEFAULT_ADAPTER_CONFIG,
) -> Optional[FrameVector]:
    """Convert a single frame's MediaPipe landmarks to the 14-feature vector.

    Returns ``None`` if the landmarks are insufficient to compute the full
    vector (e.g. fewer than ``min_landmarks``, or the IPD is degenerate).
    """
    if landmarks is None or len(landmarks) < config.min_landmarks:
        return None
    if frame_w <= 0 or frame_h <= 0:
        return None

    # ------------------------------------------------------------------
    # Step 1. Compute landmark anchors in normalised MediaPipe coords.
    # ------------------------------------------------------------------
    right_iris_norm = _mean_xyz(landmarks, RIGHT_IRIS)
    left_iris_norm = _mean_xyz(landmarks, LEFT_IRIS)

    right_outer_norm = _xyz(landmarks, RIGHT_EYE_OUTER)
    right_inner_norm = _xyz(landmarks, RIGHT_EYE_INNER)
    left_inner_norm = _xyz(landmarks, LEFT_EYE_INNER)
    left_outer_norm = _xyz(landmarks, LEFT_EYE_OUTER)

    # Eye centre = midpoint of outer/inner eye corners (more stable than
    # the iris itself, which moves with gaze).
    right_centre_norm = _midpoint(right_outer_norm, right_inner_norm)
    left_centre_norm = _midpoint(left_outer_norm, left_inner_norm)

    # ------------------------------------------------------------------
    # Step 2. Determine the unitless → millimetre scaling factor for the
    # X / Y axes using the assumed inter-pupillary distance.
    # ------------------------------------------------------------------
    ipd_norm = _norm_distance(right_iris_norm, left_iris_norm)
    if ipd_norm < 1e-6:
        logger.debug(
            "frame %d: degenerate IPD (%.6f), skipping",
            frame_index,
            ipd_norm,
        )
        return None
    mm_per_unit = config.ipd_mm / ipd_norm

    # ------------------------------------------------------------------
    # Step 2a. Monocular depth via iris-size photogrammetry (PR-H).
    #
    # We measure the on-screen iris diameter in pixels (max pairwise
    # distance among the 5 iris landmarks projected to image space)
    # and recover absolute Z in mm given the camera's focal length:
    #
    #     Z_mm  =  focal_px  ×  iris_diameter_mm  /  iris_diameter_px
    #
    # Each eye gets its own Z (they differ slightly under head yaw, and
    # the trained model expects per-eye Z). Frames where either iris is
    # too small / occluded fall outside ``[depth_min_mm, depth_max_mm]``
    # and get clamped — the row will be dropped by the validator's
    # range guard if the clamp pegs it at a bound.
    # ------------------------------------------------------------------
    focal_px = config.focal_length_px or float(frame_w)

    def _iris_diameter_px(iris_indices: Sequence[int]) -> float:
        """Maximum pairwise distance among iris landmarks in image px."""
        pts_px = np.asarray(
            [
                (landmarks[i].x * frame_w, landmarks[i].y * frame_h)
                for i in iris_indices
            ],
            dtype=np.float64,
        )
        d2 = np.sum(
            (pts_px[:, None, :] - pts_px[None, :, :]) ** 2, axis=-1
        )
        return float(math.sqrt(d2.max()))

    right_iris_px = _iris_diameter_px(RIGHT_IRIS)
    left_iris_px = _iris_diameter_px(LEFT_IRIS)
    if right_iris_px < 1.0 or left_iris_px < 1.0:
        logger.debug(
            "frame %d: degenerate iris diameter (right=%.2f, left=%.2f)",
            frame_index, right_iris_px, left_iris_px,
        )
        return None

    right_z_mm = (focal_px * config.iris_diameter_mm) / right_iris_px
    left_z_mm = (focal_px * config.iris_diameter_mm) / left_iris_px
    right_z_mm = float(np.clip(right_z_mm, config.depth_min_mm, config.depth_max_mm))
    left_z_mm = float(np.clip(left_z_mm, config.depth_min_mm, config.depth_max_mm))

    # X, Y in mm via the IPD scaling; Z is the photogrammetry result.
    right_eye_mm = (
        right_centre_norm[0] * mm_per_unit,
        right_centre_norm[1] * mm_per_unit,
        right_z_mm,
    )
    left_eye_mm = (
        left_centre_norm[0] * mm_per_unit,
        left_centre_norm[1] * mm_per_unit,
        left_z_mm,
    )

    # ------------------------------------------------------------------
    # Step 3. Pupil position in image pixel coordinates.
    # ------------------------------------------------------------------
    pupil_right_x_px = right_iris_norm[0] * frame_w
    pupil_right_y_px = right_iris_norm[1] * frame_h
    pupil_left_x_px = left_iris_norm[0] * frame_w
    pupil_left_y_px = left_iris_norm[1] * frame_h

    # ------------------------------------------------------------------
    # Step 4. Point of Regard estimation.
    #
    # Without per-user calibration we extrapolate the pupil offset from
    # the eye centre, scale it by the assumed screen resolution and the
    # configurable PoR gains.
    # ------------------------------------------------------------------
    def _por(
        pupil_norm: tuple[float, float, float],
        centre_norm: tuple[float, float, float],
    ) -> tuple[float, float]:
        # Offset of the pupil relative to the socket centre, normalised
        # by the eye width.
        eye_width = abs(left_outer_norm[0] - right_outer_norm[0])
        if eye_width < 1e-6:
            eye_width = 1e-6
        offset_x = (pupil_norm[0] - centre_norm[0]) / eye_width
        offset_y = (pupil_norm[1] - centre_norm[1]) / eye_width

        # Project to screen-pixel space. The pupil's image position is
        # the anchor; the offset shifts it by the configured gain.
        anchor_x = pupil_norm[0] * config.screen_width_px
        anchor_y = pupil_norm[1] * config.screen_height_px
        por_x = anchor_x + offset_x * config.por_gain_x * config.screen_width_px
        por_y = anchor_y + offset_y * config.por_gain_y * config.screen_height_px
        # Clamp to screen bounds — eye-trackers also report only on-screen
        # gaze samples, so we mirror that convention.
        por_x = max(0.0, min(config.screen_width_px, por_x))
        por_y = max(0.0, min(config.screen_height_px, por_y))
        return por_x, por_y

    por_right_x, por_right_y = _por(right_iris_norm, right_centre_norm)
    por_left_x, por_left_y = _por(left_iris_norm, left_centre_norm)

    # ------------------------------------------------------------------
    # Step 5. Pack into the canonical 14-vector. Order MUST stay aligned
    # with config.FEATURE_ORDER.
    # ------------------------------------------------------------------
    values = np.asarray(
        (
            # Eye Position Right (mm)
            right_eye_mm[0], right_eye_mm[1], right_eye_mm[2],
            # Eye Position Left (mm)
            left_eye_mm[0], left_eye_mm[1], left_eye_mm[2],
            # Pupil Position Right (px)
            pupil_right_x_px, pupil_right_y_px,
            # Pupil Position Left (px)
            pupil_left_x_px, pupil_left_y_px,
            # Point of Regard Right (px)
            por_right_x, por_right_y,
            # Point of Regard Left (px)
            por_left_x, por_left_y,
        ),
        dtype=np.float64,
    )

    if not np.isfinite(values).all():
        # Don't propagate NaN/Inf — let the caller/validator decide.
        return FrameVector(
            values=values,
            frame_index=frame_index,
            landmarks_present=True,
            notes="non-finite",
        )

    return FrameVector(
        values=values,
        frame_index=frame_index,
        landmarks_present=True,
    )


def feature_vector_dict(values: np.ndarray) -> dict[str, float]:
    """Convert a 14-vector back to a dict keyed by canonical feature name."""
    return {name: float(values[i]) for i, name in enumerate(FEATURE_ORDER)}
