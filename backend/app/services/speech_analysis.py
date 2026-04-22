"""Speech analysis service using librosa for audio feature extraction.

Upgraded research-grade pipeline:

* Keeps the existing decoding stack (ffmpeg + librosa.load) intact.
* Extends feature extraction with jitter / shimmer / delta-MFCC and MFCC
  self-similarity analysis.
* Adds sliding-window temporal analysis for monotone / rhythm / emotional
  flatness consistency.
* Replaces the fixed-point rule-based scoring with a weighted probabilistic
  model that emits per-behaviour likelihoods (monotone, echolalia,
  rhythm_issue, emotional_flatness), a final ASD likelihood (0-1) and a
  confidence score.

The output is designed to drive a fully dynamic UI — every visible field on
the result and report screens comes straight from this module.
"""

import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

import librosa
import numpy as np

from ..database import get_db
from ..schemas.assessment import (
    AssessmentStatus,
    BehavioralFlags,
    SpeechAnalysisResponse,
    SpeechFeatures,
    SpeechMetrics,
)


def _find_ffmpeg() -> str:
    """Find the ffmpeg binary, searching common install locations on Windows."""
    # 1. Check if it's already on PATH
    found = shutil.which("ffmpeg")
    if found:
        return found

    # 2. On Windows, search common installation directories
    if sys.platform == "win32":
        search_roots = [
            os.environ.get("LOCALAPPDATA", ""),
            os.environ.get("PROGRAMFILES", ""),
            os.environ.get("PROGRAMFILES(X86)", ""),
            os.environ.get("USERPROFILE", ""),
            "C:\\",
        ]
        for root in search_roots:
            if not root:
                continue
            root_path = Path(root)
            # Search up to 3 levels deep for ffmpeg.exe
            for pattern in ["ffmpeg*/bin/ffmpeg.exe", "*/ffmpeg*/bin/ffmpeg.exe"]:
                matches = list(root_path.glob(pattern))
                if matches:
                    print(f"[Speech] Found ffmpeg at: {matches[0]}")
                    return str(matches[0])

    # 3. Not found
    return "ffmpeg"  # Fall back to bare name (will fail with FileNotFoundError)


# Resolve ffmpeg path once at module load time
_FFMPEG_BIN = _find_ffmpeg()
print(f"[Speech] Using ffmpeg: {_FFMPEG_BIN}")


def _detect_audio_format(audio_bytes: bytes) -> str | None:
    """Detect audio format from file magic bytes."""
    if len(audio_bytes) < 12:
        return None
    # MP4/M4A: 'ftyp' at offset 4
    if audio_bytes[4:8] == b"ftyp":
        return "mp4"
    # WAV: starts with 'RIFF'
    if audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE":
        return "wav"
    # OGG: starts with 'OggS'
    if audio_bytes[:4] == b"OggS":
        return "ogg"
    # FLAC: starts with 'fLaC'
    if audio_bytes[:4] == b"fLaC":
        return "flac"
    # MP3: starts with 0xFF 0xFB or ID3 tag
    if audio_bytes[:3] == b"ID3" or (audio_bytes[0] == 0xFF and (audio_bytes[1] & 0xE0) == 0xE0):
        return "mp3"
    # AAC ADTS: starts with 0xFF 0xF1 or 0xFF 0xF9
    if audio_bytes[0] == 0xFF and (audio_bytes[1] & 0xF0) == 0xF0:
        return "aac"
    # 3GP: 'ftyp3gp' at offset 4
    if audio_bytes[4:11] == b"ftyp3gp":
        return "3gp"
    return None


