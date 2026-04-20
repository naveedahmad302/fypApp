"""Speech analysis service using librosa for audio feature extraction.

Analyzes speech patterns including prosody, pitch variation, speaking rate,
and pause patterns to detect potential ASD indicators such as monotone speech
and atypical prosody.
"""

import base64
import json
import subprocess
import tempfile
import uuid
from pathlib import Path

import librosa
import numpy as np

from ..database import get_db
from ..schemas.assessment import (
    AssessmentStatus,
    SpeechAnalysisResponse,
    SpeechMetrics,
)


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
        result = subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", tmp_path,
                "-ar", "22050",
                "-ac", "1",
                "-f", "wav",
                wav_path,
            ],
            capture_output=True,
            timeout=30,
        )
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


def _extract_pitch_features(y: np.ndarray, sr: int) -> dict:
    """Extract pitch (F0) features using librosa's pyin."""
    try:
        f0, voiced_flag, voiced_probs = librosa.pyin(
            y, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C7"), sr=sr
        )

        # Filter out unvoiced frames (NaN values)
        f0_voiced = f0[~np.isnan(f0)]

        if len(f0_voiced) == 0:
            return {
                "pitch_mean": 0.0,
                "pitch_std": 0.0,
                "pitch_range": 0.0,
                "voiced_fraction": 0.0,
            }

        return {
            "pitch_mean": float(np.mean(f0_voiced)),
            "pitch_std": float(np.std(f0_voiced)),
            "pitch_range": float(np.max(f0_voiced) - np.min(f0_voiced)),
            "voiced_fraction": float(np.sum(voiced_flag) / len(voiced_flag)),
        }
    except Exception:
        return {
            "pitch_mean": 0.0,
            "pitch_std": 0.0,
            "pitch_range": 0.0,
            "voiced_fraction": 0.0,
        }


def _extract_energy_features(y: np.ndarray, sr: int) -> dict:
    """Extract energy/loudness features."""
    try:
        # RMS energy
        rms = librosa.feature.rms(y=y)[0]
        # Spectral centroid (brightness)
        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]

        return {
            "energy_mean": float(np.mean(rms)),
            "energy_std": float(np.std(rms)),
            "energy_range": float(np.max(rms) - np.min(rms)),
            "spectral_centroid_mean": float(np.mean(spectral_centroid)),
        }
    except Exception:
        return {
            "energy_mean": 0.0,
            "energy_std": 0.0,
            "energy_range": 0.0,
            "spectral_centroid_mean": 0.0,
        }


def _extract_mfcc_features(y: np.ndarray, sr: int) -> dict:
    """Extract MFCC features for speech characterization."""
    try:
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        return {
            "mfcc_means": [float(x) for x in np.mean(mfccs, axis=1)],
            "mfcc_stds": [float(x) for x in np.std(mfccs, axis=1)],
        }
    except Exception:
        return {
            "mfcc_means": [0.0] * 13,
            "mfcc_stds": [0.0] * 13,
        }


def _detect_pauses(y: np.ndarray, sr: int) -> dict:
    """Detect speech pauses using energy thresholding."""
    try:
        # Calculate short-term energy
        frame_length = int(0.025 * sr)  # 25ms frames
        hop_length = int(0.010 * sr)  # 10ms hop

        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]

        # Threshold for silence detection
        silence_threshold = np.mean(rms) * 0.3

        # Find silent frames
        is_silent = rms < silence_threshold

        # Count pause durations
        pauses: list[float] = []
        current_pause = 0
        for silent in is_silent:
            if silent:
                current_pause += hop_length / sr
            elif current_pause > 0.15:  # Minimum 150ms pause
                pauses.append(current_pause)
                current_pause = 0
            else:
                current_pause = 0

        if current_pause > 0.15:
            pauses.append(current_pause)

        # Estimate speech duration (non-silent)
        speech_frames = np.sum(~is_silent)
        speech_duration = speech_frames * hop_length / sr
        total_duration = len(y) / sr

        return {
            "pause_count": len(pauses),
            "avg_pause_duration": float(np.mean(pauses)) if pauses else 0.0,
            "max_pause_duration": float(np.max(pauses)) if pauses else 0.0,
            "total_pause_duration": float(sum(pauses)),
            "speech_duration": float(speech_duration),
            "total_duration": float(total_duration),
            "speech_ratio": float(speech_duration / max(total_duration, 0.01)),
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
        }


