"""Per-user calibration profile for the eye-tracking pipeline (PR-H).

What this gives us
------------------
The trained ASD model lives in a particular numeric regime — features
have specific means and spreads that come from a real eye-tracker
hardware setup. ``mediapipe_stats.npz`` (PR-G) ships **global**
MediaPipe statistics so domain_adapt can map any user's MediaPipe
output into trained-distribution space. That works, but every user
has slightly different anatomy (IPD, eye shape, head pose habits),
camera (focal length, distortion), and screen geometry, so the
**global** stats are an average — not optimal for any specific user.

A **calibration profile** captures a user's *own* per-feature mean
and standard deviation by running the existing extraction pipeline on
a small set of self-look-at samples (e.g. five 1-second captures while
the user looks at the centre, left, right, top, bottom of their
screen). At inference time the pipeline uses these per-user statistics
in place of the global ``mediapipe_stats.npz``, so the domain-adapt
affine is exactly tuned to the user behind the camera.

Storage
-------
The profile is small and lives in Firestore alongside the user document
(see :mod:`app.services.calibration_store`). The on-disk SQLite cache
provides fast local lookups during a single backend lifetime.

Application
-----------
At inference time, the v2 pipeline calls
:func:`apply_calibration_to_loaded_model` to swap the model's
``mediapipe_stats`` with the user's calibrated stats. If the user has
never calibrated, the model continues to use the global stats — no
behaviour change vs. PR-G.
"""

from __future__ import annotations

import dataclasses
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

import numpy as np

from .config import FEATURE_ORDER

logger = logging.getLogger("eye_tracking_v2.calibration")

# Keep the schema version bumped whenever the on-the-wire shape of a
# stored profile changes — old profiles from earlier versions are
# discarded rather than crashing inference.
CALIBRATION_SCHEMA_VERSION = 1

# Minimum number of usable per-frame 14-vectors required to build a
# trustworthy calibration. Below this we refuse — the per-feature std
# estimate is too noisy.
MIN_CALIBRATION_FRAMES = 30

# Floor for any per-feature std. Stops a degenerate calibration column
# (e.g. user blinked through every sample of one direction, killing
# variance) from collapsing the domain-adapt divisor to zero.
MIN_CALIBRATION_STD = 1e-3