def _decode_audio(audio_base64: str, audio_format: str = "wav") -> tuple[np.ndarray, int] | tuple[None, None]:
    """Decode base64 audio to numpy array using librosa.

    For non-wav formats (mp4, m4a, aac, etc.) the file is first converted to
    wav via ffmpeg so that librosa/soundfile can read it reliably.
    """
    tmp_path = None
    wav_path = None
    try:
        audio_bytes = base64.b64decode(audio_base64)
        print(f"[Speech] Decoded {len(audio_bytes)} bytes, claimed format: {audio_format}")
        print(f"[Speech] Magic bytes (hex): {audio_bytes[:16].hex()}")

        if len(audio_bytes) < 100:
            print("[Speech] Audio file too small (< 100 bytes)")
            return None, None

        # Detect actual format from magic bytes
        detected_fmt = _detect_audio_format(audio_bytes)
        if detected_fmt:
            print(f"[Speech] Detected format from magic bytes: {detected_fmt}")
            if detected_fmt != audio_format.lower():
                print(f"[Speech] Format mismatch: claimed={audio_format}, detected={detected_fmt}. Using detected.")
                audio_format = detected_fmt

        # Write to temporary file
        suffix = f".{audio_format}"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        print(f"[Speech] Wrote temp file: {tmp_path}")

        # Always convert via ffmpeg for reliability (handles all formats)
        wav_path = tmp_path + ".wav"
        try:
            result = subprocess.run(
                [
                    _FFMPEG_BIN, "-y",
                    "-i", tmp_path,
                    "-ar", "22050",
                    "-ac", "1",
                    "-f", "wav",
                    wav_path,
                ],
                capture_output=True,
                timeout=30,
            )
        except FileNotFoundError:
            print("[Speech] ffmpeg not found on this system!")
            print("[Speech] Install ffmpeg: https://ffmpeg.org/download.html")
            # Fallback: try loading directly with librosa
            print("[Speech] Attempting direct librosa load as fallback...")
            try:
                y, sr = librosa.load(tmp_path, sr=22050, mono=True)
                print(f"[Speech] Direct librosa load succeeded: {len(y)} samples @ {sr}Hz")
                return y, sr
            except Exception as e2:
                print(f"[Speech] Direct librosa load also failed: {e2}")
                return None, None

        if result.returncode != 0:
            stderr_msg = result.stderr.decode(errors="replace")
            print(f"[Speech] ffmpeg conversion failed (exit {result.returncode}):")
            print(f"[Speech]   stderr: {stderr_msg[:500]}")
            # Fallback: try loading directly with librosa (works for wav/mp3)
            print("[Speech] Attempting direct librosa load as fallback...")
            try:
                y, sr = librosa.load(tmp_path, sr=22050, mono=True)
                print(f"[Speech] Direct librosa load succeeded: {len(y)} samples @ {sr}Hz")
                return y, sr
            except Exception as e2:
                print(f"[Speech] Direct librosa load also failed: {e2}")
                return None, None
        else:
            wav_size = Path(wav_path).stat().st_size
            print(f"[Speech] ffmpeg conversion succeeded, wav size: {wav_size} bytes")

        # Load audio with librosa (resamples to 22050 Hz by default)
        y, sr = librosa.load(wav_path, sr=22050, mono=True)
        print(f"[Speech] Loaded audio: {len(y)} samples @ {sr}Hz ({len(y)/sr:.1f}s)")

        if len(y) < sr * 0.5:
            print(f"[Speech] Warning: audio very short ({len(y)/sr:.2f}s)")

        return y, sr
    except Exception as e:
        print(f"[Speech] Audio decode error: {type(e).__name__}: {e}")
        return None, None
    finally:
        # Clean up temp files
        if tmp_path is not None:
            Path(tmp_path).unlink(missing_ok=True)
        if wav_path is not None:
            Path(wav_path).unlink(missing_ok=True)



# ──────────────────────────────────────────────────────────────────────
# Low-level feature extraction
# ──────────────────────────────────────────────────────────────────────

_PITCH_FMIN = librosa.note_to_hz("C2")  # ~65 Hz
_PITCH_FMAX = librosa.note_to_hz("C7")  # ~2093 Hz


def _safe_cv(std: float, mean: float) -> float:
    """Coefficient of variation with a small guard."""
    return float(std / max(abs(mean), 1e-8))


def _extract_pitch_features(y: np.ndarray, sr: int) -> dict:
    """Extract pitch (F0) features including jitter and contour stats.

    Uses librosa.pyin to get per-frame F0 (NaN where unvoiced). We then
    compute mean / std / range over voiced frames and a jitter-like
    measure (mean absolute successive F0 difference) which captures
    pitch instability often seen in atypical prosody.
    """
    try:
        f0, voiced_flag, _voiced_probs = librosa.pyin(
            y, fmin=_PITCH_FMIN, fmax=_PITCH_FMAX, sr=sr
        )
        voiced_mask = ~np.isnan(f0)
        f0_voiced = f0[voiced_mask]

        if f0_voiced.size == 0:
            return {
                "pitch_mean": 0.0,
                "pitch_std": 0.0,
                "pitch_range": 0.0,
                "pitch_jitter": 0.0,
                "voiced_fraction": 0.0,
                "f0": f0,
                "voiced_flag": voiced_flag,
            }

        # Jitter: average absolute successive F0 difference on voiced runs.
        # We only diff inside voiced segments to avoid silence-to-voice jumps.
        jitters: list[float] = []
        run: list[float] = []
        for val in f0:
            if np.isnan(val):
                if len(run) > 1:
                    jitters.extend(np.abs(np.diff(run)).tolist())
                run = []
            else:
                run.append(float(val))
        if len(run) > 1:
            jitters.extend(np.abs(np.diff(run)).tolist())

        jitter = float(np.mean(jitters)) if jitters else 0.0

        return {
            "pitch_mean": float(np.mean(f0_voiced)),
            "pitch_std": float(np.std(f0_voiced)),
            "pitch_range": float(np.max(f0_voiced) - np.min(f0_voiced)),
            "pitch_jitter": jitter,
            "voiced_fraction": float(np.sum(voiced_flag) / max(len(voiced_flag), 1)),
            "f0": f0,
            "voiced_flag": voiced_flag,
        }
    except Exception:
        return {
            "pitch_mean": 0.0,
            "pitch_std": 0.0,
            "pitch_range": 0.0,
            "pitch_jitter": 0.0,
            "voiced_fraction": 0.0,
            "f0": np.array([]),
            "voiced_flag": np.array([]),
        }


