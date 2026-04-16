"""Eye tracking analysis service using MediaPipe Face Landmarker (tasks API).

Analyzes gaze patterns, fixation duration, blink rate, and other eye metrics
to detect potential ASD indicators such as reduced eye contact and atypical gaze patterns.
"""

import base64
import json
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

# Key eye landmark indices for MediaPipe Face Mesh (468 landmarks)
# Left eye: 33, 160, 158, 133, 153, 144
# Right eye: 362, 385, 387, 263, 373, 380
# Iris: Left 468-472, Right 473-477
LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144, 145, 159, 161, 163]
RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380, 374, 386, 388, 390]
LEFT_IRIS_INDICES = [468, 469, 470, 471, 472]
RIGHT_IRIS_INDICES = [473, 474, 475, 476, 477]

# Nose tip for reference
NOSE_TIP_INDEX = 1


def _decode_frame(base64_str: str) -> Optional[np.ndarray]:
    """Decode a base64-encoded image frame to numpy array."""
    try:
        img_bytes = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return frame
    except Exception:
        return None


def _calculate_eye_aspect_ratio(eye_landmarks: list[tuple[float, float]]) -> float:
    """Calculate Eye Aspect Ratio (EAR) for blink detection.

    EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
    Higher EAR = eye more open, lower EAR = eye more closed/blinking.
    """
    if len(eye_landmarks) < 6:
        return 0.0

    p1, p2, p3, p4, p5, p6 = eye_landmarks[:6]

    vertical_1 = np.sqrt((p2[0] - p6[0]) ** 2 + (p2[1] - p6[1]) ** 2)
    vertical_2 = np.sqrt((p3[0] - p5[0]) ** 2 + (p3[1] - p5[1]) ** 2)
    horizontal = np.sqrt((p1[0] - p4[0]) ** 2 + (p1[1] - p4[1]) ** 2)

    if horizontal == 0:
        return 0.0

    ear = (vertical_1 + vertical_2) / (2.0 * horizontal)
    return ear


def _calculate_gaze_direction(
    iris_center: tuple[float, float],
    eye_left: tuple[float, float],
    eye_right: tuple[float, float],
) -> float:
    """Calculate horizontal gaze ratio (0=left, 0.5=center, 1=right)."""
    eye_width = eye_right[0] - eye_left[0]
    if eye_width == 0:
        return 0.5
    ratio = (iris_center[0] - eye_left[0]) / eye_width
    return max(0.0, min(1.0, ratio))


def _get_landmark_point(
    landmarks: list, index: int, w: int, h: int
) -> tuple[float, float]:
    """Extract (x, y) pixel coordinates from a NormalizedLandmark."""
    lm = landmarks[index]
    return (lm.x * w, lm.y * h)


def _create_landmarker() -> FaceLandmarker:
    """Create a FaceLandmarker instance."""
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