@dataclass(frozen=True)
class CalibrationProfile:
    """Per-user feature-distribution profile.

    All arrays are length-14 in :data:`FEATURE_ORDER` order.
    ``feature_mean`` / ``feature_std`` replace the global
    ``mediapipe_stats.npz`` mean/std for this user.
    """

    user_id: str
    schema_version: int
    feature_mean: np.ndarray
    feature_std: np.ndarray
    n_samples: int
    captured_at: datetime
    notes: str = ""

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------
    def __post_init__(self) -> None:  # pragma: no cover - dataclass plumbing
        if self.feature_mean.shape != (len(FEATURE_ORDER),):
            raise ValueError(
                f"feature_mean must have shape ({len(FEATURE_ORDER)},), "
                f"got {self.feature_mean.shape}"
            )
        if self.feature_std.shape != (len(FEATURE_ORDER),):
            raise ValueError(
                f"feature_std must have shape ({len(FEATURE_ORDER)},), "
                f"got {self.feature_std.shape}"
            )
        if not np.all(np.isfinite(self.feature_mean)):
            raise ValueError("feature_mean has non-finite entries")
        if not np.all(np.isfinite(self.feature_std)):
            raise ValueError("feature_std has non-finite entries")
        if (self.feature_std < 0).any():
            raise ValueError("feature_std has negative entries")

    # ------------------------------------------------------------------
    # Serialisation helpers
    # ------------------------------------------------------------------
    def to_dict(self) -> dict[str, Any]:
        """Render to a JSON-friendly dict for Firestore / SQLite cache."""
        return {
            "user_id": self.user_id,
            "schema_version": self.schema_version,
            "feature_order": list(FEATURE_ORDER),
            "feature_mean": [float(v) for v in self.feature_mean],
            "feature_std": [float(v) for v in self.feature_std],
            "n_samples": int(self.n_samples),
            "captured_at": self.captured_at.astimezone(timezone.utc).isoformat(),
            "notes": str(self.notes),
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "CalibrationProfile":
        """Inverse of :meth:`to_dict`. Raises ``ValueError`` on schema mismatch."""
        version = int(payload.get("schema_version", 0))
        if version != CALIBRATION_SCHEMA_VERSION:
            raise ValueError(
                f"Unsupported calibration schema_version={version} "
                f"(expected {CALIBRATION_SCHEMA_VERSION})"
            )
        order = tuple(payload.get("feature_order", []))
        if order != FEATURE_ORDER:
            raise ValueError(
                "Calibration profile feature_order does not match "
                "current FEATURE_ORDER — discarding"
            )
        captured_at_raw = payload.get("captured_at")
        if isinstance(captured_at_raw, str):
            captured_at = datetime.fromisoformat(captured_at_raw)
        elif isinstance(captured_at_raw, datetime):
            captured_at = captured_at_raw
        else:
            captured_at = datetime.now(timezone.utc)
        return cls(
            user_id=str(payload["user_id"]),
            schema_version=version,
            feature_mean=np.asarray(payload["feature_mean"], dtype=np.float64),
            feature_std=np.asarray(payload["feature_std"], dtype=np.float64),
            n_samples=int(payload["n_samples"]),
            captured_at=captured_at,
            notes=str(payload.get("notes", "")),
        )


# ---------------------------------------------------------------------------
# Calibration profile builder
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class CalibrationSample:
    """One look-at sample contributed to a calibration session.

    ``direction`` is one of ``"center" | "left" | "right" | "up" | "down"``
    and is captured for diagnostic display only — the profile build does
    not weight directions differently. The pipeline trusts the user's
    self-report only insofar as it tells us they were looking *somewhere*
    on screen.
    """

    direction: str
    frame_vectors: np.ndarray   # shape (N_i, 14), N_i ≥ 1


class CalibrationError(ValueError):
    """Raised when the supplied samples are insufficient or invalid."""


def build_profile_from_samples(
    user_id: str,
    samples: list[CalibrationSample],
    *,
    captured_at: Optional[datetime] = None,
    notes: str = "",
) -> CalibrationProfile:
    """Concatenate per-direction samples and compute mean/std.

    Validation
    ----------
    * Total sample count must be ≥ :data:`MIN_CALIBRATION_FRAMES`.
    * All rows must be finite.
    * Each per-feature std is floored at :data:`MIN_CALIBRATION_STD`
      so a degenerate column never produces a divide-by-zero in
      domain_adapt.

    Returns the profile; persistence is the caller's responsibility
    (see :mod:`app.services.calibration_store`).
    """
    if not samples:
        raise CalibrationError("No calibration samples provided.")

    rows = []
    for s in samples:
        if s.frame_vectors.ndim != 2 or s.frame_vectors.shape[1] != len(FEATURE_ORDER):
            raise CalibrationError(
                f"Sample direction={s.direction!r} has shape "
                f"{s.frame_vectors.shape}, expected (N, {len(FEATURE_ORDER)})"
            )
        rows.append(s.frame_vectors)
    matrix = np.vstack(rows).astype(np.float64, copy=False)

    if not np.isfinite(matrix).all():
        raise CalibrationError(
            "Calibration samples contain non-finite values — "
            "drop bad frames before submitting."
        )
    if matrix.shape[0] < MIN_CALIBRATION_FRAMES:
        raise CalibrationError(
            f"Need at least {MIN_CALIBRATION_FRAMES} usable frames "
            f"across all directions; got {matrix.shape[0]}."
        )

    mean = matrix.mean(axis=0)
    std = matrix.std(axis=0)
    std = np.where(std < MIN_CALIBRATION_STD, MIN_CALIBRATION_STD, std)

    return CalibrationProfile(
        user_id=user_id,
        schema_version=CALIBRATION_SCHEMA_VERSION,
        feature_mean=mean,
        feature_std=std,
        n_samples=int(matrix.shape[0]),
        captured_at=captured_at or datetime.now(timezone.utc),
        notes=notes,
    )


# ---------------------------------------------------------------------------
# Apply at inference time
# ---------------------------------------------------------------------------
def apply_calibration_to_loaded_model(
    loaded_model: Any,
    profile: Optional[CalibrationProfile],
) -> Any:
    """Return a shallow-replaced ``LoadedModel`` whose ``mediapipe_stats``
    reflect the user's calibration profile.

    If ``profile`` is None the input model is returned unchanged so
    callers don't need to special-case the no-calibration path.

    The override is **shallow**: we keep the original ``estimator``,
    ``scaler``, and metadata, but swap ``mediapipe_stats`` for a fresh
    :class:`MediaPipeStats` built from the user profile. This is the
    minimum-impact integration with the existing PR-G domain_adapt code
    in :mod:`model_runner`.
    """
    if profile is None:
        return loaded_model

    # Lazy import to avoid a cycle: model_runner imports from this
    # module via the pipeline.
    from .model_runner import LoadedModel, MediaPipeStats

    if not isinstance(loaded_model, LoadedModel):
        # Belt-and-braces — the pipeline always passes a LoadedModel,
        # but if a future caller passes something else we want to fail
        # loudly rather than silently returning a partially-mutated
        # object.
        raise TypeError(
            f"apply_calibration_to_loaded_model expected LoadedModel, "
            f"got {type(loaded_model).__name__}"
        )

    overridden_stats = MediaPipeStats(
        mean=profile.feature_mean.astype(np.float64, copy=True),
        std=profile.feature_std.astype(np.float64, copy=True),
        n=int(profile.n_samples),
        artefact_path=None,  # in-memory override, not from disk
    )

    logger.info(
        "calibration: using per-user MediaPipe stats for user_id=%s "
        "(n_samples=%d, captured_at=%s)",
        profile.user_id, profile.n_samples,
        profile.captured_at.isoformat(),
    )

    # ``LoadedModel`` is a regular dataclass (not frozen); we still
    # prefer ``dataclasses.replace`` because it returns a new instance
    # rather than mutating the cached singleton.
    return dataclasses.replace(loaded_model, mediapipe_stats=overridden_stats)


# Re-export the order constant so callers don't need to dual-import.
__all__ = [
    "CALIBRATION_SCHEMA_VERSION",
    "MIN_CALIBRATION_FRAMES",
    "MIN_CALIBRATION_STD",
    "CalibrationError",
    "CalibrationProfile",
    "CalibrationSample",
    "FEATURE_ORDER",
    "apply_calibration_to_loaded_model",
    "build_profile_from_samples",
]


# Avoid an unused-name warning when re-exporting.
_ = field  # noqa: F841