def _extract_energy_features(y: np.ndarray, sr: int) -> dict:
    """Extract energy/loudness/brightness features and a shimmer-like measure."""
    try:
        rms = librosa.feature.rms(y=y)[0]
        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]

        mean_rms = float(np.mean(rms))
        std_rms = float(np.std(rms))
        # Shimmer-like measure: mean relative frame-to-frame RMS change.
        if rms.size > 1 and mean_rms > 1e-8:
            shimmer = float(np.mean(np.abs(np.diff(rms))) / mean_rms)
        else:
            shimmer = 0.0

        return {
            "energy_mean": mean_rms,
            "energy_std": std_rms,
            "energy_range": float(np.max(rms) - np.min(rms)) if rms.size else 0.0,
            "energy_shimmer": shimmer,
            "energy_cv": _safe_cv(std_rms, mean_rms),
            "spectral_centroid_mean": float(np.mean(spectral_centroid)),
            "spectral_centroid_std": float(np.std(spectral_centroid)),
            "rms": rms,
        }
    except Exception:
        return {
            "energy_mean": 0.0,
            "energy_std": 0.0,
            "energy_range": 0.0,
            "energy_shimmer": 0.0,
            "energy_cv": 0.0,
            "spectral_centroid_mean": 0.0,
            "spectral_centroid_std": 0.0,
            "rms": np.array([]),
        }


def _extract_mfcc_features(y: np.ndarray, sr: int) -> dict:
    """Extract MFCC statistics and detect MFCC repetition patterns.

    Returns per-coefficient mean/std for MFCC, delta and delta-delta plus a
    repetition score derived from MFCC self-similarity: the audio is split
    into short segments, we compute the segment-mean MFCC, then the cosine
    similarity between non-adjacent segments — a consistently high value
    indicates echolalia / repetitive speech.
    """
    try:
        n_mfcc = 13
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc)
        delta = librosa.feature.delta(mfccs)
        delta2 = librosa.feature.delta(mfccs, order=2)

        # Self-similarity repetition score.
        duration = len(y) / sr
        segment_sec = 1.0
        hop_sec = 0.5
        segments: list[np.ndarray] = []
        if duration >= segment_sec * 2:
            samples_per_seg = int(segment_sec * sr)
            hop_samples = int(hop_sec * sr)
            for start in range(0, len(y) - samples_per_seg + 1, hop_samples):
                chunk = y[start : start + samples_per_seg]
                chunk_mfcc = librosa.feature.mfcc(y=chunk, sr=sr, n_mfcc=n_mfcc)
                segments.append(np.mean(chunk_mfcc, axis=1))

        repetition_score = 0.0
        if len(segments) >= 3:
            seg_matrix = np.stack(segments, axis=0)
            norms = np.linalg.norm(seg_matrix, axis=1, keepdims=True)
            norms = np.where(norms < 1e-8, 1e-8, norms)
            normed = seg_matrix / norms
            sim = normed @ normed.T
            # Only consider pairs (i, j) with j >= i + 2 so we don't reward
            # adjacency (which is always similar in continuous speech).
            mask = np.triu(np.ones_like(sim, dtype=bool), k=2)
            pair_sims = sim[mask]
            if pair_sims.size:
                # Fraction of non-adjacent pairs exceeding a high-similarity
                # threshold → robust indicator of repeated phrases.
                repetition_score = float(np.mean(pair_sims > 0.92))
                # Blend with the mean similarity to keep the score continuous.
                repetition_score = float(
                    0.6 * repetition_score + 0.4 * max(0.0, float(np.mean(pair_sims)) - 0.5) * 2.0
                )
                repetition_score = float(np.clip(repetition_score, 0.0, 1.0))

        mfcc_var_overall = float(np.mean(np.std(mfccs, axis=1)))

        # Pattern classification:
        # * repetitive → echolalia-like self-similarity
        # * flat → almost no MFCC variance (robotic / monotone spectral shape)
        # * varied → healthy speech dynamics
        if repetition_score >= 0.55:
            pattern = "repetitive"
        elif mfcc_var_overall < 6.0:
            pattern = "flat"
        else:
            pattern = "varied"

        return {
            "mfcc_means": [float(x) for x in np.mean(mfccs, axis=1)],
            "mfcc_stds": [float(x) for x in np.std(mfccs, axis=1)],
            "mfcc_delta_means": [float(x) for x in np.mean(delta, axis=1)],
            "mfcc_delta_stds": [float(x) for x in np.std(delta, axis=1)],
            "mfcc_delta2_means": [float(x) for x in np.mean(delta2, axis=1)],
            "mfcc_delta2_stds": [float(x) for x in np.std(delta2, axis=1)],
            "mfcc_repetition_score": repetition_score,
            "mfcc_variance": mfcc_var_overall,
            "mfcc_pattern": pattern,
            "segment_count": len(segments),
        }
    except Exception:
        return {
            "mfcc_means": [0.0] * 13,
            "mfcc_stds": [0.0] * 13,
            "mfcc_delta_means": [0.0] * 13,
            "mfcc_delta_stds": [0.0] * 13,
            "mfcc_delta2_means": [0.0] * 13,
            "mfcc_delta2_stds": [0.0] * 13,
            "mfcc_repetition_score": 0.0,
            "mfcc_variance": 0.0,
            "mfcc_pattern": "flat",
            "segment_count": 0,
        }


