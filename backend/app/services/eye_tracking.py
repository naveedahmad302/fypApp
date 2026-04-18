"""Advanced eye tracking analysis service using MediaPipe Face Landmarker.

Analyzes gaze patterns, fixation duration, saccade dynamics, blink rate,
and other eye metrics to screen for potential ASD indicators.

Based on published research on oculomotor differences in ASD:
  - Klin et al. (2002): reduced attention to eyes in social scenes
  - Pelphrey et al. (2002): atypical scanpath patterns
  - Dalton et al. (2005): gaze fixation and amygdala activation
  - Shic et al. (2011): fixation duration differences in ASD
  - Frazier et al. (2017): saccade metrics as ASD biomarkers

IMPORTANT DISCLAIMER: This is a screening tool only. It does NOT diagnose
ASD. Only qualified clinical professionals can diagnose autism spectrum
disorder through comprehensive evaluation. Results should be interpreted
as indicators that may warrant further professional assessment.
"""

import base64
import json
import math
import os
import uuid
from typing import Optional

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import (
    FaceLandmarker,
    FaceLandmarkerOptions,
    RunningMode,
)

from ..database import get_db
from ..schemas.assessment import (
    AssessmentStatus,
    EyeTrackingResponse,
    GazeMetrics,
)

# Path to the face landmarker model
MODEL_PATH = os.path.join(os.path.dirname(__file__), "face_landmarker.task")

# ---------------------------------------------------------------------------
# MediaPipe Face Mesh landmark indices
# ---------------------------------------------------------------------------
LEFT_EYE_EAR = [33, 160, 158, 133, 153, 144]  # 6 key points for EAR
RIGHT_EYE_EAR = [362, 385, 387, 263, 373, 380]
LEFT_IRIS = [468, 469, 470, 471, 472]  # iris centre + ring
RIGHT_IRIS = [473, 474, 475, 476, 477]
NOSE_TIP = 1  # face-centre reference
LEFT_EYE_OUTER = 33
LEFT_EYE_INNER = 133
RIGHT_EYE_INNER = 362
RIGHT_EYE_OUTER = 263

# ---------------------------------------------------------------------------
# Timing -- must match the frontend capture interval
# ---------------------------------------------------------------------------
FRAME_INTERVAL_S = 0.5  # frontend captures one frame every 500 ms

# ---------------------------------------------------------------------------
# Thresholds calibrated from ASD eye-tracking literature
# ---------------------------------------------------------------------------
BLINK_EAR_THRESHOLD = 0.21  # Soukupova & Cech, 2016
FIXATION_THRESHOLD_RATIO = 0.15  # normalised by inter-ocular distance
NORMAL_BLINK_RATE_LOW = 12.0  # Bentivoglio et al. 1997
NORMAL_BLINK_RATE_HIGH = 22.0


# ===================================================================
# Helper functions
# ===================================================================


def _decode_frame(base64_str: str) -> Optional[np.ndarray]:
    """Decode a base64-encoded image frame to BGR numpy array."""
    try:
        img_bytes = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return frame
    except Exception:
        return None


def _pt(landmarks: list, idx: int, w: int, h: int) -> tuple[float, float]:
    """Extract pixel (x, y) from a NormalizedLandmark."""
    lm = landmarks[idx]
    return (lm.x * w, lm.y * h)