def _estimate_speech_rate(y: np.ndarray, sr: int) -> dict:
    """Estimate speaking rate using onset detection as a proxy for syllables."""
    try:
        # Onset detection to estimate syllable count
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        onsets = librosa.onset.onset_detect(
            y=y, sr=sr, onset_envelope=onset_env, backtrack=False
        )

        duration = len(y) / sr
        syllable_count = len(onsets)

        # Rough estimate: ~1.5 syllables per word
        estimated_words = syllable_count / 1.5
        words_per_minute = (estimated_words / max(duration, 0.01)) * 60

        # Speech rate variability: std of inter-onset intervals
        if len(onsets) > 1:
            onset_times = librosa.frames_to_time(onsets, sr=sr)
            ioi = np.diff(onset_times)
            rate_variability = float(np.std(ioi) / max(np.mean(ioi), 0.01))
        else:
            rate_variability = 0.0

        return {
            "words_per_minute": round(words_per_minute, 1),
            "syllable_count": syllable_count,
            "speech_rate_variability": round(rate_variability, 3),
        }
    except Exception:
        return {
            "words_per_minute": 0.0,
            "syllable_count": 0,
            "speech_rate_variability": 0.0,
        }


def _calculate_scores(
    pitch: dict, energy: dict, pauses: dict, rate: dict
) -> dict:
    """Calculate clarity, vocal variation, prosody, and monotone scores."""
    # Clarity score (0-100): based on energy consistency and speech ratio
    energy_consistency = max(0, 1 - (energy["energy_std"] / max(energy["energy_mean"], 0.01)))
    clarity = min(100, (energy_consistency * 50 + pauses["speech_ratio"] * 50))

    # Vocal variation score (0-100): based on pitch variation
    # Normal pitch std is ~20-50Hz; lower indicates monotone
    pitch_variation_norm = min(1.0, pitch["pitch_std"] / 50.0)
    energy_variation_norm = min(1.0, energy["energy_range"] / max(energy["energy_mean"], 0.01))
    vocal_variation = min(100, (pitch_variation_norm * 60 + energy_variation_norm * 40))

    # Prosody score (0-100): combination of pitch variation, rate variability, pause patterns
    rate_score = min(1.0, rate["speech_rate_variability"] / 0.5) if rate["speech_rate_variability"] > 0 else 0
    pause_score = min(1.0, pauses["pause_count"] / 10.0) if pauses["pause_count"] > 0 else 0
    prosody = min(100, (pitch_variation_norm * 40 + rate_score * 30 + pause_score * 30))

    # Monotone score (0-100): higher = more monotone (ASD indicator)
    monotone = max(0, 100 - vocal_variation)

    return {
        "clarity_score": round(clarity, 1),
        "vocal_variation_score": round(vocal_variation, 1),
        "prosody_score": round(prosody, 1),
        "monotone_score": round(monotone, 1),
    }


def _calculate_asd_risk(
    pitch: dict, pauses: dict, rate: dict, scores: dict
) -> tuple[float, list[str]]:
    """Calculate ASD risk score and generate insights."""
    risk_factors: list[float] = []
    insights: list[str] = []

    # Monotone speech (0-30 points)
    if scores["monotone_score"] > 70:
        risk_factors.append(30.0)
        insights.append("Highly monotone speech pattern detected — significant ASD indicator")
    elif scores["monotone_score"] > 50:
        risk_factors.append(20.0)
        insights.append("Moderately monotone speech — may indicate prosody difficulties")
    elif scores["monotone_score"] > 30:
        risk_factors.append(10.0)
        insights.append("Mild monotone tendency in speech")
    else:
        risk_factors.append(0.0)
        insights.append("Good vocal variation and expressiveness")

    # Speech rate abnormality (0-25 points)
    wpm = rate["words_per_minute"]
    if wpm < 80 or wpm > 200:
        risk_factors.append(25.0)
        insights.append(f"Atypical speech rate ({wpm:.0f} words/min) — outside normal range")
    elif wpm < 100 or wpm > 170:
        risk_factors.append(15.0)
        insights.append(f"Slightly unusual speech rate ({wpm:.0f} words/min)")
    else:
        risk_factors.append(5.0)
        insights.append(f"Normal speech rate ({wpm:.0f} words/min)")

    # Pause patterns (0-25 points)
    avg_pause = pauses["avg_pause_duration"]
    if avg_pause > 2.0:
        risk_factors.append(25.0)
        insights.append("Long pauses between utterances — may indicate processing difficulties")
    elif avg_pause > 1.0:
        risk_factors.append(15.0)
        insights.append("Moderate pauses in speech")
    elif avg_pause > 0.3:
        risk_factors.append(5.0)
        insights.append("Natural pause patterns observed")
    else:
        risk_factors.append(10.0)
        insights.append("Very short pauses — may indicate rushed speech")

    # Low prosody (0-20 points)
    if scores["prosody_score"] < 30:
        risk_factors.append(20.0)
        insights.append("Low prosody score — flat intonation pattern")
    elif scores["prosody_score"] < 50:
        risk_factors.append(10.0)
    else:
        risk_factors.append(0.0)
        insights.append("Good prosody and intonation variety")

    asd_risk = min(100.0, sum(risk_factors))
    return round(asd_risk, 1), insights