def _detect_pauses(y: np.ndarray, sr: int) -> dict:
    """Detect pauses and classify the overall pause pattern.

    Goes beyond "average pause length" by bucketing pauses into hesitation
    (very short) and natural pauses, and by comparing individual pause
    durations against the distribution to flag abnormally long or irregular
    patterns.
    """
    try:
        frame_length = int(0.025 * sr)
        hop_length = int(0.010 * sr)
        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
        silence_threshold = np.mean(rms) * 0.3
        is_silent = rms < silence_threshold

        pauses: list[float] = []
        current = 0.0
        for silent in is_silent:
            if silent:
                current += hop_length / sr
            else:
                if current > 0.12:
                    pauses.append(current)
                current = 0.0
        if current > 0.12:
            pauses.append(current)

        natural = [p for p in pauses if 0.2 <= p <= 1.0]
        long_pauses = [p for p in pauses if p > 1.5]
        hesitations = [p for p in pauses if 0.12 < p < 0.25]

        speech_frames = int(np.sum(~is_silent))
        speech_duration = speech_frames * hop_length / sr
        total_duration = len(y) / sr
        speech_ratio = float(speech_duration / max(total_duration, 0.01))

        # Classify pattern.
        if not pauses:
            pattern = "rushed" if speech_ratio > 0.9 else "natural"
        else:
            long_ratio = len(long_pauses) / len(pauses)
            hesitation_ratio = len(hesitations) / len(pauses)
            pause_cv = _safe_cv(float(np.std(pauses)), float(np.mean(pauses)))
            if long_ratio > 0.25:
                pattern = "long"
            elif pause_cv > 0.9 or hesitation_ratio > 0.5:
                pattern = "irregular"
            elif speech_ratio < 0.35:
                pattern = "long"
            elif speech_ratio > 0.9 and len(natural) == 0:
                pattern = "rushed"
            else:
                pattern = "natural"

        return {
            "pause_count": len(pauses),
            "avg_pause_duration": float(np.mean(pauses)) if pauses else 0.0,
            "max_pause_duration": float(np.max(pauses)) if pauses else 0.0,
            "total_pause_duration": float(sum(pauses)),
            "speech_duration": float(speech_duration),
            "total_duration": float(total_duration),
            "speech_ratio": speech_ratio,
            "natural_pause_count": len(natural),
            "long_pause_count": len(long_pauses),
            "hesitation_count": len(hesitations),
            "pause_pattern": pattern,
            "pause_cv": _safe_cv(float(np.std(pauses)), float(np.mean(pauses))) if pauses else 0.0,
        }
    except Exception:
        return {
            "pause_count": 0,
            "avg_pause_duration": 0.0,
            "max_pause_duration": 0.0,
            "total_pause_duration": 0.0,
            "speech_duration": 0.0,
            "total_duration": 0.0,
            "speech_ratio": 0.0,
            "natural_pause_count": 0,
            "long_pause_count": 0,
            "hesitation_count": 0,
            "pause_pattern": "natural",
            "pause_cv": 0.0,
        }


def _estimate_speech_rate(y: np.ndarray, sr: int) -> dict:
    """Estimate speaking rate and its variability across the recording."""
    try:
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        onsets = librosa.onset.onset_detect(
            y=y, sr=sr, onset_envelope=onset_env, backtrack=False
        )
        duration = len(y) / sr
        syllable_count = int(len(onsets))
        estimated_words = syllable_count / 1.5
        words_per_minute = (estimated_words / max(duration, 0.01)) * 60

        if len(onsets) > 1:
            onset_times = librosa.frames_to_time(onsets, sr=sr)
            ioi = np.diff(onset_times)
            rate_variability = _safe_cv(float(np.std(ioi)), float(np.mean(ioi)))
        else:
            rate_variability = 0.0

        return {
            "words_per_minute": round(float(words_per_minute), 1),
            "syllable_count": syllable_count,
            "speech_rate_variability": round(rate_variability, 3),
            "onset_count": syllable_count,
        }
    except Exception:
        return {
            "words_per_minute": 0.0,
            "syllable_count": 0,
            "speech_rate_variability": 0.0,
            "onset_count": 0,
        }


# ──────────────────────────────────────────────────────────────────────
# Temporal (sliding window) analysis
# ──────────────────────────────────────────────────────────────────────