def _dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Euclidean distance between two 2-D points."""
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)


def _ear(eye_pts: list[tuple[float, float]]) -> float:
    """Eye Aspect Ratio (Soukupova & Cech 2016).

    EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
    """
    if len(eye_pts) < 6:
        return 0.0
    p1, p2, p3, p4, p5, p6 = eye_pts[:6]
    vert1 = _dist(p2, p6)
    vert2 = _dist(p3, p5)
    horiz = _dist(p1, p4)
    if horiz < 1e-6:
        return 0.0
    return (vert1 + vert2) / (2.0 * horiz)


def _gaze_ratio(
    iris_center: tuple[float, float],
    eye_inner: tuple[float, float],
    eye_outer: tuple[float, float],
) -> float:
    """Horizontal gaze ratio: 0 = outer, 0.5 = centre, 1 = inner."""
    width = _dist(eye_inner, eye_outer)
    if width < 1e-6:
        return 0.5
    ratio = _dist(iris_center, eye_outer) / width
    return max(0.0, min(1.0, ratio))


def _sigmoid(x: float, midpoint: float, steepness: float) -> float:
    """Logistic sigmoid mapped to [0, 1]."""
    z = steepness * (x - midpoint)
    z = max(-500.0, min(500.0, z))
    return 1.0 / (1.0 + math.exp(-z))


def _create_landmarker() -> FaceLandmarker:
    """Create a MediaPipe FaceLandmarker (IMAGE mode, single face)."""
    options = FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=RunningMode.IMAGE,
        num_faces=1,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
    )
    return FaceLandmarker.create_from_options(options)


# ===================================================================
# Per-frame feature extraction
# ===================================================================


class _FrameFeatures:
    """Features extracted from a single frame."""

    __slots__ = (
        "gaze_x", "gaze_y", "left_ear", "right_ear", "avg_ear",
        "left_gaze_ratio", "right_gaze_ratio", "avg_gaze_ratio",
        "inter_ocular_dist", "nose_x", "nose_y",
    )

    def __init__(self) -> None:
        self.gaze_x = 0.0
        self.gaze_y = 0.0
        self.left_ear = 0.0
        self.right_ear = 0.0
        self.avg_ear = 0.0
        self.left_gaze_ratio = 0.5
        self.right_gaze_ratio = 0.5
        self.avg_gaze_ratio = 0.5
        self.inter_ocular_dist = 1.0
        self.nose_x = 0.0
        self.nose_y = 0.0


def _extract_features(
    face_landmarks: list, w: int, h: int,
) -> Optional[_FrameFeatures]:
    """Extract all relevant features from one frame's face landmarks."""
    if len(face_landmarks) < 478:
        return None

    ff = _FrameFeatures()

    left_eye_pts = [_pt(face_landmarks, i, w, h) for i in LEFT_EYE_EAR]
    right_eye_pts = [_pt(face_landmarks, i, w, h) for i in RIGHT_EYE_EAR]
    ff.left_ear = _ear(left_eye_pts)
    ff.right_ear = _ear(right_eye_pts)
    ff.avg_ear = (ff.left_ear + ff.right_ear) / 2.0

    left_iris = _pt(face_landmarks, LEFT_IRIS[0], w, h)
    right_iris = _pt(face_landmarks, RIGHT_IRIS[0], w, h)
    ff.gaze_x = (left_iris[0] + right_iris[0]) / 2.0
    ff.gaze_y = (left_iris[1] + right_iris[1]) / 2.0

    left_outer = _pt(face_landmarks, LEFT_EYE_OUTER, w, h)
    right_outer = _pt(face_landmarks, RIGHT_EYE_OUTER, w, h)
    ff.inter_ocular_dist = max(_dist(left_outer, right_outer), 1.0)

    left_inner = _pt(face_landmarks, LEFT_EYE_INNER, w, h)
    right_inner = _pt(face_landmarks, RIGHT_EYE_INNER, w, h)
    ff.left_gaze_ratio = _gaze_ratio(left_iris, left_inner, left_outer)
    ff.right_gaze_ratio = _gaze_ratio(right_iris, right_inner, right_outer)
    ff.avg_gaze_ratio = (ff.left_gaze_ratio + ff.right_gaze_ratio) / 2.0

    nose = _pt(face_landmarks, NOSE_TIP, w, h)
    ff.nose_x, ff.nose_y = nose
    return ff


# ===================================================================
# Temporal analysis across frames
# ===================================================================


def _detect_blinks(ear_series: list[float]) -> int:
    """Count blinks using EAR threshold crossing."""
    blink_count = 0
    in_blink = False
    for val in ear_series:
        if val < BLINK_EAR_THRESHOLD:
            if not in_blink:
                blink_count += 1
                in_blink = True
        else:
            in_blink = False
    return blink_count