def _analyze_frames(frames_base64: list[str]) -> dict:
    """Analyze multiple frames using MediaPipe Face Landmarker.

    Returns comprehensive eye tracking metrics.
    """
    gaze_points: list[tuple[float, float]] = []
    fixation_durations: list[float] = []
    left_ear_values: list[float] = []
    right_ear_values: list[float] = []
    gaze_directions: list[float] = []
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

            # Convert to MediaPipe Image
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            results = landmarker.detect(mp_image)

            if not results.face_landmarks or len(results.face_landmarks) == 0:
                continue

            face_landmarks = results.face_landmarks[0]
            frames_with_face += 1

            # Extract eye landmarks
            left_eye_pts = [
                _get_landmark_point(face_landmarks, idx, w, h)
                for idx in LEFT_EYE_INDICES[:6]
            ]
            right_eye_pts = [
                _get_landmark_point(face_landmarks, idx, w, h)
                for idx in RIGHT_EYE_INDICES[:6]
            ]

            # Calculate Eye Aspect Ratios
            left_ear = _calculate_eye_aspect_ratio(left_eye_pts)
            right_ear = _calculate_eye_aspect_ratio(right_eye_pts)
            left_ear_values.append(left_ear)
            right_ear_values.append(right_ear)

            # Extract iris centers for gaze direction
            if len(face_landmarks) > 477:  # Has iris landmarks
                left_iris = _get_landmark_point(face_landmarks, LEFT_IRIS_INDICES[0], w, h)
                right_iris = _get_landmark_point(face_landmarks, RIGHT_IRIS_INDICES[0], w, h)

                # Gaze point is average of both iris centers
                gaze_x = (left_iris[0] + right_iris[0]) / 2
                gaze_y = (left_iris[1] + right_iris[1]) / 2
                gaze_points.append((gaze_x, gaze_y))

                # Calculate gaze direction
                left_dir = _calculate_gaze_direction(
                    left_iris, left_eye_pts[0], left_eye_pts[3]
                )
                right_dir = _calculate_gaze_direction(
                    right_iris, right_eye_pts[0], right_eye_pts[3]
                )
                gaze_directions.append((left_dir + right_dir) / 2)

            # Calculate fixation (simplified: distance between consecutive gaze points)
            if len(gaze_points) >= 2:
                prev = gaze_points[-2]
                curr = gaze_points[-1]
                dist = np.sqrt((curr[0] - prev[0]) ** 2 + (curr[1] - prev[1]) ** 2)
                # If gaze didn't move much, it's a fixation
                if dist < 20:  # threshold in pixels
                    fixation_durations.append(0.1)
                else:
                    fixation_durations.append(0.0)

            # Store raw landmarks for this frame
            frame_lms = [
                {"x": float(face_landmarks[idx].x), "y": float(face_landmarks[idx].y)}
                for idx in LEFT_EYE_INDICES + RIGHT_EYE_INDICES
            ]
            all_landmarks.append(frame_lms)
    finally:
        landmarker.close()

    # Calculate aggregate metrics
    total_frames = len(frames_base64)
    if frames_with_face == 0:
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
            "landmarks": all_landmarks,
            "insights": ["No face detected in submitted frames. Please ensure the face is clearly visible."],
        }

    # Blink detection: count frames where EAR drops below threshold
    blink_threshold = 0.2
    blinks = sum(
        1
        for ear in left_ear_values
        if ear < blink_threshold
    )
    # Approximate recording duration (frames * ~100ms)
    duration_minutes = (total_frames * 0.1) / 60.0
    blink_rate = blinks / max(duration_minutes, 0.01)

    # Average fixation duration
    fixation_periods: list[float] = []
    current_fixation = 0.0
    for fd in fixation_durations:
        if fd > 0:
            current_fixation += fd
        elif current_fixation > 0:
            fixation_periods.append(current_fixation)
            current_fixation = 0.0
    if current_fixation > 0:
        fixation_periods.append(current_fixation)

    avg_fixation = float(np.mean(fixation_periods)) if fixation_periods else 0.0

    # Saccade frequency: rapid eye movements between fixation points
    saccade_count = sum(1 for fd in fixation_durations if fd == 0.0)
    saccade_freq = saccade_count / max(duration_minutes, 0.01)

    # Gaze pattern analysis
    gaze_center_ratio = sum(
        1 for d in gaze_directions if 0.35 <= d <= 0.65
    ) / max(len(gaze_directions), 1)

    # Attention score: based on face detection rate and gaze centering
    face_detection_rate = frames_with_face / max(total_frames, 1)
    attention_score = (face_detection_rate * 50 + gaze_center_ratio * 50)

    # Joint attention score: how well the subject maintains focused gaze
    gaze_variance = float(np.var(gaze_directions)) if gaze_directions else 1.0
    joint_attention = max(0, 100 - gaze_variance * 500)

    # Classify gaze pattern
    if gaze_center_ratio > 0.7:
        gaze_pattern = "focused_central"
    elif gaze_center_ratio > 0.4:
        gaze_pattern = "normal_scanning"
    elif gaze_variance > 0.1:
        gaze_pattern = "scattered"
    else:
        gaze_pattern = "avoidant"

    # ASD risk score calculation
    # ASD indicators: avoidant gaze, low joint attention, irregular blink rate,
    # short fixation duration, scattered gaze pattern
    risk_factors: list[float] = []

    # Gaze avoidance (0-25 points)
    if gaze_center_ratio < 0.3:
        risk_factors.append(25.0)
    elif gaze_center_ratio < 0.5:
        risk_factors.append(15.0)
    else:
        risk_factors.append(5.0)

    # Joint attention deficit (0-25 points)
    if joint_attention < 30:
        risk_factors.append(25.0)
    elif joint_attention < 60:
        risk_factors.append(15.0)
    else:
        risk_factors.append(5.0)

    # Fixation duration (0-25 points) - too short or too long is concerning
    if avg_fixation < 0.3:
        risk_factors.append(20.0)
    elif avg_fixation > 3.0:
        risk_factors.append(15.0)
    else:
        risk_factors.append(5.0)

    # Blink rate abnormality (0-25 points)
    # Normal: 15-20 blinks/min
    if blink_rate < 8 or blink_rate > 30:
        risk_factors.append(20.0)
    elif blink_rate < 12 or blink_rate > 25:
        risk_factors.append(10.0)
    else:
        risk_factors.append(5.0)

    asd_risk_score = min(100.0, sum(risk_factors))

    # Generate insights
    insights: list[str] = []
    if attention_score > 70:
        insights.append("Good attention span detected")
    elif attention_score < 40:
        insights.append("Low attention span — may indicate difficulty maintaining focus")

    if gaze_pattern == "focused_central":
        insights.append("Consistent central gaze patterns observed")
    elif gaze_pattern == "avoidant":
        insights.append("Gaze avoidance patterns detected — common ASD indicator")
    elif gaze_pattern == "scattered":
        insights.append("Scattered gaze patterns — may indicate attention difficulties")

    if avg_fixation > 1.5:
        insights.append("Good fixation duration — sustained visual attention")
    elif avg_fixation < 0.5:
        insights.append("Short fixation duration — difficulty sustaining gaze")

    if joint_attention > 60:
        insights.append("Adequate joint attention capability")
    else:
        insights.append("Reduced joint attention — notable ASD indicator")

    return {
        "gaze_points_count": len(gaze_points),
        "avg_fixation_duration": round(float(avg_fixation), 2),
        "attention_score": round(attention_score, 1),
        "gaze_pattern_type": gaze_pattern,
        "left_eye_openness": round(float(np.mean(left_ear_values)) if left_ear_values else 0.0, 3),
        "right_eye_openness": round(float(np.mean(right_ear_values)) if right_ear_values else 0.0, 3),
        "blink_rate": round(blink_rate, 1),
        "saccade_frequency": round(saccade_freq, 1),
        "joint_attention_score": round(joint_attention, 1),
        "asd_risk_score": round(asd_risk_score, 1),
        "landmarks": all_landmarks,
        "insights": insights,
    }