def _sliding_window_analysis(y: np.ndarray, sr: int) -> dict:
    """Analyse the recording in overlapping 2.5s windows (1.0s hop).

    Produces consistency measures that are critical for ASD-style speech
    signatures — e.g. "monotone in most windows" is a much stronger signal
    than "monotone on average".
    """
    win_sec = 2.5
    hop_sec = 1.0
    win = int(win_sec * sr)
    hop = int(hop_sec * sr)
    total = len(y)
    duration = total / sr

    if total < win or duration < 2.0:
        return {
            "window_count": 0,
            "monotone_consistency": 0.0,
            "rhythm_variability": 0.0,
            "flat_consistency": 0.0,
            "pitch_std_mean": 0.0,
            "energy_std_mean": 0.0,
        }

    pitch_stds: list[float] = []
    energy_stds: list[float] = []
    onset_rates: list[float] = []

    for start in range(0, total - win + 1, hop):
        seg = y[start : start + win]
        try:
            f0, _vf, _vp = librosa.pyin(seg, fmin=_PITCH_FMIN, fmax=_PITCH_FMAX, sr=sr)
            f0v = f0[~np.isnan(f0)]
            p_std = float(np.std(f0v)) if f0v.size > 5 else 0.0
        except Exception:
            p_std = 0.0
        try:
            rms = librosa.feature.rms(y=seg)[0]
            e_std = _safe_cv(float(np.std(rms)), float(np.mean(rms)))
        except Exception:
            e_std = 0.0
        try:
            onsets = librosa.onset.onset_detect(y=seg, sr=sr, backtrack=False)
            onset_rates.append(float(len(onsets)) / win_sec)
        except Exception:
            onset_rates.append(0.0)

        pitch_stds.append(p_std)
        energy_stds.append(e_std)

    window_count = len(pitch_stds)
    # Monotone: window is "monotone-ish" if pitch std is < 12 Hz.
    monotone_consistency = float(np.mean([1.0 if p < 12.0 else 0.0 for p in pitch_stds]))
    # Emotional flatness: low pitch AND low energy variation in the same window.
    flat_consistency = float(
        np.mean([
            1.0 if (pitch_stds[i] < 15.0 and energy_stds[i] < 0.25) else 0.0
            for i in range(window_count)
        ])
    )
    if onset_rates and np.mean(onset_rates) > 0:
        rhythm_cv = _safe_cv(float(np.std(onset_rates)), float(np.mean(onset_rates)))
    else:
        rhythm_cv = 0.0

    return {
        "window_count": window_count,
        "monotone_consistency": float(np.clip(monotone_consistency, 0.0, 1.0)),
        "rhythm_variability": float(np.clip(rhythm_cv, 0.0, 3.0)),
        "flat_consistency": float(np.clip(flat_consistency, 0.0, 1.0)),
        "pitch_std_mean": float(np.mean(pitch_stds)) if pitch_stds else 0.0,
        "energy_std_mean": float(np.mean(energy_stds)) if energy_stds else 0.0,
    }


# ──────────────────────────────────────────────────────────────────────
# Behavioural flags & final scoring
# ──────────────────────────────────────────────────────────────────────


def _clip01(x: float) -> float:
    return float(np.clip(x, 0.0, 1.0))


def _sigmoid_band(value: float, low: float, high: float) -> float:
    """Map `value` into [0, 1] where `low` → 0 and `high` → 1 (clipped)."""
    if high <= low:
        return 0.0
    return _clip01((value - low) / (high - low))


def _compute_behavioral_flags(
    pitch: dict,
    energy: dict,
    mfcc: dict,
    pauses: dict,
    rate: dict,
    temporal: dict,
) -> dict:
    """Combine global + temporal features into 0-1 behavioural likelihoods."""

    # --- Monotone ---------------------------------------------------
    # Low global pitch std (≤25 Hz is noticeably flat) blended with the
    # fraction of windows that are individually monotone and the MFCC
    # variance (robotic spectral shape pushes monotone up).
    global_mono = 1.0 - _sigmoid_band(pitch["pitch_std"], 8.0, 45.0)
    temporal_mono = temporal["monotone_consistency"]
    spectral_mono = 1.0 - _sigmoid_band(mfcc["mfcc_variance"], 4.0, 12.0)
    monotone = _clip01(0.45 * global_mono + 0.40 * temporal_mono + 0.15 * spectral_mono)

    # --- Echolalia (repetitive speech) ------------------------------
    # Driven primarily by MFCC self-similarity on non-adjacent segments.
    # Boosted when accompanied by low pitch variation (stereotyped prosody).
    echo_base = mfcc["mfcc_repetition_score"]
    echo_boost = 0.5 * global_mono if echo_base > 0.3 else 0.0
    echolalia = _clip01(echo_base + 0.15 * echo_boost)

    # --- Rhythm issue ------------------------------------------------
    # Either too regular (robotic) or too irregular (disfluent) is
    # atypical. Combine rate variability, inter-window rhythm CV and
    # pause CV. Also flag rushed or long pause patterns.
    rate_cv = rate.get("speech_rate_variability", 0.0)
    temporal_rhythm = temporal["rhythm_variability"]
    pause_cv = pauses.get("pause_cv", 0.0)

    too_regular = 1.0 - _sigmoid_band(rate_cv, 0.05, 0.25)
    too_irregular = _sigmoid_band(rate_cv, 0.55, 1.2)
    rhythm_component = max(too_regular * 0.6, too_irregular)

    pause_pattern = pauses.get("pause_pattern", "natural")
    pattern_bonus = {
        "natural": 0.0,
        "rushed": 0.35,
        "irregular": 0.45,
        "long": 0.4,
    }.get(pause_pattern, 0.0)

    rhythm_issue = _clip01(
        0.45 * rhythm_component
        + 0.25 * _sigmoid_band(temporal_rhythm, 0.35, 1.2)
        + 0.15 * _sigmoid_band(pause_cv, 0.5, 1.2)
        + 0.15 * pattern_bonus
    )

    # --- Emotional flatness -----------------------------------------
    # Requires simultaneously low pitch variation, low energy variation
    # AND low brightness variation (spectral centroid std). Cross-checked
    # against the temporal flat-consistency signal.
    energy_flat = 1.0 - _sigmoid_band(energy["energy_cv"], 0.2, 0.8)
    brightness_flat = 1.0 - _sigmoid_band(
        energy["spectral_centroid_std"], 150.0, 900.0
    )
    temporal_flat = temporal["flat_consistency"]
    emotional_flatness = _clip01(
        0.35 * global_mono
        + 0.25 * energy_flat
        + 0.20 * brightness_flat
        + 0.20 * temporal_flat
    )

    return {
        "monotone": round(monotone, 3),
        "echolalia": round(echolalia, 3),
        "rhythm_issue": round(rhythm_issue, 3),
        "emotional_flatness": round(emotional_flatness, 3),
    }