def _compute_fixations_and_saccades(
    features: list[_FrameFeatures],
) -> tuple[list[float], list[float], int, int]:
    """Detect fixations and saccades from gaze trajectory.

    Returns (fixation_durations, saccade_amplitudes, fix_count, sac_count).
    """
    if len(features) < 2:
        return [], [], 0, 0

    fixation_durations: list[float] = []
    saccade_amplitudes: list[float] = []
    current_fixation_frames = 1

    for i in range(1, len(features)):
        prev, curr = features[i - 1], features[i]
        iod = (prev.inter_ocular_dist + curr.inter_ocular_dist) / 2.0
        displacement = _dist(
            (prev.gaze_x, prev.gaze_y), (curr.gaze_x, curr.gaze_y),
        )
        norm_disp = displacement / iod

        if norm_disp < FIXATION_THRESHOLD_RATIO:
            current_fixation_frames += 1
        else:
            if current_fixation_frames > 0:
                fixation_durations.append(
                    current_fixation_frames * FRAME_INTERVAL_S
                )
            saccade_amplitudes.append(norm_disp)
            current_fixation_frames = 1

    if current_fixation_frames > 0:
        fixation_durations.append(current_fixation_frames * FRAME_INTERVAL_S)

    return (
        fixation_durations, saccade_amplitudes,
        len(fixation_durations), len(saccade_amplitudes),
    )


def _gaze_spatial_distribution(
    features: list[_FrameFeatures],
) -> tuple[float, float, float]:
    """Return (gaze_std_x, gaze_std_y, central_gaze_ratio)."""
    if not features:
        return 0.0, 0.0, 0.0

    mean_iod = float(np.mean([f.inter_ocular_dist for f in features]))
    xs = [(f.gaze_x - f.nose_x) / mean_iod for f in features]
    ys = [(f.gaze_y - f.nose_y) / mean_iod for f in features]

    gaze_std_x = float(np.std(xs)) if len(xs) > 1 else 0.0
    gaze_std_y = float(np.std(ys)) if len(ys) > 1 else 0.0

    central_count = sum(
        1 for f in features if 0.35 <= f.avg_gaze_ratio <= 0.65
    )
    return gaze_std_x, gaze_std_y, central_count / len(features)


def _gaze_stability_over_time(
    features: list[_FrameFeatures],
) -> tuple[float, float]:
    """Return (first_half_variance, second_half_variance).

    ASD subjects often show less habituation (variance stays high).
    """
    if len(features) < 4:
        return 0.0, 0.0

    mid = len(features) // 2

    def _var(fts: list[_FrameFeatures]) -> float:
        if len(fts) < 2:
            return 0.0
        iod = float(np.mean([f.inter_ocular_dist for f in fts]))
        xs = [(f.gaze_x - f.nose_x) / iod for f in fts]
        ys = [(f.gaze_y - f.nose_y) / iod for f in fts]
        return float(np.var(xs) + np.var(ys))

    return _var(features[:mid]), _var(features[mid:])


# ===================================================================
# ASD risk scoring -- multi-factor continuous model
# ===================================================================


