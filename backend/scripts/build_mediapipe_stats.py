"""Generate ``mediapipe_stats.npz`` — per-feature mean/std for the
MediaPipe-derived 14-vector distribution.

Why this exists
---------------
The trained eye-tracking MLP (``autism_model_weights.npz`` +
``scaler.pkl``) was fit on real eye-tracker hardware data, but our
deployment feeds it MediaPipe-derived approximations from a webcam.
The two distributions disagree by several σ on every feature — see
``docs/PRODUCTION.md`` §10 and the README under
``backend/app/models/eye_model_v1``.

The ``domain_adapt`` preprocessing mode (added in PR-G) addresses this
mismatch with a per-feature affine transform::

    x_adapted = (x_raw - mp_mean) / mp_std * trained_std + trained_mean

The trained side comes straight from ``scaler.pkl`` (its ``mean_`` and
``scale_`` attributes). The MediaPipe side has to be sampled —
that's what this script produces.

How the sample is built
-----------------------
We synthesise plausible head poses by varying:

* head x/y position relative to the camera centre (lateral movement),
* head z (depth), spanning typical tablet-distance values,
* iris offset (gaze direction) within an ellipse shaped by the eye
  corners.

For each pose we produce the 14-vector and accumulate it. The pose
distribution is intentionally broad (uniform over a generous gaze
field) so the stats represent "MediaPipe used by a child looking
around at a tablet", not a single fixed pose.

Output
------
``backend/app/models/eye_model_v1/mediapipe_stats.npz`` with keys:

* ``mean``   — shape (14,), float64
* ``std``    — shape (14,), float64
* ``n``      — int, sample count used
* ``schema`` — bytes, JSON-encoded column order for cross-checking

The artefact is checked into the repo so domain_adapt works on a fresh
clone without re-running this script. Re-run it if you tune
``AdapterConfig`` constants or if you have a real recording of
representative MediaPipe sessions.

Run
---
::

    python -m backend.scripts.build_mediapipe_stats
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from types import SimpleNamespace

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.app.services.eye_tracking_v2 import (  # noqa: E402
    DEFAULT_ADAPTER_CONFIG,
    FEATURE_ORDER,
    landmarks_to_feature_vector,
)
from backend.app.services.eye_tracking_v2.config import MODEL_ROOT  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(name)s | %(message)s")
log = logging.getLogger("build_mediapipe_stats")


def _make_landmarks(
    head_cx: float,
    head_cy: float,
    head_z: float,
    iris_dx: float,
    iris_dy: float,
) -> list[SimpleNamespace]:
    """Build a 478-point landmark list with the gaze-relevant indices set.

    Coordinates follow MediaPipe's convention: x/y in [0, 1] across the
    image, z roughly in [-0.05, 0.05] for a head close to the camera.
    """
    pts = [SimpleNamespace(x=0.5, y=0.5, z=0.0) for _ in range(478)]
    # Eye corners — image-left is the user's right side.
    pts[33] = SimpleNamespace(x=head_cx - 0.10, y=head_cy, z=head_z)
    pts[133] = SimpleNamespace(x=head_cx - 0.04, y=head_cy, z=head_z)
    pts[362] = SimpleNamespace(x=head_cx + 0.04, y=head_cy, z=head_z)
    pts[263] = SimpleNamespace(x=head_cx + 0.10, y=head_cy, z=head_z)
    # User's left iris cluster (468-472)
    left_x = head_cx + 0.07 + iris_dx * 0.025
    left_y = head_cy + iris_dy * 0.020
    for i in (468, 469, 470, 471, 472):
        pts[i] = SimpleNamespace(x=left_x, y=left_y, z=head_z)
    # User's right iris cluster (473-477)
    right_x = head_cx - 0.07 + iris_dx * 0.025
    right_y = head_cy + iris_dy * 0.020
    for i in (473, 474, 475, 476, 477):
        pts[i] = SimpleNamespace(x=right_x, y=right_y, z=head_z)
    return pts


def sample_distribution(n_samples: int, seed: int = 0xA5D) -> np.ndarray:
    """Draw ``n_samples`` synthetic 14-vectors from the MediaPipe regime."""
    rng = np.random.default_rng(seed)
    out = np.zeros((n_samples, 14), dtype=np.float64)

    # Per-axis distributions chosen to cover plausible webcam capture:
    #   head_cx, head_cy ~ small Gaussian around frame centre
    #   head_z           ~ uniform across "head closer to" / "further from" camera
    #   iris_dx, iris_dy ~ uniform within unit square (gaze direction)
    head_cx = rng.normal(0.5, 0.04, n_samples).clip(0.35, 0.65)
    head_cy = rng.normal(0.5, 0.04, n_samples).clip(0.35, 0.65)
    head_z = rng.uniform(-0.06, 0.04, n_samples)
    iris_dx = rng.uniform(-1.0, 1.0, n_samples)
    iris_dy = rng.uniform(-0.6, 0.6, n_samples)

    written = 0
    for i in range(n_samples):
        pts = _make_landmarks(
            head_cx[i], head_cy[i], head_z[i], iris_dx[i], iris_dy[i]
        )
        fv = landmarks_to_feature_vector(
            pts, frame_w=640, frame_h=480, frame_index=i,
            config=DEFAULT_ADAPTER_CONFIG,
        )
        if fv is None:
            continue
        out[written] = fv.values
        written += 1
    return out[:written]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--n", type=int, default=4096, help="number of synthetic samples"
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=MODEL_ROOT / "mediapipe_stats.npz",
        help="output path",
    )
    args = parser.parse_args()

    log.info("Sampling %d synthetic MediaPipe poses…", args.n)
    samples = sample_distribution(args.n)
    log.info("Got %d valid 14-vectors", samples.shape[0])

    if samples.shape[0] < 100:
        raise RuntimeError(
            "Too few valid samples to build robust stats; check the "
            "adapter or increase --n."
        )

    mean = samples.mean(axis=0)
    std = samples.std(axis=0)

    # Floor std to avoid zero-divides when the distribution is thin on
    # an axis (e.g. user always at the same depth).
    std = np.where(std < 1e-3, 1.0, std)

    log.info("Saving stats to %s", args.out)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    np.savez(
        args.out,
        mean=mean,
        std=std,
        n=np.array([samples.shape[0]], dtype=np.int64),
        schema=np.array(
            [json.dumps(list(FEATURE_ORDER))], dtype=object
        ),
    )

    # Print a table for quick visual sanity-checking.
    log.info("Per-feature MediaPipe stats:")
    for name, m, s in zip(FEATURE_ORDER, mean, std):
        log.info("  %-22s mean=%10.3f  std=%10.3f", name, m, s)


if __name__ == "__main__":
    main()