def _compute_feature_summary(pitch: dict, energy: dict, mfcc: dict, pauses: dict) -> dict:
    """Build the UI-facing feature summary."""
    pitch_variation = _sigmoid_band(pitch["pitch_std"], 8.0, 60.0)
    energy_variation = _sigmoid_band(energy["energy_cv"], 0.1, 0.9)
    return {
        "pitch_variation": round(pitch_variation, 3),
        "energy_variation": round(energy_variation, 3),
        "mfcc_pattern": mfcc.get("mfcc_pattern", "varied"),
        "pause_pattern": pauses.get("pause_pattern", "natural"),
    }


def _compute_legacy_scores(
    pitch: dict, energy: dict, pauses: dict, rate: dict, flags: dict
) -> dict:
    """Produce the 0-100 scores that the older UI panels still consume.

    These are derived from the same advanced signals so the numbers stay
    consistent with the new behavioural flags rather than drifting.
    """
    # Clarity: energy consistency + speech ratio.
    energy_consistency = max(0.0, 1.0 - energy["energy_cv"])
    clarity = float(np.clip(energy_consistency * 50 + pauses["speech_ratio"] * 50, 0, 100))

    # Vocal variation: blends pitch + energy variation.
    vocal_variation = float(
        np.clip(
            _sigmoid_band(pitch["pitch_std"], 8.0, 60.0) * 60
            + _sigmoid_band(energy["energy_cv"], 0.1, 0.9) * 40,
            0,
            100,
        )
    )

    # Prosody: pitch variation + rate variability + pause richness.
    rate_score = float(np.clip(_sigmoid_band(rate["speech_rate_variability"], 0.1, 0.5), 0, 1))
    pause_score = float(np.clip(pauses["pause_count"] / 10.0, 0, 1))
    prosody = float(
        np.clip(
            _sigmoid_band(pitch["pitch_std"], 8.0, 60.0) * 40
            + rate_score * 30
            + pause_score * 30,
            0,
            100,
        )
    )

    # Monotone on a 0-100 scale derived from the behavioural flag so that
    # the existing UI bar stays in lock-step with the upgraded model.
    monotone = round(flags["monotone"] * 100, 1)

    return {
        "clarity_score": round(clarity, 1),
        "vocal_variation_score": round(vocal_variation, 1),
        "prosody_score": round(prosody, 1),
        "monotone_score": monotone,
    }


_FLAG_WEIGHTS = {
    "monotone": 0.30,
    "emotional_flatness": 0.25,
    "echolalia": 0.25,
    "rhythm_issue": 0.20,
}


def _compute_final_likelihood(
    flags: dict, pauses: dict, rate: dict, pitch: dict
) -> tuple[float, float]:
    """Weighted probabilistic ASD likelihood and a confidence score (both 0-1).

    Confidence is a function of audio length, voiced fraction and
    detected onset count — short/silent/noisy recordings get lower
    confidence regardless of the raw likelihood value.
    """
    likelihood = sum(flags[k] * w for k, w in _FLAG_WEIGHTS.items())

    # Rate gate: extremely slow or fast speech adds a small amount.
    wpm = rate.get("words_per_minute", 0.0)
    if wpm > 0:
        if wpm < 70 or wpm > 220:
            likelihood += 0.08
        elif wpm < 90 or wpm > 190:
            likelihood += 0.04

    # Very long average pauses push likelihood up a little.
    if pauses.get("avg_pause_duration", 0.0) > 1.5:
        likelihood += 0.05

    likelihood = _clip01(likelihood)

    duration = pauses.get("total_duration", 0.0)
    voiced_fraction = pitch.get("voiced_fraction", 0.0)
    onset_count = rate.get("onset_count", 0)

    duration_conf = _sigmoid_band(duration, 1.0, 6.0)
    voiced_conf = _sigmoid_band(voiced_fraction, 0.1, 0.55)
    onset_conf = _sigmoid_band(float(onset_count), 3.0, 25.0)
    confidence = _clip01(0.45 * duration_conf + 0.35 * voiced_conf + 0.20 * onset_conf)

    return round(likelihood, 3), round(confidence, 3)