def _compute_risk_score(
    *,
    face_detection_rate: float,
    blink_rate_per_min: float,
    avg_fixation_duration: float,
    fixation_count: int,
    saccade_count: int,
    avg_saccade_amplitude: float,
    central_gaze_ratio: float,
    gaze_std_x: float,
    gaze_std_y: float,
    first_half_var: float,
    second_half_var: float,
    avg_ear: float,
    total_frames: int,
    frames_with_face: int,
) -> tuple[float, float, list[str]]:
    """Compute ASD risk score (0-100) with continuous sigmoid scoring.

    Returns (asd_risk_score, confidence_score, insights).
    """
    sub: dict[str, float] = {}
    insights: list[str] = []

    # -- Factor 1: Gaze avoidance (25%) --
    avoidance = (1.0 - _sigmoid(central_gaze_ratio, 0.45, 8.0)) * 100
    sub["gaze_avoidance"] = avoidance
    if central_gaze_ratio < 0.30:
        insights.append(
            f"Significant gaze avoidance -- direct gaze in only "
            f"{central_gaze_ratio * 100:.0f}% of frames."
        )
    elif central_gaze_ratio < 0.50:
        insights.append(
            f"Reduced central gaze -- {central_gaze_ratio * 100:.0f}% "
            f"of frames (typical: >60%)."
        )
    else:
        insights.append(
            f"Central gaze maintained in {central_gaze_ratio * 100:.0f}% "
            f"of frames -- within typical range."
        )

    # -- Factor 2: Fixation duration abnormality (20%) --
    if avg_fixation_duration > 0:
        fix_long = _sigmoid(avg_fixation_duration, 1.2, 3.0)
        fix_short = 1.0 - _sigmoid(avg_fixation_duration, 0.35, 6.0)
        fixation_score = max(fix_long, fix_short) * 100
    else:
        fixation_score = 50.0
    sub["fixation_abnormality"] = fixation_score
    if avg_fixation_duration > 1.5:
        insights.append(
            f"Prolonged fixations (avg {avg_fixation_duration:.2f}s) -- "
            f"may indicate restricted gaze patterns."
        )
    elif 0 < avg_fixation_duration < 0.4:
        insights.append(
            f"Very short fixations (avg {avg_fixation_duration:.2f}s) -- "
            f"difficulty sustaining visual attention."
        )

    # -- Factor 3: Saccade frequency (15%) --
    duration_min = max((total_frames * FRAME_INTERVAL_S) / 60.0, 0.01)
    saccade_rate = saccade_count / duration_min
    saccade_score = (1.0 - _sigmoid(saccade_rate, 80.0, 0.03)) * 100
    sub["saccade_deficit"] = saccade_score
    if saccade_rate < 40:
        insights.append(
            f"Very low saccade rate ({saccade_rate:.0f}/min) -- "
            f"reduced exploratory eye movements."
        )

    # -- Factor 4: Blink rate abnormality (10%) --
    if blink_rate_per_min < NORMAL_BLINK_RATE_LOW:
        blink_score = (
            1.0 - _sigmoid(blink_rate_per_min, NORMAL_BLINK_RATE_LOW - 4, 0.5)
        ) * 100
    elif blink_rate_per_min > NORMAL_BLINK_RATE_HIGH:
        blink_score = (
            _sigmoid(blink_rate_per_min, NORMAL_BLINK_RATE_HIGH + 4, 0.5) * 100
        )
    else:
        blink_score = 10.0
    sub["blink_abnormality"] = blink_score
    if blink_rate_per_min < 8:
        insights.append(
            f"Low blink rate ({blink_rate_per_min:.1f}/min) -- "
            f"may indicate hypo-responsiveness."
        )
    elif blink_rate_per_min > 28:
        insights.append(
            f"Elevated blink rate ({blink_rate_per_min:.1f}/min) -- "
            f"may indicate stress or sensory sensitivity."
        )

    # -- Factor 5: Gaze variability (15%) --
    total_gaze_std = math.sqrt(gaze_std_x ** 2 + gaze_std_y ** 2)
    restricted = (1.0 - _sigmoid(total_gaze_std, 0.15, 15.0)) * 100
    scattered = _sigmoid(total_gaze_std, 0.60, 8.0) * 100
    variability_score = max(restricted, scattered)
    sub["gaze_variability"] = variability_score
    if total_gaze_std < 0.08:
        insights.append(
            "Very restricted gaze scanning -- limited visual exploration."
        )
    elif total_gaze_std > 0.6:
        insights.append(
            "Highly scattered gaze -- difficulty maintaining focused attention."
        )

    # -- Factor 6: Temporal habituation (15%) --
    if first_half_var > 0.001 and second_half_var > 0.001:
        hab_ratio = second_half_var / first_half_var
        habituation_score = _sigmoid(hab_ratio, 1.0, 4.0) * 100
    else:
        habituation_score = 50.0
    sub["habituation_deficit"] = habituation_score

    # -- Weighted combination --
    weights = {
        "gaze_avoidance": 0.25,
        "fixation_abnormality": 0.20,
        "saccade_deficit": 0.15,
        "blink_abnormality": 0.10,
        "gaze_variability": 0.15,
        "habituation_deficit": 0.15,
    }
    raw_risk = sum(sub[k] * weights[k] for k in weights)
    asd_risk_score = max(0.0, min(100.0, raw_risk))

    # -- Confidence score --
    frame_conf = min(total_frames / 8.0, 1.0) * 40
    face_conf = face_detection_rate * 40
    base_conf = 20.0
    confidence_score = min(100.0, frame_conf + face_conf + base_conf)

    if confidence_score < 50:
        insights.append(
            f"Low confidence ({confidence_score:.0f}%) -- limited data. "
            f"Results may be unreliable. Retry with better lighting."
        )

    insights.append(
        "This is an automated screening indicator only -- NOT a diagnosis. "
        "Please consult a qualified healthcare professional."
    )

    return round(asd_risk_score, 1), round(confidence_score, 1), insights


