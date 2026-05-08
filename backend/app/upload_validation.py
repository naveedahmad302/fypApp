"""Magic-byte validation for base64-encoded uploads.

Filename / declared format strings are attacker-controlled, so we
verify the *actual* container of every uploaded blob against a small
allow-list of magic numbers. This catches:

* a malicious client claiming ``audio_format="wav"`` while uploading
  a script payload to confuse a downstream parser,
* honest clients whose recorder mis-tags the file (saw this with the
  Android emulator silently producing ``mp4``-wrapped AAC),
* truncated uploads that were never a valid container to begin with.

We accept the smallest set of formats actually shipped by the app:

* WAV  — ``RIFF...WAVE``
* MP3  — ``ID3`` tag, or a raw MPEG-1/2 Layer III frame sync.
* MP4 / M4A — ISO BMFF ``ftyp`` box. ``M4A`` is just ``MP4`` with an
  audio-only ``ftypM4A`` brand.

For image frames we accept JPEG and PNG only — both magic numbers are
unambiguous. Any other byte sequence (even a base64 of a perfectly
valid GIF) is rejected so attackers can't tunnel arbitrary content
through the eye-tracking endpoint.
"""

from __future__ import annotations

import base64
import binascii
import logging
from typing import Iterable

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


# Number of header bytes we need to discriminate every supported
# audio/image format. Decoding only this many bytes lets us reject
# bogus uploads cheaply, before allocating memory for the full payload.
_AUDIO_HEADER_BYTES = 16
_IMAGE_HEADER_BYTES = 12

_AUDIO_ALLOWED_FORMATS = {"wav", "mp3", "m4a", "mp4"}
_IMAGE_ALLOWED_KINDS = {"jpeg", "png"}


def _decode_header(data: str, max_bytes: int) -> bytes:
    """Decode just enough base64 to read the magic header.

    Pads strict to multiple of 4 with ``=``. Raises 422 on any
    malformed base64 — better to fail fast than to feed garbage to a
    DSP library that may swallow it silently.
    """
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty upload payload.",
        )

    # Take just enough characters to cover ``max_bytes`` of decoded
    # output. base64 is 4 chars -> 3 bytes, so multiply.
    needed = ((max_bytes + 2) // 3) * 4
    head = data[:needed]
    pad = (-len(head)) % 4
    head += "=" * pad

    try:
        return base64.b64decode(head, validate=True)[:max_bytes]
    except (binascii.Error, ValueError) as exc:
        logger.warning("Rejected upload: malformed base64 (%s)", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload is not valid base64.",
        ) from exc


def _starts_with_any(blob: bytes, magics: Iterable[bytes]) -> bool:
    return any(blob.startswith(m) for m in magics)


def _is_mp3(blob: bytes) -> bool:
    if blob.startswith(b"ID3"):
        return True
    # Frame sync = 11 set bits at start of frame: 0xFF E0+ at byte 0.
    return len(blob) >= 2 and blob[0] == 0xFF and (blob[1] & 0xE0) == 0xE0


def _is_mp4(blob: bytes) -> bool:
    """MP4 / M4A — ISO BMFF: ``[size:4]`` then ``ftyp`` at offset 4."""
    return len(blob) >= 8 and blob[4:8] == b"ftyp"


def _is_wav(blob: bytes) -> bool:
    return len(blob) >= 12 and blob[:4] == b"RIFF" and blob[8:12] == b"WAVE"


def validate_audio_upload(audio_base64: str, declared_format: str) -> str:
    """Verify the audio payload's magic header.

    Returns the canonicalised format string ("wav" / "mp3" / "m4a"),
    which downstream code uses as the file extension when persisting
    the buffer. Raises 415 on mismatch.
    """
    fmt = (declared_format or "").lower().strip()
    if fmt not in _AUDIO_ALLOWED_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported audio format.",
        )

    header = _decode_header(audio_base64, _AUDIO_HEADER_BYTES)

    if fmt == "wav" and _is_wav(header):
        return "wav"
    if fmt == "mp3" and _is_mp3(header):
        return "mp3"
    if fmt in {"m4a", "mp4"} and _is_mp4(header):
        # Normalise to ``m4a`` so the persistence layer always picks the
        # same extension regardless of which platform recorded it.
        return "m4a"

    logger.warning(
        "Audio magic-byte mismatch: declared=%s header=%s",
        fmt,
        header.hex(" ", 1)[:48],
    )
    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail="Audio payload does not match declared format.",
    )


# Image magics — sufficient to discriminate JPEG / PNG. We do not
# accept GIF / BMP / WEBP / etc. because the eye-tracking adapter
# only ever feeds JPEG/PNG into MediaPipe.
_JPEG_MAGIC = (b"\xff\xd8\xff",)
_PNG_MAGIC = (b"\x89PNG\r\n\x1a\n",)


def validate_image_frame(frame_base64: str) -> str:
    """Return the detected image kind ("jpeg" / "png") or raise 415."""
    header = _decode_header(frame_base64, _IMAGE_HEADER_BYTES)
    if _starts_with_any(header, _JPEG_MAGIC):
        return "jpeg"
    if _starts_with_any(header, _PNG_MAGIC):
        return "png"
    logger.warning("Image magic-byte mismatch: header=%s", header.hex(" ", 1)[:36])
    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail="Frame is not a JPEG or PNG image.",
    )


def validate_image_frames(frames: list[str]) -> None:
    """Check every frame in the request. Stops on first invalid frame.

    We don't allow mixed-format batches; the first frame's kind sets
    the expectation for the rest. This guards against an attacker
    stuffing one JPEG followed by 299 garbage payloads to bypass
    per-frame inspection.
    """
    if not frames:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No frames supplied.",
        )

    expected_kind = validate_image_frame(frames[0])
    for index, frame in enumerate(frames[1:], start=1):
        kind = validate_image_frame(frame)
        if kind != expected_kind:
            logger.warning(
                "Mixed-format frame batch rejected at index=%d (expected=%s got=%s)",
                index,
                expected_kind,
                kind,
            )
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="All frames must share the same image format.",
            )