def _build_explanation(flags: dict, features: dict, rate: dict) -> str:
    """Produce a short, high-signal explanation from the strongest flags."""
    labels = {
        "monotone": "monotone prosody",
        "echolalia": "repetitive MFCC patterns",
        "rhythm_issue": "irregular speech rhythm",
        "emotional_flatness": "emotional flatness",
    }
    sorted_flags = sorted(flags.items(), key=lambda kv: kv[1], reverse=True)
    strongest = [labels[k] for k, v in sorted_flags if v >= 0.5]
    parts: list[str] = []
    if strongest:
        parts.append("Dominant signals: " + ", ".join(strongest) + ".")
    if features["mfcc_pattern"] == "repetitive":
        parts.append("MFCC self-similarity indicates repeated phrases.")
    elif features["mfcc_pattern"] == "flat":
        parts.append("MFCC spectrum is unusually flat.")
    if features["pause_pattern"] != "natural":
        parts.append(f"Pause pattern classified as {features['pause_pattern']}.")
    wpm = rate.get("words_per_minute", 0.0)
    if wpm:
        if wpm < 90 or wpm > 190:
            parts.append(f"Speech rate of {wpm:.0f} wpm is outside the typical range.")
    if not parts:
        parts.append("Speech features look within typical ranges.")
    return " ".join(parts)


def _build_insights(flags: dict, features: dict, metrics: dict) -> list[str]:
    """Legacy bullet-point insights, derived from the new model."""
    out: list[str] = []
    if flags["monotone"] >= 0.6:
        out.append("Highly monotone speech pattern detected — significant ASD indicator.")
    elif flags["monotone"] >= 0.35:
        out.append("Moderately monotone speech — may indicate prosody difficulties.")
    else:
        out.append("Good vocal variation and expressiveness.")

    if flags["echolalia"] >= 0.5:
        out.append("Repetitive speech segments detected (possible echolalia).")
    if flags["rhythm_issue"] >= 0.5:
        out.append("Irregular speech rhythm — onset intervals vary abnormally.")
    if flags["emotional_flatness"] >= 0.5:
        out.append("Emotional flatness detected across pitch and energy contours.")

    wpm = metrics.get("words_per_minute", 0.0)
    if wpm:
        if wpm < 80 or wpm > 200:
            out.append(f"Atypical speech rate ({wpm:.0f} words/min) — outside normal range.")
        elif wpm < 100 or wpm > 170:
            out.append(f"Slightly unusual speech rate ({wpm:.0f} words/min).")
        else:
            out.append(f"Normal speech rate ({wpm:.0f} words/min).")

    if features["pause_pattern"] == "long":
        out.append("Long pauses between utterances — may indicate processing difficulties.")
    elif features["pause_pattern"] == "irregular":
        out.append("Irregular pause distribution observed.")
    elif features["pause_pattern"] == "rushed":
        out.append("Very short pauses — may indicate rushed speech.")
    else:
        out.append("Natural pause patterns observed.")

    return out


# ──────────────────────────────────────────────────────────────────────
# Public entry point
# ──────────────────────────────────────────────────────────────────────