def analyze_eye_tracking(user_id: str, frames_base64: list[str]) -> EyeTrackingResponse:
    """Main entry point: analyze eye tracking frames and store results."""
    assessment_id = str(uuid.uuid4())

    # Create assessment record
    with get_db() as conn:
        conn.execute(
            "INSERT INTO assessments (id, user_id, type, status) VALUES (?, ?, 'eye_tracking', 'processing')",
            (assessment_id, user_id),
        )

    try:
        # Run analysis
        results = _analyze_frames(frames_base64)

        # Store results
        result_id = str(uuid.uuid4())
        with get_db() as conn:
            conn.execute(
                """INSERT INTO eye_tracking_results
                (id, assessment_id, gaze_points_count, avg_fixation_duration,
                 attention_score, gaze_pattern_type, left_eye_openness,
                 right_eye_openness, blink_rate, saccade_frequency,
                 joint_attention_score, asd_risk_score, raw_landmarks_json, insights_json)
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
                "UPDATE assessments SET status = 'completed', updated_at = datetime('now') WHERE id = ?",
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
            insights=results["insights"],
        )

    except Exception as e:
        with get_db() as conn:
            conn.execute(
                "UPDATE assessments SET status = 'failed', updated_at = datetime('now') WHERE id = ?",
                (assessment_id,),
            )
        raise RuntimeError(f"Eye tracking analysis failed: {e}") from e
