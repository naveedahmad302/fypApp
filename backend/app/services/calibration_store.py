"""SQLite-backed persistence for per-user eye-tracking calibration profiles.

Why SQLite (and not Firebase / Firestore)
-----------------------------------------
The repo's storage convention is:

* **Firebase / Firestore** — *personal* user data (name, DOB, parent
  contact, history of assessments visible in the user's profile).
* **Backend SQLite** — intermediate ML state that is regenerated on
  demand and has no value outside of the inference pipeline.

A calibration profile is per-user feature-distribution statistics —
14 floats of mean and 14 floats of std plus a sample count and a
timestamp. It's strictly intermediate ML state (no PII), so it lives
in SQLite next to the assessment results that already use it.

Concurrency
-----------
The :func:`get_db` helper in :mod:`app.database` uses per-call
connections in WAL mode, so concurrent reads + a single writer are
safe. We use ``INSERT OR REPLACE`` for upsert semantics.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Optional

from ..database import get_db
from .eye_tracking_v2.calibration import (
    CALIBRATION_SCHEMA_VERSION,
    CalibrationProfile,
)

logger = logging.getLogger("calibration_store")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def save_profile(profile: CalibrationProfile) -> None:
    """Upsert a calibration profile keyed by ``user_id``."""
    payload = profile.to_dict()
    with get_db() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO eye_calibration_profiles
               (user_id, schema_version, profile_json, n_samples,
                captured_at, updated_at)
               VALUES (?, ?, ?, ?, ?, datetime('now'))""",
            (
                profile.user_id,
                int(profile.schema_version),
                json.dumps(payload),
                int(profile.n_samples),
                profile.captured_at.isoformat(),
            ),
        )
    logger.info(
        "calibration_store: saved profile user=%s n_samples=%d schema=%d",
        profile.user_id, profile.n_samples, profile.schema_version,
    )


def load_profile(user_id: str) -> Optional[CalibrationProfile]:
    """Return the user's calibration profile, or None.

    Profiles whose stored ``schema_version`` does not match the running
    code are treated as missing — callers fall back to the global
    ``mediapipe_stats.npz`` and ``domain_adapt`` continues to work.
    """
    with get_db() as conn:
        row = conn.execute(
            """SELECT profile_json, schema_version
               FROM eye_calibration_profiles
               WHERE user_id = ?""",
            (user_id,),
        ).fetchone()
    if row is None:
        return None
    if int(row["schema_version"]) != CALIBRATION_SCHEMA_VERSION:
        logger.info(
            "calibration_store: discarding stored profile user=%s with "
            "schema_version=%s (current=%d)",
            user_id, row["schema_version"], CALIBRATION_SCHEMA_VERSION,
        )
        return None
    try:
        return CalibrationProfile.from_dict(json.loads(row["profile_json"]))
    except (ValueError, KeyError, json.JSONDecodeError) as exc:
        logger.warning(
            "calibration_store: corrupt profile user=%s (%s); discarding",
            user_id, exc,
        )
        return None


def delete_profile(user_id: str) -> bool:
    """Remove the user's calibration profile. Returns True if a row was deleted."""
    with get_db() as conn:
        cur = conn.execute(
            "DELETE FROM eye_calibration_profiles WHERE user_id = ?",
            (user_id,),
        )
        deleted = bool(cur.rowcount)
    if deleted:
        logger.info("calibration_store: deleted profile user=%s", user_id)
    return deleted


def profile_summary(user_id: str) -> Optional[dict]:
    """Lightweight summary suitable for the GET endpoint response.

    Avoids loading and returning the (relatively large) JSON payload
    when callers only need to know whether a profile exists.
    """
    with get_db() as conn:
        row = conn.execute(
            """SELECT schema_version, n_samples, captured_at, updated_at
               FROM eye_calibration_profiles
               WHERE user_id = ?""",
            (user_id,),
        ).fetchone()
    if row is None:
        return None
    captured_at = row["captured_at"]
    if isinstance(captured_at, datetime):
        captured_at = captured_at.isoformat()
    return {
        "schema_version": int(row["schema_version"]),
        "n_samples": int(row["n_samples"]),
        "captured_at": str(captured_at),
        "updated_at": str(row["updated_at"]),
    }