def analyze_speech(
    user_id: str, audio_base64: str, audio_format: str = "wav"
) -> SpeechAnalysisResponse:
    """Main entry point: analyze speech audio and store results."""
    assessment_id = str(uuid.uuid4())

    with get_db() as conn:
        conn.execute(
            "INSERT INTO assessments (id, user_id, type, status) VALUES (?, ?, 'speech', 'processing')",
            (assessment_id, user_id),
        )

    try:
        y, sr = _decode_audio(audio_base64, audio_format)
        if y is None or sr is None:
            raise ValueError("Failed to decode audio file")

        pitch = _extract_pitch_features(y, sr)
        energy = _extract_energy_features(y, sr)
        mfcc = _extract_mfcc_features(y, sr)
        pauses = _detect_pauses(y, sr)
        rate = _estimate_speech_rate(y, sr)
        temporal = _sliding_window_analysis(y, sr)

        flags = _compute_behavioral_flags(pitch, energy, mfcc, pauses, rate, temporal)
        features = _compute_feature_summary(pitch, energy, mfcc, pauses)
        legacy_scores = _compute_legacy_scores(pitch, energy, pauses, rate, flags)
        likelihood, confidence = _compute_final_likelihood(flags, pauses, rate, pitch)

        duration_sec = float(pauses.get("total_duration", 0.0)) or float(len(y) / sr)
        speech_detected = (
            pitch.get("voiced_fraction", 0.0) > 0.05
            and rate.get("onset_count", 0) >= 2
            and duration_sec >= 0.5
        )

        asd_risk_score = round(likelihood * 100.0, 1)
        metrics_payload = {
            "words_per_minute": rate["words_per_minute"],
            "avg_pause_duration": round(pauses["avg_pause_duration"], 2),
            "clarity_score": legacy_scores["clarity_score"],
            "vocal_variation_score": legacy_scores["vocal_variation_score"],
            "pitch_mean": round(pitch["pitch_mean"], 1),
            "pitch_std": round(pitch["pitch_std"], 2),
            "energy_mean": round(energy["energy_mean"], 4),
            "speech_rate_variability": rate["speech_rate_variability"],
            "prosody_score": legacy_scores["prosody_score"],
            "monotone_score": legacy_scores["monotone_score"],
            "pitch_jitter": round(pitch["pitch_jitter"], 2),
            "energy_shimmer": round(energy["energy_shimmer"], 4),
            "pause_count": int(pauses["pause_count"]),
            "hesitation_count": int(pauses["hesitation_count"]),
            "voiced_fraction": round(pitch["voiced_fraction"], 3),
            "duration_sec": round(duration_sec, 2),
            "temporal_monotone_consistency": round(temporal["monotone_consistency"], 3),
            "rhythm_variability": round(temporal["rhythm_variability"], 3),
        }
        insights = _build_insights(flags, features, metrics_payload)
        explanation = _build_explanation(flags, features, rate)

        mfcc_storage = {
            "mfcc_means": mfcc["mfcc_means"],
            "mfcc_stds": mfcc["mfcc_stds"],
            "mfcc_delta_means": mfcc["mfcc_delta_means"],
            "mfcc_delta_stds": mfcc["mfcc_delta_stds"],
            "mfcc_delta2_means": mfcc["mfcc_delta2_means"],
            "mfcc_delta2_stds": mfcc["mfcc_delta2_stds"],
            "mfcc_repetition_score": mfcc["mfcc_repetition_score"],
            "mfcc_variance": mfcc["mfcc_variance"],
            "mfcc_pattern": mfcc["mfcc_pattern"],
            "segment_count": mfcc["segment_count"],
        }

        result_id = str(uuid.uuid4())
        with get_db() as conn:
            conn.execute(
                """INSERT INTO speech_results
                (id, assessment_id, words_per_minute, avg_pause_duration,
                 clarity_score, vocal_variation_score, pitch_mean, pitch_std,
                 energy_mean, speech_rate_variability, prosody_score,
                 monotone_score, asd_risk_score, mfcc_features_json, insights_json,
                 features_json, behavioral_flags_json, final_asd_likelihood,
                 confidence, explanation, speech_detected, pitch_jitter,
                 energy_shimmer, voiced_fraction, duration_sec, pause_count,
                 hesitation_count, temporal_monotone_consistency, rhythm_variability)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    result_id,
                    assessment_id,
                    rate["words_per_minute"],
                    pauses["avg_pause_duration"],
                    legacy_scores["clarity_score"],
                    legacy_scores["vocal_variation_score"],
                    pitch["pitch_mean"],
                    pitch["pitch_std"],
                    energy["energy_mean"],
                    rate["speech_rate_variability"],
                    legacy_scores["prosody_score"],
                    legacy_scores["monotone_score"],
                    asd_risk_score,
                    json.dumps(mfcc_storage),
                    json.dumps(insights),
                    json.dumps(features),
                    json.dumps(flags),
                    likelihood,
                    confidence,
                    explanation,
                    1 if speech_detected else 0,
                    pitch["pitch_jitter"],
                    energy["energy_shimmer"],
                    pitch["voiced_fraction"],
                    duration_sec,
                    int(pauses["pause_count"]),
                    int(pauses["hesitation_count"]),
                    temporal["monotone_consistency"],
                    temporal["rhythm_variability"],
                ),
            )
            conn.execute(
                "UPDATE assessments SET status = 'completed', updated_at = datetime('now') WHERE id = ?",
                (assessment_id,),
            )

        return SpeechAnalysisResponse(
            assessment_id=assessment_id,
            status=AssessmentStatus.COMPLETED,
            speech_detected=speech_detected,
            metrics=SpeechMetrics(**metrics_payload),
            features=SpeechFeatures(**features),
            behavioral_flags=BehavioralFlags(**flags),
            asd_risk_score=asd_risk_score,
            final_asd_likelihood=likelihood,
            confidence=confidence,
            explanation=explanation,
            insights=insights,
        )

    except Exception as e:
        with get_db() as conn:
            conn.execute(
                "UPDATE assessments SET status = 'failed', updated_at = datetime('now') WHERE id = ?",
                (assessment_id,),
            )
        raise RuntimeError(f"Speech analysis failed: {e}") from e
