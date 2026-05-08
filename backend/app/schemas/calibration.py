"""Pydantic schemas for the eye-tracking calibration endpoint (PR-H).

The calibration endpoint accepts a small batch of MediaPipe-extracted
14-feature vectors per gaze direction (centre / left / right / up /
down). The frontend is responsible for invoking the same MediaPipe
adapter the inference pipeline uses (or sending raw frames to a
dedicated "calibration extraction" call). For this first cut we accept
pre-extracted vectors so calibration can be tested without driving the
full mobile capture flow.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

CalibrationDirection = Literal["center", "left", "right", "up", "down"]


class CalibrationDirectionSamples(BaseModel):
    """Per-direction batch of 14-feature vectors.

    The ``vectors`` list contains one length-14 row per usable frame
    captured while the user looked at ``direction``. Order within the
    sub-list is irrelevant — calibration uses pooled mean/std.
    """

    model_config = ConfigDict(frozen=True)

    direction: CalibrationDirection = Field(
        ..., description="Which screen direction the user was looking at."
    )
    vectors: list[list[float]] = Field(
        ...,
        description=(
            "Per-frame 14-feature vectors in canonical FEATURE_ORDER. "
            "Each inner list MUST have length 14."
        ),
        min_length=1,
    )


class CalibrationSamplesRequest(BaseModel):
    """Body of ``POST /api/assessment/calibration``."""

    samples: list[CalibrationDirectionSamples] = Field(
        ...,
        description=(
            "Per-direction sample groups. At least one direction is "
            "required; typical clients submit five (centre + four "
            "cardinals)."
        ),
        min_length=1,
        max_length=5,
    )
    notes: Optional[str] = Field(
        None,
        description="Optional human-readable note attached to the profile.",
        max_length=240,
    )


class CalibrationProfileResponse(BaseModel):
    """Lightweight profile metadata returned by GET / POST."""

    user_id: str
    schema_version: int
    n_samples: int
    captured_at: str
    updated_at: Optional[str] = None
    notes: str = ""


class CalibrationStatusResponse(BaseModel):
    """``GET /api/assessment/calibration`` response."""

    has_calibration: bool
    profile: Optional[CalibrationProfileResponse] = None