# ===================================================================
# Main analysis pipeline
# ===================================================================


def _analyze_frames(frames_base64: list[str]) -> dict:
    """Run the full analysis pipeline on captured frames.

    1. Decode frames and extract per-frame features via MediaPipe
    2. Compute temporal metrics (fixations, saccades, blinks)
    3. Analyse spatial gaze distribution
    4. Score ASD risk with multi-factor model
    """
    features: list[_FrameFeatures] = []
    ear_series: list[float] = []
    frames_with_face = 0
    all_landmarks: list[list[dict]] = []

    landmarker = _create_landmarker()

    try:
        for frame_b64 in frames_base64:
            frame = _decode_frame(frame_b64)
            if frame is None:
                continue

            h, w, _ = frame.shape
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(
                image_format=mp.ImageFormat.SRGB, data=rgb_frame,
            )
            results = landmarker.detect(mp_image)

            if (
                not results.face_landmarks
                or len(results.face_landmarks) == 0
            ):
                continue

            face_lms = results.face_landmarks[0]
            frames_with_face += 1

            ff = _extract_features(face_lms, w, h)
            if ff is None:
                continue

            features.append(ff)
            ear_series.append(ff.avg_ear)

            frame_lm_data = [
                {"x": float(face_lms[i].x), "y": float(face_lms[i].y)}
                for i in LEFT_EYE_EAR + RIGHT_EYE_EAR
            ]
            all_landmarks.append(frame_lm_data)
    finally:
        landmarker.close()

    total_frames = len(frames_base64)

    # -- No face detected --
    if frames_with_face == 0 or len(features) == 0:
        return {
            "gaze_points_count": 0,
            "avg_fixation_duration": 0.0,
            "attention_score": 0.0,
            "gaze_pattern_type": "no_face_detected",
            "left_eye_openness": 0.0,
            "right_eye_openness": 0.0,
            "blink_rate": 0.0,
            "saccade_frequency": 0.0,
            "joint_attention_score": 0.0,
            "asd_risk_score": 50.0,
            "confidence_score": 0.0,
            "landmarks": all_landmarks,
            "insights": [
                "No face detected in submitted frames. Please ensure the "
                "face is clearly visible, well-lit, and centred in the camera.",
                "This is an automated screening indicator only -- NOT a "
                "diagnosis.",
            ],
        }

    # -- Temporal analysis --
    fix_durs, sac_amps, fix_count, sac_count = (
        _compute_fixations_and_saccades(features)
    )
    avg_fix = float(np.mean(fix_durs)) if fix_durs else 0.0
    avg_sac_amp = float(np.mean(sac_amps)) if sac_amps else 0.0

    # -- Blink analysis --
    blink_count = _detect_blinks(ear_series)
    duration_min = max((total_frames * FRAME_INTERVAL_S) / 60.0, 0.01)
    blink_rate = blink_count / duration_min

    # -- Spatial analysis --
    gaze_std_x, gaze_std_y, central_ratio = _gaze_spatial_distribution(
        features,
    )

    # -- Temporal habituation --
    first_var, second_var = _gaze_stability_over_time(features)

    # -- Derived metrics --
    face_rate = frames_with_face / max(total_frames, 1)
    attention_score = (face_rate * 0.4 + central_ratio * 0.6) * 100

    gaze_var = float(np.var([f.avg_gaze_ratio for f in features]))
    joint_attention = max(
        0.0, min(100.0, central_ratio * 70 + (1.0 - min(gaze_var * 20, 1.0)) * 30),
    )

    saccade_freq = sac_count / duration_min

    # -- Gaze pattern classification --
    total_gaze_std = math.sqrt(gaze_std_x ** 2 + gaze_std_y ** 2)
    if central_ratio > 0.65 and total_gaze_std < 0.2:
        gaze_pattern = "focused_central"
    elif central_ratio > 0.45:
        gaze_pattern = "normal_scanning"
    elif total_gaze_std > 0.5:
        gaze_pattern = "scattered"
    elif central_ratio < 0.30:
        gaze_pattern = "avoidant"
    else:
        gaze_pattern = "atypical"

    avg_left_ear = float(np.mean([f.left_ear for f in features]))
    avg_right_ear = float(np.mean([f.right_ear for f in features]))
    avg_ear_val = float(np.mean(ear_series)) if ear_series else 0.0

    # -- ASD risk scoring --
    asd_risk_score, confidence_score, insights = _compute_risk_score(
        face_detection_rate=face_rate,
        blink_rate_per_min=blink_rate,
        avg_fixation_duration=avg_fix,
        fixation_count=fix_count,
        saccade_count=sac_count,
        avg_saccade_amplitude=avg_sac_amp,
        central_gaze_ratio=central_ratio,
        gaze_std_x=gaze_std_x,
        gaze_std_y=gaze_std_y,
        first_half_var=first_var,
        second_half_var=second_var,
        avg_ear=avg_ear_val,
        total_frames=total_frames,
        frames_with_face=frames_with_face,
    )

    return {
        "gaze_points_count": len(features),
        "avg_fixation_duration": round(avg_fix, 3),
        "attention_score": round(attention_score, 1),
        "gaze_pattern_type": gaze_pattern,
        "left_eye_openness": round(avg_left_ear, 3),
        "right_eye_openness": round(avg_right_ear, 3),
        "blink_rate": round(blink_rate, 1),
        "saccade_frequency": round(saccade_freq, 1),
        "joint_attention_score": round(joint_attention, 1),
        "asd_risk_score": asd_risk_score,
        "confidence_score": confidence_score,
        "landmarks": all_landmarks,
        "insights": insights,
    }


