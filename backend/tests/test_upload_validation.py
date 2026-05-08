"""Tests for the magic-byte upload validators."""

from __future__ import annotations

import base64

import pytest
from fastapi import HTTPException

from app.upload_validation import (
    validate_audio_upload,
    validate_image_frame,
    validate_image_frames,
)


# ---------------------------------------------------------------------------
# Audio
# ---------------------------------------------------------------------------


def _b64(blob: bytes) -> str:
    return base64.b64encode(blob).decode("ascii")


def test_wav_with_correct_header_passes():
    wav = b"RIFF" + b"\x00\x00\x00\x00" + b"WAVE" + b"\x00" * 8
    assert validate_audio_upload(_b64(wav), "wav") == "wav"


def test_mp3_with_id3_tag_passes():
    mp3 = b"ID3\x03\x00\x00" + b"\x00" * 12
    assert validate_audio_upload(_b64(mp3), "mp3") == "mp3"


def test_mp3_with_raw_frame_sync_passes():
    mp3 = b"\xff\xfb\x90\x44" + b"\x00" * 12
    assert validate_audio_upload(_b64(mp3), "mp3") == "mp3"


def test_m4a_passes_as_canonical_m4a():
    # ISO-BMFF: 4-byte size, then 'ftyp' at offset 4.
    m4a = b"\x00\x00\x00\x20" + b"ftypM4A " + b"\x00" * 8
    assert validate_audio_upload(_b64(m4a), "m4a") == "m4a"
    # Same payload with declared "mp4" is normalised.
    assert validate_audio_upload(_b64(m4a), "mp4") == "m4a"


def test_audio_format_mismatch_is_rejected():
    wav = b"RIFF" + b"\x00\x00\x00\x00" + b"WAVE" + b"\x00" * 8
    with pytest.raises(HTTPException) as exc:
        validate_audio_upload(_b64(wav), "mp3")
    assert exc.value.status_code == 415


def test_unknown_audio_format_is_rejected():
    with pytest.raises(HTTPException) as exc:
        validate_audio_upload(_b64(b"RIFFxxxxWAVE........"), "ogg")
    assert exc.value.status_code == 415


def test_truncated_payload_is_rejected():
    """A 4-byte WAV header alone isn't enough — needs RIFF…WAVE."""
    with pytest.raises(HTTPException):
        validate_audio_upload(_b64(b"RIFF"), "wav")


def test_malformed_base64_is_rejected():
    with pytest.raises(HTTPException) as exc:
        validate_audio_upload("not%base64!@#", "wav")
    assert exc.value.status_code == 400


def test_empty_payload_is_rejected():
    with pytest.raises(HTTPException) as exc:
        validate_audio_upload("", "wav")
    assert exc.value.status_code == 400


def test_attacker_payload_named_wav_is_rejected():
    """A txt/script payload labelled 'wav' must be detected."""
    payload = b"#!/bin/sh\necho pwn\n" + b"\x00" * 16
    with pytest.raises(HTTPException) as exc:
        validate_audio_upload(_b64(payload), "wav")
    assert exc.value.status_code == 415


# ---------------------------------------------------------------------------
# Image frames
# ---------------------------------------------------------------------------


def _jpeg_blob() -> bytes:
    return b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"\x00" * 32


def _png_blob() -> bytes:
    return b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def test_jpeg_frame_is_accepted():
    assert validate_image_frame(_b64(_jpeg_blob())) == "jpeg"


def test_png_frame_is_accepted():
    assert validate_image_frame(_b64(_png_blob())) == "png"


def test_gif_frame_is_rejected():
    gif = b"GIF89a\x00\x00\x00\x00" + b"\x00" * 16
    with pytest.raises(HTTPException) as exc:
        validate_image_frame(_b64(gif))
    assert exc.value.status_code == 415


def test_random_payload_as_frame_is_rejected():
    with pytest.raises(HTTPException) as exc:
        validate_image_frame(_b64(b"hello world hello world"))
    assert exc.value.status_code == 415


def test_uniform_frame_batch_passes():
    frames = [_b64(_jpeg_blob()) for _ in range(5)]
    validate_image_frames(frames)


def test_mixed_frame_batch_is_rejected():
    frames = [_b64(_jpeg_blob()), _b64(_png_blob())]
    with pytest.raises(HTTPException) as exc:
        validate_image_frames(frames)
    assert exc.value.status_code == 415


def test_empty_frame_batch_is_rejected():
    with pytest.raises(HTTPException) as exc:
        validate_image_frames([])
    assert exc.value.status_code == 400


def test_first_frame_invalid_kills_batch_immediately():
    frames = [_b64(b"junkjunkjunk!"), _b64(_jpeg_blob())]
    with pytest.raises(HTTPException):
        validate_image_frames(frames)
