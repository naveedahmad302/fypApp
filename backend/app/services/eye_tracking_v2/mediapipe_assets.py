"""Lazy, cross-platform downloader for MediaPipe model task files.

The MediaPipe Face Landmarker / Hand Landmarker pipelines need a
``.task`` model file on disk. ``backend/setup.sh`` downloads them on
Linux, but on Windows / fresh CI / containers without that script run
the file is missing and MediaPipe raises ``Unable to open file at
<path>\\face_landmarker.task``.

To make this work everywhere with no setup step, this module ensures
the files exist next to the legacy ``eye_tracking.py`` module before
MediaPipe is initialised. If a file is missing it's downloaded once
from Google's public MediaPipe model zoo (no auth required) and cached
on disk forever.

This is the same URL ``backend/setup.sh`` uses, so the binary is
identical to whatever Linux contributors have been running with.
"""

from __future__ import annotations

import logging
import os
import tempfile
import threading
import urllib.error
import urllib.request
from pathlib import Path

logger = logging.getLogger("eye_tracking_v2.mediapipe_assets")


# Public MediaPipe model URLs (HTTPS, no auth). The "latest" path is
# stable and points at the float16 face landmarker that matches what
# the legacy pipeline was configured against in setup.sh.
_FACE_LANDMARKER_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/latest/face_landmarker.task"
)
_HAND_LANDMARKER_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
)

# Both downloads are gated by a process-wide lock so concurrent requests
# never race on the cache file.
_DOWNLOAD_LOCK = threading.Lock()


def _download_to(url: str, dst: Path) -> None:
    """Atomically download ``url`` into ``dst``.

    Writes to a temp file in the same directory and then renames so a
    crash mid-download never leaves a half-written ``.task`` file that
    MediaPipe would later try to load.
    """
    dst.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(prefix=dst.name + ".", dir=str(dst.parent))
    os.close(fd)
    tmp = Path(tmp_path)
    try:
        logger.info("Downloading MediaPipe asset %s -> %s", url, dst)
        # NOTE: nosec - the URL is a hard-coded constant pointing at
        # Google's public model storage, not a user-controlled value.
        with urllib.request.urlopen(url, timeout=60) as resp:  # noqa: S310
            with tmp.open("wb") as fh:
                while True:
                    chunk = resp.read(64 * 1024)
                    if not chunk:
                        break
                    fh.write(chunk)
        os.replace(tmp, dst)
        logger.info("Downloaded %s (%d bytes)", dst, dst.stat().st_size)
    except (urllib.error.URLError, OSError) as exc:
        # Clean up the temp file if the download failed mid-way.
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:  # pragma: no cover
                pass
        raise RuntimeError(
            f"Failed to download MediaPipe asset from {url}: {exc}. "
            "Check the backend's network access or run "
            "`backend/setup.sh` to provision the file manually."
        ) from exc


def ensure_face_landmarker(path: Path) -> Path:
    """Return ``path`` after making sure the face landmarker file exists."""
    return _ensure_one(path, _FACE_LANDMARKER_URL)


def ensure_hand_landmarker(path: Path) -> Path:
    """Return ``path`` after making sure the hand landmarker file exists."""
    return _ensure_one(path, _HAND_LANDMARKER_URL)


def _ensure_one(path: Path, url: str) -> Path:
    if path.is_file() and path.stat().st_size > 0:
        return path
    with _DOWNLOAD_LOCK:
        # Re-check under the lock so we don't double-download.
        if path.is_file() and path.stat().st_size > 0:
            return path
        _download_to(url, path)
    return path