def analyze_speech(
    user_id: str, audio_base64: str, audio_format: str = "wav"
) -> SpeechAnalysisResponse:
    """Main entry point: analyze speech audio and store results."""
    assessment_id = str(uuid.uuid4())

    # Create assessment record
    with get_db() as conn:
        conn.execute(
            "INSERT INTO assessments (id, user_id, type, status) VALUES (?, ?, 'speech', 'processing')",
            (assessment_id, user_id),
        )

    try:
        # Decode audio
        result = _decode_audio(audio_base64, audio_format)
        if result[0] is None:
            raise ValueError("Failed to decode audio file")

        y, sr = result

        # Extract features
        pitch = _extract_pitch_features(y, sr)
        energy = _extract_energy_features(y, sr)
        mfcc = _extract_mfcc_features(y, sr)
        pauses = _detect_pauses(y, sr)
        rate = _estimate_speech_rate(y, sr)
        scores = _calculate_scores(pitch, energy, pauses, rate)
        asd_risk, insights = _calculate_asd_risk(pitch, pauses, rate, scores)

        # Store results
        result_id = str(uuid.uuid4())
        with get_db() as conn:
            conn.execute(
                """INSERT INTO speech_results
                (id, assessment_id, words_per_minute, avg_pause_duration,
                 clarity_score, vocal_variation_score, pitch_mean, pitch_std,
                 energy_mean, speech_rate_variability, prosody_score,
                 monotone_score, asd_risk_score, mfcc_features_json, insights_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    result_id,
                    assessment_id,
                    rate["words_per_minute"],
                    pauses["avg_pause_duration"],
                    scores["clarity_score"],
                    scores["vocal_variation_score"],
                    pitch["pitch_mean"],
                    pitch["pitch_std"],
                    energy["energy_mean"],
                    rate["speech_rate_variability"],
                    scores["prosody_score"],
                    scores["monotone_score"],
                    asd_risk,
                    json.dumps(mfcc),
                    json.dumps(insights),
                ),
            )
            conn.execute(
                "UPDATE assessments SET status = 'completed', updated_at = datetime('now') WHERE id = ?",
                (assessment_id,),
            )

        return SpeechAnalysisResponse(
            assessment_id=assessment_id,
            status=AssessmentStatus.COMPLETED,
            metrics=SpeechMetrics(
                words_per_minute=rate["words_per_minute"],
                avg_pause_duration=round(pauses["avg_pause_duration"], 2),
                clarity_score=scores["clarity_score"],
                vocal_variation_score=scores["vocal_variation_score"],
                pitch_mean=round(pitch["pitch_mean"], 1),
                pitch_std=round(pitch["pitch_std"], 2),
                energy_mean=round(energy["energy_mean"], 4),
                speech_rate_variability=rate["speech_rate_variability"],
                prosody_score=scores["prosody_score"],
                monotone_score=scores["monotone_score"],
            ),
            asd_risk_score=asd_risk,
            insights=insights,
        )

    except Exception as e:
        with get_db() as conn:
            conn.execute(
                "UPDATE assessments SET status = 'failed', updated_at = datetime('now') WHERE id = ?",
                (assessment_id,),
            )
        raise RuntimeError(f"Speech analysis failed: {e}") from e
