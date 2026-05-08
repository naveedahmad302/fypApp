"""Configuration for the v2 eye-tracking pipeline.

The v2 pipeline is built around the 14-feature schema produced by a real
eye-tracker device::

    Eye Position Right       (X, Y, Z) mm
    Eye Position Left        (X, Y, Z) mm
    Pupil Position Right     (X, Y) px
    Pupil Position Left      (X, Y) px
    Point of Regard Right    (X, Y) px
    Point of Regard Left     (X, Y) px
    Total = 14 features

The legacy MediaPipe behavioural pipeline (``services/eye_tracking.py``) is
preserved verbatim and remains selectable through ``EYE_TRACKING_BACKEND``.
This module owns ALL knobs that switch between the two backends and where
the trained-model artefacts live on disk so nothing else needs editing
when the model is dropped in.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

logger = logging.getLogger("eye_tracking_v2.config")

# ---------------------------------------------------------------------------
# Backend selection
# ---------------------------------------------------------------------------
Backend = Literal["new_model", "legacy_mediapipe"]

# Default backend. Override with: export EYE_TRACKING_BACKEND=legacy_mediapipe
DEFAULT_BACKEND: Backend = "new_model"


def get_backend() -> Backend:
    """Return the active eye-tracking backend.

    The env var ``EYE_TRACKING_BACKEND`` may be set to either
    ``new_model`` (use the trained model + 14-feature adapter) or
    ``legacy_mediapipe`` (use the original behavioural pipeline).
    """
    raw = os.environ.get("EYE_TRACKING_BACKEND", DEFAULT_BACKEND).strip().lower()
    if raw not in ("new_model", "legacy_mediapipe"):
        logger.warning(
            "Unknown EYE_TRACKING_BACKEND=%r; falling back to %r",
            raw,
            DEFAULT_BACKEND,
        )
        return DEFAULT_BACKEND
    return raw  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Filesystem paths for the trained model artefacts
# ---------------------------------------------------------------------------
_BACKEND_ROOT = Path(__file__).resolve().parents[2]  # backend/app/
MODEL_ROOT = _BACKEND_ROOT / "models" / "eye_model_v1"

# Recognised filenames inside MODEL_ROOT. The runner picks the first match.
# .npz holds the weights of a pure-NumPy port of the trained Keras MLP
# (see keras_mlp.py). .joblib / .pkl point at sklearn-style estimators.
MODEL_CANDIDATES = (
    "autism_model_weights.npz",
    "model.npz",
    "model.joblib",
    "model.pkl",
    "eye_model.joblib",
    "eye_model.pkl",
)
SCALER_CANDIDATES = (
    "scaler.joblib",
    "scaler.pkl",
)
FEATURE_NAMES_CANDIDATES = (
    "feature_names.json",
    "features.json",
)
METADATA_CANDIDATES = (
    "metadata.json",
    "model_metadata.json",
)


# ---------------------------------------------------------------------------
# 14-feature schema (canonical order — must NEVER change at inference time)
# ---------------------------------------------------------------------------
FEATURE_ORDER: tuple[str, ...] = (
    # Eye Position Right (mm)
    "eye_pos_right_x_mm",
    "eye_pos_right_y_mm",
    "eye_pos_right_z_mm",
    # Eye Position Left (mm)
    "eye_pos_left_x_mm",
    "eye_pos_left_y_mm",
    "eye_pos_left_z_mm",
    # Pupil Position Right (px)
    "pupil_right_x_px",
    "pupil_right_y_px",
    # Pupil Position Left (px)
    "pupil_left_x_px",
    "pupil_left_y_px",
    # Point of Regard Right (px)
    "por_right_x_px",
    "por_right_y_px",
    # Point of Regard Left (px)
    "por_left_x_px",
    "por_left_y_px",
)

assert len(FEATURE_ORDER) == 14, "FEATURE_ORDER must contain exactly 14 features"


# ---------------------------------------------------------------------------
# Adapter / approximation knobs
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class AdapterConfig:
    """Constants used by the MediaPipe → 14-feature adapter.

    These constants are tuned for typical webcam capture and are exposed here
    so they can be overridden per deployment without touching the adapter
    code.
    """

    # Average inter-pupillary distance (IPD) used to scale MediaPipe's
    # unitless 3D landmarks into millimetres. 63 mm is the population mean
    # for adults; 58 mm is closer to school-age children. Tweak if your
    # target user group is significantly different.
    ipd_mm: float = 63.0

    # Assumed pixel resolution of the screen the user looks at. The
    # Point-of-Regard mapping is built around this resolution. If the
    # frontend ever sends real screen dims, override here.
    screen_width_px: float = 1920.0
    screen_height_px: float = 1080.0

    # Gain factor applied when extrapolating the pupil offset (relative to
    # the eye centre) onto the screen plane to estimate Point of Regard.
    # 1.0 = no extrapolation (PoR ≈ pupil offset on screen). Larger values
    # exaggerate gaze deflection — tune empirically against the training
    # data distribution if needed.
    por_gain_x: float = 6.0
    por_gain_y: float = 6.0

    # Required minimum number of MediaPipe landmarks for a frame to be
    # considered usable (478 = full Face Mesh + iris).
    min_landmarks: int = 478

    # Confidence floor for MediaPipe face detection / presence. Frames
    # below this are dropped.
    min_face_detection_confidence: float = 0.5
    min_face_presence_confidence: float = 0.5


DEFAULT_ADAPTER_CONFIG = AdapterConfig()


# ---------------------------------------------------------------------------
# Preprocessing strategy
# ---------------------------------------------------------------------------
# How to bring a per-frame 14-vector into the value range the trained
# model expects.
#
# - "trained_scaler"     Apply the saved StandardScaler. This is correct
#                        when inputs come from the same hardware
#                        eye-tracker that produced the training data.
# - "online_standardize" Standardise per-batch using the batch's own
#                        mean/std. Best when inputs are MediaPipe
#                        approximations whose absolute scale differs
#                        from the eye-tracker training distribution.
# - "none"               Feed raw values straight in (debug only).
#
# Default = "online_standardize" because this backend is fed by webcam
# MediaPipe approximations, NOT a real eye-tracker. See README.
PreprocessingMode = Literal["trained_scaler", "online_standardize", "none"]

DEFAULT_PREPROCESSING_MODE: PreprocessingMode = "online_standardize"


def get_preprocessing_mode() -> PreprocessingMode:
    """Return the active preprocessing mode (env: EYE_TRACKING_PREPROC)."""
    raw = os.environ.get(
        "EYE_TRACKING_PREPROC", DEFAULT_PREPROCESSING_MODE
    ).strip().lower()
    if raw not in ("trained_scaler", "online_standardize", "none"):
        logger.warning(
            "Unknown EYE_TRACKING_PREPROC=%r; falling back to %r",
            raw,
            DEFAULT_PREPROCESSING_MODE,
        )
        return DEFAULT_PREPROCESSING_MODE
    return raw  # type: ignore[return-value]


@dataclass
class PipelineConfig:
    """Full v2 pipeline configuration."""

    backend: Backend = field(default_factory=get_backend)
    adapter: AdapterConfig = field(default_factory=AdapterConfig)
    model_root: Path = field(default_factory=lambda: MODEL_ROOT)
    preprocessing: PreprocessingMode = field(
        default_factory=get_preprocessing_mode
    )
    # Raise vs silently fall back to legacy when the model artefact is
    # missing. Production should set fail_open=False to surface the issue.
    fail_open: bool = True


def load_pipeline_config() -> PipelineConfig:
    """Build the active pipeline configuration."""
    cfg = PipelineConfig()
    logger.info(
        "eye_tracking_v2 config: backend=%s preproc=%s model_root=%s ipd_mm=%.1f",
        cfg.backend,
        cfg.preprocessing,
        cfg.model_root,
        cfg.adapter.ipd_mm,
    )
    return cfg