# ===================================================================
# Public API
# ===================================================================


def analyze_eye_tracking(
    user_id: str, frames_base64: list[str],
) -> EyeTrackingResponse:
    """Analyse eye tracking frames and persist results."""
    assessment_id = str(uuid.uuid4())

    with get_db() as conn:
        conn.execute(
            "INSERT INTO assessments (id, user_id, type, status) "
            "VALUES (?, ?, 'eye_tracking', 'processing')",
            (assessment_id, user_id),
        )

    try:
        results = _analyze_frames(frames_base64)

        result_id = str(uuid.uuid4())
        with get_db() as conn:
            conn.execute(
                """INSERT INTO eye_tracking_results
                (id, assessment_id, gaze_points_count,
                 avg_fixation_duration, attention_score,
                 gaze_pattern_type, left_eye_openness,
                 right_eye_openness, blink_rate,
                 saccade_frequency, joint_attention_score,
                 asd_risk_score, raw_landmarks_json,
                 insights_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    result_id,
                    assessment_id,
                    results["gaze_points_count"],
                    results["avg_fixation_duration"],
                    results["attention_score"],
                    results["gaze_pattern_type"],
                    results["left_eye_openness"],
                    results["right_eye_openness"],
                    results["blink_rate"],
                    results["saccade_frequency"],
                    results["joint_attention_score"],
                    results["asd_risk_score"],
                    json.dumps(results["landmarks"]),
                    json.dumps(results["insights"]),
                ),
            )
            conn.execute(
                "UPDATE assessments SET status = 'completed', "
                "updated_at = datetime('now') WHERE id = ?",
                (assessment_id,),
            )

        return EyeTrackingResponse(
            assessment_id=assessment_id,
            status=AssessmentStatus.COMPLETED,
            metrics=GazeMetrics(
                gaze_points_count=results["gaze_points_count"],
                avg_fixation_duration=results["avg_fixation_duration"],
                attention_score=results["attention_score"],
                gaze_pattern_type=results["gaze_pattern_type"],
                left_eye_openness=results["left_eye_openness"],
                right_eye_openness=results["right_eye_openness"],
                blink_rate=results["blink_rate"],
                saccade_frequency=results["saccade_frequency"],
                joint_attention_score=results["joint_attention_score"],
            ),
            asd_risk_score=results["asd_risk_score"],
            confidence_score=results.get("confidence_score", 0.0),
            insights=results["insights"],
        )

    except Exception as e:
        with get_db() as conn:
            conn.execute(
                "UPDATE assessments SET status = 'failed', "
                "updated_at = datetime('now') WHERE id = ?",
                (assessment_id,),
            )
        raise RuntimeError(f"Eye tracking analysis failed: {e}") from e
