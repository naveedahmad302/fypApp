"""Advanced eye tracking & autism behavior detection module.

Production-grade analysis of gaze patterns, fixation, saccade dynamics,
eye contact quality, object tracking, atypical movements, social engagement,
and hand-near-eye stimming detection using MediaPipe Face Landmarker and
Hand Landmarker.

Eye Presence Validation
-----------------------
* Strict detection gate with confidence >= 0.85
* Multi-frame validation (3 consecutive frames with stable landmarks)
* No scoring when eyes are NOT reliably detected

Behavioral Analysis (8 dimensions)
-----------------------------------
1. Gaze Stability & Jitter
2. Eye Contact Quality
3. Object Tracking Accuracy
4. Atypical Eye Movements
5. Fixation & Staring Behaviour
6. Social Engagement Response
7. Hand-near-Eye Stimming Detection
8. Temporal Habituation

Based on published ASD eye-tracking research:
  - Klin et al. (2002): reduced attention to eyes in social scenes
  - Pelphrey et al. (2002): atypical scanpath patterns
  - Dalton et al. (2005): gaze fixation and amygdala activation
  - Shic et al. (2011): fixation duration differences in ASD
  - Frazier et al. (2017): saccade metrics as ASD biomarkers
  - Soukupova & Cech (2016): Eye Aspect Ratio for blink detection
  - Jones & Klin (2013): attention to eyes in first year of life

DISCLAIMER: This is a screening tool only. It does NOT diagnose ASD.
Only qualified clinical professionals can diagnose autism spectrum disorder
through comprehensive evaluation.
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
    BehaviorScores,
    EyeTrackingResponse,
    FrameAnalysisLog,
    GazeMetrics,
)

# ===================================================================
# Model paths
# ===================================================================
MODEL_PATH = os.path.join(os.path.dirname(__file__), "face_landmarker.task")

# Optional hand landmarker model for stimming detection
HAND_MODEL_PATH = os.path.join(os.path.dirname(__file__), "hand_landmarker.task")

# ===================================================================
# MediaPipe Face Mesh landmark indices
# ===================================================================
LEFT_EYE_EAR = [33, 160, 158, 133, 153, 144]
RIGHT_EYE_EAR = [362, 385, 387, 263, 373, 380]
LEFT_IRIS = [468, 469, 470, 471, 472]
RIGHT_IRIS = [473, 474, 475, 476, 477]
NOSE_TIP = 1
LEFT_EYE_OUTER = 33
LEFT_EYE_INNER = 133
RIGHT_EYE_INNER = 362
RIGHT_EYE_OUTER = 263

# ===================================================================
# Configuration constants
# ===================================================================

# Eye presence validation
FACE_DETECTION_CONFIDENCE = 0.85
FACE_PRESENCE_CONFIDENCE = 0.85
CONSECUTIVE_FRAMES_REQUIRED = 3

# Timing
FRAME_INTERVAL_S = 0.5  # frontend captures one frame every 500 ms

# Blink detection
BLINK_EAR_THRESHOLD = 0.21  # Soukupova & Cech, 2016
NORMAL_BLINK_RATE_LOW = 12.0  # Bentivoglio et al. 1997
NORMAL_BLINK_RATE_HIGH = 22.0

# Fixation & saccade
FIXATION_THRESHOLD_RATIO = 0.15  # normalised by inter-ocular distance

# Gaze stability / jitter
JITTER_VELOCITY_THRESHOLD = 0.08  # normalised gaze velocity threshold

# Eye contact
EYE_CONTACT_RATIO_MIN = 0.35  # gaze ratio range for "looking at camera"
EYE_CONTACT_RATIO_MAX = 0.65

# Object tracking
TRACKING_CORRELATION_GOOD = 0.6
TRACKING_CORRELATION_POOR = 0.3

# Temporal smoothing (exponential moving average)
EMA_ALPHA = 0.3  # smoothing factor for gaze coordinates

# Assessment phases
PHASE_FREE_GAZE = "free_gaze"
PHASE_OBJECT_TRACKING = "object_tracking"
PHASE_SOCIAL_STIMULUS = "social_stimulus"

# Scoring weights for final ASD likelihood
SCORING_WEIGHTS = {
    "eye_contact": 0.20,
    "gaze_stability": 0.15,
    "fixation": 0.15,
    "tracking": 0.10,
    "atypical_movement": 0.10,
    "social_engagement": 0.10,
    "stimming": 0.05,
    "habituation": 0.10,
    "blink_abnormality": 0.05,
}


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


def _create_face_landmarker() -> FaceLandmarker:
    """Create a MediaPipe FaceLandmarker with high confidence thresholds."""
    options = FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=RunningMode.IMAGE,
        num_faces=1,
        min_face_detection_confidence=FACE_DETECTION_CONFIDENCE,
        min_face_presence_confidence=FACE_PRESENCE_CONFIDENCE,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
    )
    return FaceLandmarker.create_from_options(options)


def _create_hand_landmarker():
    """Create a MediaPipe HandLandmarker for stimming detection.

    Returns None if the model file is not available.
    """
    if not os.path.exists(HAND_MODEL_PATH):
        return None
    try:
        from mediapipe.tasks.python.vision import (
            HandLandmarker,
            HandLandmarkerOptions,
        )

        options = HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=HAND_MODEL_PATH),
            running_mode=RunningMode.IMAGE,
            num_hands=2,
            min_hand_detection_confidence=0.5,
            min_hand_presence_confidence=0.5,
        )
        return HandLandmarker.create_from_options(options)
    except Exception:
        return None


# ===================================================================
# Per-frame feature extraction
# ===================================================================


class _FrameFeatures:
    """Features extracted from a single frame."""

    __slots__ = (
        "gaze_x", "gaze_y",
        "smoothed_gaze_x", "smoothed_gaze_y",
        "left_ear", "right_ear", "avg_ear",
        "left_gaze_ratio", "right_gaze_ratio", "avg_gaze_ratio",
        "inter_ocular_dist", "nose_x", "nose_y",
        "gaze_velocity", "gaze_direction_change",
        "phase", "stimulus_x", "stimulus_y",
        "hand_near_eye", "hand_eye_distance",
        "eye_detected", "detection_confidence",
        "frame_w", "frame_h",
    )

    def __init__(self) -> None:
        self.gaze_x = 0.0
        self.gaze_y = 0.0
        self.smoothed_gaze_x = 0.0
        self.smoothed_gaze_y = 0.0
        self.left_ear = 0.0
        self.right_ear = 0.0
        self.avg_ear = 0.0
        self.left_gaze_ratio = 0.5
        self.right_gaze_ratio = 0.5
        self.avg_gaze_ratio = 0.5
        self.inter_ocular_dist = 1.0
        self.nose_x = 0.0
        self.nose_y = 0.0
        self.gaze_velocity = 0.0
        self.gaze_direction_change = 0.0
        self.phase = PHASE_FREE_GAZE
        self.stimulus_x: Optional[float] = None
        self.stimulus_y: Optional[float] = None
        self.hand_near_eye = False
        self.hand_eye_distance = float("inf")
        self.eye_detected = True
        self.detection_confidence = 1.0
        self.frame_w = 0
        self.frame_h = 0


def _extract_features(
    face_landmarks: list, w: int, h: int,
) -> Optional[_FrameFeatures]:
    """Extract all relevant features from one frame's face landmarks."""
    if len(face_landmarks) < 478:
        return None

    ff = _FrameFeatures()

    # Eye aspect ratios
    left_eye_pts = [_pt(face_landmarks, i, w, h) for i in LEFT_EYE_EAR]
    right_eye_pts = [_pt(face_landmarks, i, w, h) for i in RIGHT_EYE_EAR]
    ff.left_ear = _ear(left_eye_pts)
    ff.right_ear = _ear(right_eye_pts)
    ff.avg_ear = (ff.left_ear + ff.right_ear) / 2.0

    # Iris centers (gaze position)
    left_iris = _pt(face_landmarks, LEFT_IRIS[0], w, h)
    right_iris = _pt(face_landmarks, RIGHT_IRIS[0], w, h)
    ff.gaze_x = (left_iris[0] + right_iris[0]) / 2.0
    ff.gaze_y = (left_iris[1] + right_iris[1]) / 2.0

    # Inter-ocular distance (normalisation factor)
    left_outer = _pt(face_landmarks, LEFT_EYE_OUTER, w, h)
    right_outer = _pt(face_landmarks, RIGHT_EYE_OUTER, w, h)
    ff.inter_ocular_dist = max(_dist(left_outer, right_outer), 1.0)

    # Gaze ratios (horizontal gaze direction)
    left_inner = _pt(face_landmarks, LEFT_EYE_INNER, w, h)
    right_inner = _pt(face_landmarks, RIGHT_EYE_INNER, w, h)
    ff.left_gaze_ratio = _gaze_ratio(left_iris, left_inner, left_outer)
    ff.right_gaze_ratio = _gaze_ratio(right_iris, right_inner, right_outer)
    ff.avg_gaze_ratio = (ff.left_gaze_ratio + ff.right_gaze_ratio) / 2.0

    # Nose tip reference
    nose = _pt(face_landmarks, NOSE_TIP, w, h)
    ff.nose_x, ff.nose_y = nose

    # Store frame dimensions for coordinate normalisation
    ff.frame_w = w
    ff.frame_h = h

    return ff


def _apply_temporal_smoothing(
    features: list[_FrameFeatures],
) -> None:
    """Apply exponential moving average to gaze coordinates in-place.

    Reduces noise from jitter while preserving genuine gaze shifts.
    """
    if not features:
        return

    # Initialise first frame
    features[0].smoothed_gaze_x = features[0].gaze_x
    features[0].smoothed_gaze_y = features[0].gaze_y

    for i in range(1, len(features)):
        prev = features[i - 1]
        curr = features[i]
        curr.smoothed_gaze_x = (
            EMA_ALPHA * curr.gaze_x + (1 - EMA_ALPHA) * prev.smoothed_gaze_x
        )
        curr.smoothed_gaze_y = (
            EMA_ALPHA * curr.gaze_y + (1 - EMA_ALPHA) * prev.smoothed_gaze_y
        )


def _compute_velocities(features: list[_FrameFeatures]) -> None:
    """Compute gaze velocity and direction changes between consecutive frames."""
    if len(features) < 2:
        return

    for i in range(1, len(features)):
        prev, curr = features[i - 1], features[i]
        iod = (prev.inter_ocular_dist + curr.inter_ocular_dist) / 2.0

        # Velocity: normalised displacement per frame
        dx = curr.smoothed_gaze_x - prev.smoothed_gaze_x
        dy = curr.smoothed_gaze_y - prev.smoothed_gaze_y
        curr.gaze_velocity = math.sqrt(dx**2 + dy**2) / iod

        # Direction change: angle between consecutive velocity vectors
        if i >= 2:
            prev2 = features[i - 2]
            dx_prev = prev.smoothed_gaze_x - prev2.smoothed_gaze_x
            dy_prev = prev.smoothed_gaze_y - prev2.smoothed_gaze_y
            dot = dx * dx_prev + dy * dy_prev
            mag1 = math.sqrt(dx**2 + dy**2)
            mag2 = math.sqrt(dx_prev**2 + dy_prev**2)
            if mag1 > 1e-6 and mag2 > 1e-6:
                cos_angle = max(-1.0, min(1.0, dot / (mag1 * mag2)))
                curr.gaze_direction_change = math.acos(cos_angle)
            else:
                curr.gaze_direction_change = 0.0


def _detect_hand_near_eye(
    hand_landmarker,
    mp_image: mp.Image,
    face_landmarks: list,
    w: int,
    h: int,
) -> tuple[bool, float]:
    """Detect if a hand is near the eye region (stimming indicator).

    Returns (hand_near_eye: bool, min_distance: float).
    """
    if hand_landmarker is None:
        return False, float("inf")

    try:
        hand_results = hand_landmarker.detect(mp_image)
        if not hand_results.hand_landmarks:
            return False, float("inf")

        # Eye region center
        left_eye = _pt(face_landmarks, LEFT_IRIS[0], w, h)
        right_eye = _pt(face_landmarks, RIGHT_IRIS[0], w, h)
        eye_center_x = (left_eye[0] + right_eye[0]) / 2.0
        eye_center_y = (left_eye[1] + right_eye[1]) / 2.0

        iod = max(
            _dist(
                _pt(face_landmarks, LEFT_EYE_OUTER, w, h),
                _pt(face_landmarks, RIGHT_EYE_OUTER, w, h),
            ),
            1.0,
        )

        min_dist = float("inf")
        for hand_lms in hand_results.hand_landmarks:
            for lm in hand_lms:
                hx, hy = lm.x * w, lm.y * h
                d = _dist((hx, hy), (eye_center_x, eye_center_y))
                norm_d = d / iod
                min_dist = min(min_dist, norm_d)

        # Hand is "near eye" if within 1.5x inter-ocular distance
        hand_near = min_dist < 1.5
        return hand_near, min_dist
    except Exception:
        return False, float("inf")


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
    """Detect fixations and saccades from smoothed gaze trajectory.

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
            (prev.smoothed_gaze_x, prev.smoothed_gaze_y),
            (curr.smoothed_gaze_x, curr.smoothed_gaze_y),
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


# ===================================================================
# Behavior analysis functions (8 dimensions)
# ===================================================================


def _analyze_gaze_stability(features: list[_FrameFeatures]) -> dict:
    """Dimension 1: Gaze Stability & Jitter.

    Measures smoothness of gaze trajectory, frequency of micro-movements,
    and velocity consistency.
    """
    if len(features) < 3:
        return {"score": 50.0, "jitter_index": 0.0, "velocity_mean": 0.0,
                "velocity_std": 0.0, "direction_changes": 0,
                "insight": "Insufficient data for gaze stability analysis."}

    velocities = [f.gaze_velocity for f in features[1:] if f.gaze_velocity > 0]
    direction_changes = [
        f.gaze_direction_change for f in features[2:]
        if f.gaze_direction_change > 0.5  # significant direction change (>~30 deg)
    ]

    vel_mean = float(np.mean(velocities)) if velocities else 0.0
    vel_std = float(np.std(velocities)) if velocities else 0.0

    # Jitter index: ratio of high-velocity micro-movements
    jitter_frames = sum(1 for v in velocities if v > JITTER_VELOCITY_THRESHOLD)
    jitter_index = jitter_frames / max(len(velocities), 1)

    # Scoring: low jitter and consistent velocity = stable = low risk
    jitter_risk = _sigmoid(jitter_index, 0.3, 8.0) * 100
    variability_risk = _sigmoid(vel_std, 0.05, 20.0) * 100
    direction_risk = _sigmoid(
        len(direction_changes) / max(len(features), 1), 0.25, 8.0
    ) * 100

    score = jitter_risk * 0.4 + variability_risk * 0.3 + direction_risk * 0.3

    insight = ""
    if jitter_index > 0.4:
        insight = (
            f"Frequent gaze jitter detected ({jitter_index:.0%} of frames) "
            f"-- difficulty maintaining smooth eye movements."
        )
    elif vel_std > 0.06:
        insight = (
            f"Inconsistent gaze velocity (std={vel_std:.3f}) "
            f"-- irregular eye movement patterns."
        )
    elif score < 30:
        insight = "Stable gaze movement patterns -- within typical range."
    else:
        insight = f"Moderate gaze instability (jitter index: {jitter_index:.0%})."

    return {
        "score": round(score, 1),
        "jitter_index": round(jitter_index, 3),
        "velocity_mean": round(vel_mean, 4),
        "velocity_std": round(vel_std, 4),
        "direction_changes": len(direction_changes),
        "insight": insight,
    }


def _analyze_eye_contact(features: list[_FrameFeatures]) -> dict:
    """Dimension 2: Eye Contact Quality.

    Measures how much gaze is directed toward the camera (centre),
    duration of sustained contact, and avoidance patterns.
    """
    if not features:
        return {"score": 50.0, "contact_ratio": 0.0, "avg_contact_duration": 0.0,
                "max_contact_duration": 0.0, "avoidance_episodes": 0,
                "insight": "No data for eye contact analysis."}

    # Eye contact = gaze ratio within central range (looking at camera)
    contact_frames = [
        f for f in features
        if EYE_CONTACT_RATIO_MIN <= f.avg_gaze_ratio <= EYE_CONTACT_RATIO_MAX
    ]
    contact_ratio = len(contact_frames) / len(features)

    # Sustained contact duration tracking
    contact_durations: list[float] = []
    avoidance_episodes = 0
    current_contact = 0
    current_avoidance = 0

    for f in features:
        if EYE_CONTACT_RATIO_MIN <= f.avg_gaze_ratio <= EYE_CONTACT_RATIO_MAX:
            current_contact += 1
            if current_avoidance >= 2:  # at least 1 second of avoidance
                avoidance_episodes += 1
            current_avoidance = 0
        else:
            if current_contact > 0:
                contact_durations.append(current_contact * FRAME_INTERVAL_S)
            current_contact = 0
            current_avoidance += 1

    if current_contact > 0:
        contact_durations.append(current_contact * FRAME_INTERVAL_S)
    if current_avoidance >= 2:
        avoidance_episodes += 1

    avg_contact_dur = float(np.mean(contact_durations)) if contact_durations else 0.0
    max_contact_dur = max(contact_durations) if contact_durations else 0.0

    # Scoring: low contact ratio and frequent avoidance = high risk
    contact_risk = (1.0 - _sigmoid(contact_ratio, 0.45, 8.0)) * 100
    avoidance_risk = _sigmoid(
        avoidance_episodes / max(len(features) / 4, 1), 0.5, 6.0
    ) * 100
    duration_risk = (1.0 - _sigmoid(avg_contact_dur, 1.0, 3.0)) * 100

    score = contact_risk * 0.5 + avoidance_risk * 0.25 + duration_risk * 0.25

    if contact_ratio < 0.25:
        insight = (
            f"Very low eye contact ({contact_ratio:.0%} of time) with "
            f"{avoidance_episodes} avoidance episodes -- significant ASD indicator."
        )
    elif contact_ratio < 0.45:
        insight = (
            f"Reduced eye contact ({contact_ratio:.0%}) -- "
            f"below typical range (>60%)."
        )
    elif avoidance_episodes > 3:
        insight = (
            f"Frequent eye contact breaks ({avoidance_episodes} episodes) "
            f"despite overall {contact_ratio:.0%} contact time."
        )
    else:
        insight = (
            f"Good eye contact maintained ({contact_ratio:.0%} of time, "
            f"avg duration {avg_contact_dur:.1f}s)."
        )

    return {
        "score": round(score, 1),
        "contact_ratio": round(contact_ratio, 3),
        "avg_contact_duration": round(avg_contact_dur, 2),
        "max_contact_duration": round(max_contact_dur, 2),
        "avoidance_episodes": avoidance_episodes,
        "insight": insight,
    }


def _analyze_object_tracking(features: list[_FrameFeatures]) -> dict:
    """Dimension 3: Object Tracking Accuracy.

    During the object tracking phase, measures how well gaze follows
    a moving stimulus. Uses normalised correlation between gaze position
    and stimulus position.
    """
    tracking_features = [f for f in features if f.phase == PHASE_OBJECT_TRACKING]

    if len(tracking_features) < 3:
        return {"score": 50.0, "tracking_accuracy": 0.0, "avg_lag": 0.0,
                "correlation_x": 0.0, "correlation_y": 0.0,
                "insight": "No object tracking data available (phase not run)."}

    # Filter frames that have stimulus position data
    valid = [
        f for f in tracking_features
        if f.stimulus_x is not None and f.stimulus_y is not None
    ]

    if len(valid) < 3:
        return {"score": 50.0, "tracking_accuracy": 0.0, "avg_lag": 0.0,
                "correlation_x": 0.0, "correlation_y": 0.0,
                "insight": "Insufficient object tracking data."}

    # Compute normalised distances between gaze and stimulus.
    # Frontend sends stimulus positions in [0, 1] normalised range.
    # Gaze coordinates are in pixels, so we normalise them to [0, 1]
    # using the frame dimensions for a consistent comparison.
    distances: list[float] = []
    for f in valid:
        fw = max(f.frame_w, 1)
        fh = max(f.frame_h, 1)
        gaze_norm_x = f.smoothed_gaze_x / fw
        gaze_norm_y = f.smoothed_gaze_y / fh
        stim_norm_x = f.stimulus_x if f.stimulus_x is not None else 0.0
        stim_norm_y = f.stimulus_y if f.stimulus_y is not None else 0.0
        d = math.sqrt(
            (gaze_norm_x - stim_norm_x) ** 2 + (gaze_norm_y - stim_norm_y) ** 2
        )
        distances.append(d)

    avg_distance = float(np.mean(distances))
    tracking_accuracy = max(0.0, 1.0 - avg_distance / 2.0)

    # Correlation between gaze and stimulus x/y
    gaze_xs = np.array([
        f.smoothed_gaze_x / max(f.frame_w, 1) for f in valid
    ])
    gaze_ys = np.array([
        f.smoothed_gaze_y / max(f.frame_h, 1) for f in valid
    ])
    stim_xs = np.array([
        (f.stimulus_x if f.stimulus_x is not None else 0.0) for f in valid
    ])
    stim_ys = np.array([
        (f.stimulus_y if f.stimulus_y is not None else 0.0) for f in valid
    ])

    corr_x = 0.0
    corr_y = 0.0
    if np.std(stim_xs) > 0.01 and np.std(gaze_xs) > 0.01:
        corr_x = float(np.corrcoef(gaze_xs, stim_xs)[0, 1])
    if np.std(stim_ys) > 0.01 and np.std(gaze_ys) > 0.01:
        corr_y = float(np.corrcoef(gaze_ys, stim_ys)[0, 1])
    if math.isnan(corr_x):
        corr_x = 0.0
    if math.isnan(corr_y):
        corr_y = 0.0

    avg_corr = (abs(corr_x) + abs(corr_y)) / 2.0

    # Scoring: poor correlation = high risk
    score = (1.0 - _sigmoid(avg_corr, 0.5, 6.0)) * 100

    if avg_corr < TRACKING_CORRELATION_POOR:
        insight = (
            f"Poor object tracking (correlation: {avg_corr:.2f}) -- "
            f"gaze did not follow the moving stimulus."
        )
    elif avg_corr < TRACKING_CORRELATION_GOOD:
        insight = (
            f"Moderate tracking ability (correlation: {avg_corr:.2f}) -- "
            f"some difficulty following the moving object."
        )
    else:
        insight = (
            f"Good object tracking (correlation: {avg_corr:.2f}) -- "
            f"gaze followed the stimulus accurately."
        )

    return {
        "score": round(score, 1),
        "tracking_accuracy": round(tracking_accuracy, 3),
        "avg_lag": round(avg_distance, 3),
        "correlation_x": round(corr_x, 3),
        "correlation_y": round(corr_y, 3),
        "insight": insight,
    }


def _analyze_atypical_movements(features: list[_FrameFeatures]) -> dict:
    """Dimension 4: Atypical Eye Movements.

    Detects rapid scanning, random gaze jumps, and unstable tracking
    using velocity spikes and direction change frequency.
    """
    if len(features) < 3:
        return {"score": 50.0, "rapid_scans": 0, "random_jumps": 0,
                "velocity_spikes": 0,
                "insight": "Insufficient data for movement analysis."}

    velocities = [f.gaze_velocity for f in features[1:]]
    vel_mean = float(np.mean(velocities)) if velocities else 0.0
    vel_std = float(np.std(velocities)) if velocities else 0.0

    # Velocity spikes: > 2 std above mean
    spike_threshold = vel_mean + 2.0 * vel_std if vel_std > 0 else vel_mean * 2
    velocity_spikes = sum(1 for v in velocities if v > spike_threshold)

    # Rapid scanning: high velocity sustained over 2+ frames
    rapid_scans = 0
    rapid_count = 0
    for v in velocities:
        if v > vel_mean + vel_std:
            rapid_count += 1
            if rapid_count >= 2:
                rapid_scans += 1
                rapid_count = 0
        else:
            rapid_count = 0

    # Random jumps: large direction changes after velocity spikes
    random_jumps = 0
    for i in range(2, len(features)):
        if (features[i].gaze_velocity > spike_threshold
                and features[i].gaze_direction_change > math.pi / 3):
            random_jumps += 1

    total_events = velocity_spikes + rapid_scans + random_jumps
    event_rate = total_events / max(len(features), 1)

    score = _sigmoid(event_rate, 0.15, 12.0) * 100

    if random_jumps > 3:
        insight = (
            f"Multiple random gaze jumps detected ({random_jumps}) -- "
            f"atypical eye movement pattern."
        )
    elif rapid_scans > 2:
        insight = (
            f"Rapid scanning behaviour ({rapid_scans} episodes) -- "
            f"may indicate visual processing differences."
        )
    elif velocity_spikes > 4:
        insight = (
            f"Frequent velocity spikes ({velocity_spikes}) -- "
            f"unstable eye tracking detected."
        )
    elif score < 20:
        insight = "Eye movements within typical range -- no atypical patterns."
    else:
        insight = f"Some atypical movement patterns ({total_events} events)."

    return {
        "score": round(score, 1),
        "rapid_scans": rapid_scans,
        "random_jumps": random_jumps,
        "velocity_spikes": velocity_spikes,
        "insight": insight,
    }


def _analyze_fixation_staring(features: list[_FrameFeatures]) -> dict:
    """Dimension 5: Fixation & Staring Behaviour.

    Detects abnormally long fixations (staring) and difficulty shifting
    gaze between targets. Both prolonged fixation and inability to fixate
    are ASD indicators.
    """
    fix_durs, _, fix_count, _ = _compute_fixations_and_saccades(features)

    if not fix_durs:
        return {"score": 50.0, "avg_fixation": 0.0, "max_fixation": 0.0,
                "fixation_count": 0, "prolonged_fixations": 0,
                "short_fixations": 0,
                "insight": "Insufficient data for fixation analysis."}

    avg_fix = float(np.mean(fix_durs))
    max_fix = max(fix_durs)

    # Prolonged fixations (>2s = potential staring)
    prolonged = sum(1 for d in fix_durs if d > 2.0)
    # Very short fixations (<0.3s = can't maintain focus)
    short = sum(1 for d in fix_durs if d < 0.3)

    # Scoring: both extremes are indicators
    prolonged_risk = _sigmoid(prolonged / max(fix_count, 1), 0.2, 8.0) * 100
    short_risk = _sigmoid(short / max(fix_count, 1), 0.4, 6.0) * 100
    duration_abnormality = max(
        _sigmoid(avg_fix, 1.5, 3.0) * 100,  # too long
        (1.0 - _sigmoid(avg_fix, 0.35, 6.0)) * 100,  # too short
    )

    score = prolonged_risk * 0.35 + short_risk * 0.25 + duration_abnormality * 0.4

    if prolonged > 2:
        insight = (
            f"Prolonged staring detected ({prolonged} fixations >2s, "
            f"max {max_fix:.1f}s) -- may indicate restricted visual patterns."
        )
    elif avg_fix > 1.5:
        insight = (
            f"Long average fixation ({avg_fix:.2f}s) -- "
            f"difficulty shifting gaze between targets."
        )
    elif avg_fix < 0.35 and short > 2:
        insight = (
            f"Very short fixations (avg {avg_fix:.2f}s) -- "
            f"difficulty sustaining visual attention."
        )
    elif score < 25:
        insight = (
            f"Normal fixation patterns (avg {avg_fix:.2f}s, "
            f"{fix_count} fixations)."
        )
    else:
        insight = (
            f"Moderate fixation abnormality (avg {avg_fix:.2f}s, "
            f"{prolonged} prolonged, {short} short)."
        )

    return {
        "score": round(score, 1),
        "avg_fixation": round(avg_fix, 3),
        "max_fixation": round(max_fix, 3),
        "fixation_count": fix_count,
        "prolonged_fixations": prolonged,
        "short_fixations": short,
        "insight": insight,
    }


def _analyze_social_engagement(features: list[_FrameFeatures]) -> dict:
    """Dimension 6: Social Engagement Response.

    During the social stimulus phase, checks whether gaze shifts toward
    the stimulus (e.g., sound source / camera center) after a trigger event.
    If no social stimulus phase was run, analyses gaze-shift responsiveness
    from the free gaze phase instead.
    """
    social_features = [f for f in features if f.phase == PHASE_SOCIAL_STIMULUS]

    if len(social_features) < 4:
        # Fall back to analysing gaze shift responsiveness in free gaze
        if len(features) < 6:
            return {"score": 50.0, "response_latency": 0.0,
                    "gaze_shift_detected": False,
                    "insight": "No social stimulus data available."}

        # Measure how quickly gaze returns to center after deviations
        shift_latencies: list[int] = []
        for i in range(1, len(features)):
            prev, curr = features[i - 1], features[i]
            prev_central = (
                EYE_CONTACT_RATIO_MIN <= prev.avg_gaze_ratio <= EYE_CONTACT_RATIO_MAX
            )
            curr_central = (
                EYE_CONTACT_RATIO_MIN <= curr.avg_gaze_ratio <= EYE_CONTACT_RATIO_MAX
            )

            if not prev_central and curr_central:
                # Count how many frames it took to return
                latency = 0
                for j in range(i - 1, max(i - 6, -1), -1):
                    f = features[j]
                    if EYE_CONTACT_RATIO_MIN <= f.avg_gaze_ratio <= EYE_CONTACT_RATIO_MAX:
                        break
                    latency += 1
                shift_latencies.append(latency)

        if not shift_latencies:
            return {"score": 50.0, "response_latency": 0.0,
                    "gaze_shift_detected": False,
                    "insight": "No gaze shift events detected for analysis."}

        avg_latency = float(np.mean(shift_latencies)) * FRAME_INTERVAL_S
        score = _sigmoid(avg_latency, 1.5, 3.0) * 100

        insight = (
            f"Gaze reorientation latency: {avg_latency:.1f}s avg "
            f"({len(shift_latencies)} shifts)."
        )
        if avg_latency > 2.0:
            insight += " Slow response -- may indicate social disengagement."

        return {
            "score": round(score, 1),
            "response_latency": round(avg_latency, 2),
            "gaze_shift_detected": len(shift_latencies) > 0,
            "insight": insight,
        }

    # Analyse social stimulus phase: stimulus occurs at phase midpoint
    mid = len(social_features) // 2
    pre_stimulus = social_features[:mid]
    post_stimulus = social_features[mid:]

    # Check if gaze shifted toward center after stimulus
    pre_central = sum(
        1 for f in pre_stimulus
        if EYE_CONTACT_RATIO_MIN <= f.avg_gaze_ratio <= EYE_CONTACT_RATIO_MAX
    ) / max(len(pre_stimulus), 1)

    post_central = sum(
        1 for f in post_stimulus
        if EYE_CONTACT_RATIO_MIN <= f.avg_gaze_ratio <= EYE_CONTACT_RATIO_MAX
    ) / max(len(post_stimulus), 1)

    gaze_shift_detected = post_central > pre_central + 0.1

    # Response latency: frames until first central gaze after stimulus
    latency_frames = 0
    for f in post_stimulus:
        if EYE_CONTACT_RATIO_MIN <= f.avg_gaze_ratio <= EYE_CONTACT_RATIO_MAX:
            break
        latency_frames += 1
    response_latency = latency_frames * FRAME_INTERVAL_S

    # Scoring: no response = high risk
    if not gaze_shift_detected:
        score = 80.0
    else:
        score = _sigmoid(response_latency, 1.5, 3.0) * 100

    if not gaze_shift_detected:
        insight = (
            "No gaze shift toward stimulus detected -- "
            "possible social disengagement."
        )
    elif response_latency > 2.0:
        insight = (
            f"Slow response to stimulus ({response_latency:.1f}s) -- "
            f"delayed social orienting."
        )
    else:
        insight = (
            f"Gaze shifted to stimulus in {response_latency:.1f}s -- "
            f"appropriate social engagement."
        )

    return {
        "score": round(score, 1),
        "response_latency": round(response_latency, 2),
        "gaze_shift_detected": gaze_shift_detected,
        "insight": insight,
    }


def _analyze_stimming(features: list[_FrameFeatures]) -> dict:
    """Dimension 7: Hand-near-Eye Stimming Detection.

    Detects repetitive hand movements near the eye region, which
    can be a self-stimulatory behavior associated with ASD.
    """
    hand_near_frames = [f for f in features if f.hand_near_eye]
    total = len(features)

    if total == 0:
        return {"score": 0.0, "stimming_detected": False,
                "hand_near_eye_ratio": 0.0, "episodes": 0,
                "insight": "No data for stimming analysis."}

    ratio = len(hand_near_frames) / total

    # Count distinct episodes (consecutive runs of hand-near-eye)
    episodes = 0
    in_episode = False
    for f in features:
        if f.hand_near_eye:
            if not in_episode:
                episodes += 1
                in_episode = True
        else:
            in_episode = False

    # Repetitive patterns: multiple episodes = more concerning
    stimming_detected = episodes >= 2 and ratio > 0.1

    score = _sigmoid(ratio, 0.15, 10.0) * _sigmoid(episodes, 1.5, 3.0) * 100

    if stimming_detected:
        insight = (
            f"Repetitive hand-near-eye movements detected "
            f"({episodes} episodes, {ratio:.0%} of time) -- "
            f"possible self-stimulatory behaviour."
        )
    elif episodes > 0:
        insight = (
            f"Brief hand-near-eye contact ({episodes} episode(s)) -- "
            f"likely incidental."
        )
    else:
        insight = "No hand-near-eye stimming behaviour detected."

    return {
        "score": round(score, 1),
        "stimming_detected": stimming_detected,
        "hand_near_eye_ratio": round(ratio, 3),
        "episodes": episodes,
        "insight": insight,
    }


def _analyze_habituation(features: list[_FrameFeatures]) -> dict:
    """Dimension 8: Temporal Habituation.

    Compares gaze variability between the first and second half of
    the session. Typical subjects habituate (less variability over time),
    while ASD subjects often show less habituation.
    """
    if len(features) < 6:
        return {"score": 50.0, "first_half_variance": 0.0,
                "second_half_variance": 0.0, "habituation_ratio": 1.0,
                "insight": "Insufficient data for habituation analysis."}

    mid = len(features) // 2

    def _var(fts: list[_FrameFeatures]) -> float:
        if len(fts) < 2:
            return 0.0
        iod = float(np.mean([f.inter_ocular_dist for f in fts]))
        xs = [(f.smoothed_gaze_x - f.nose_x) / iod for f in fts]
        ys = [(f.smoothed_gaze_y - f.nose_y) / iod for f in fts]
        return float(np.var(xs) + np.var(ys))

    first_var = _var(features[:mid])
    second_var = _var(features[mid:])

    if first_var > 0.001 and second_var > 0.001:
        hab_ratio = second_var / first_var
    else:
        hab_ratio = 1.0

    # High ratio = no habituation = higher risk
    score = _sigmoid(hab_ratio, 1.0, 4.0) * 100

    if hab_ratio > 1.5:
        insight = (
            f"No gaze habituation (ratio: {hab_ratio:.2f}) -- "
            f"variability increased over time."
        )
    elif hab_ratio > 1.0:
        insight = (
            f"Minimal habituation (ratio: {hab_ratio:.2f}) -- "
            f"gaze remained variable."
        )
    else:
        insight = (
            f"Good habituation (ratio: {hab_ratio:.2f}) -- "
            f"gaze stabilised over time."
        )

    return {
        "score": round(score, 1),
        "first_half_variance": round(first_var, 4),
        "second_half_variance": round(second_var, 4),
        "habituation_ratio": round(hab_ratio, 3),
        "insight": insight,
    }


# ===================================================================
# Final scoring engine
# ===================================================================


def _compute_blink_score(blink_rate_per_min: float) -> float:
    """Standalone blink abnormality score for the behavior_scores dict."""
    if blink_rate_per_min < NORMAL_BLINK_RATE_LOW:
        return (
            1.0 - _sigmoid(blink_rate_per_min, NORMAL_BLINK_RATE_LOW - 4, 0.5)
        ) * 100
    if blink_rate_per_min > NORMAL_BLINK_RATE_HIGH:
        return _sigmoid(blink_rate_per_min, NORMAL_BLINK_RATE_HIGH + 4, 0.5) * 100
    return 10.0


def _compute_final_score(
    behavior_results: dict[str, dict],
    *,
    face_detection_rate: float,
    total_frames: int,
    frames_with_face: int,
    blink_rate_per_min: float,
) -> tuple[float, float, list[str]]:
    """Compute weighted final ASD risk score and confidence.

    Returns (asd_risk_score, confidence_score, insights).
    """
    insights: list[str] = []

    # Blink abnormality scoring
    blink_score = _compute_blink_score(blink_rate_per_min)
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

    # Collect per-feature scores
    feature_scores = {
        "eye_contact": behavior_results["eye_contact"]["score"],
        "gaze_stability": behavior_results["gaze_stability"]["score"],
        "fixation": behavior_results["fixation"]["score"],
        "tracking": behavior_results["tracking"]["score"],
        "atypical_movement": behavior_results["atypical_movement"]["score"],
        "social_engagement": behavior_results["social_engagement"]["score"],
        "stimming": behavior_results["stimming"]["score"],
        "habituation": behavior_results["habituation"]["score"],
        "blink_abnormality": blink_score,
    }

    # Weighted sum
    raw_risk = sum(
        feature_scores[k] * SCORING_WEIGHTS[k] for k in SCORING_WEIGHTS
    )
    asd_risk_score = max(0.0, min(100.0, raw_risk))

    # Collect insights from each dimension
    for key in ["eye_contact", "gaze_stability", "fixation", "tracking",
                "atypical_movement", "social_engagement", "stimming",
                "habituation"]:
        insight = behavior_results[key].get("insight", "")
        if insight:
            insights.append(insight)

    # Confidence score
    frame_conf = min(total_frames / 10.0, 1.0) * 35
    face_conf = face_detection_rate * 40
    consecutive_conf = 15.0 if face_detection_rate > 0.7 else 5.0
    base_conf = 10.0
    confidence_score = min(100.0, frame_conf + face_conf + consecutive_conf + base_conf)

    if confidence_score < 50:
        insights.append(
            f"Low confidence ({confidence_score:.0f}%) -- limited valid data. "
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


def _analyze_frames(
    frames_base64: list[str],
    frame_metadata: Optional[list[dict]] = None,
) -> dict:
    """Run the full analysis pipeline on captured frames.

    1. Decode frames and extract per-frame features (strict eye gate)
    2. Apply temporal smoothing (EMA)
    3. Compute velocities and direction changes
    4. Run 8 behavioral analyses
    5. Score ASD risk with weighted multi-factor model
    """
    features: list[_FrameFeatures] = []
    ear_series: list[float] = []
    frames_with_face = 0
    consecutive_valid = 0
    max_consecutive = 0
    frame_logs: list[dict] = []

    face_landmarker = _create_face_landmarker()
    hand_landmarker = _create_hand_landmarker()

    try:
        for idx, frame_b64 in enumerate(frames_base64):
            frame = _decode_frame(frame_b64)
            if frame is None:
                frame_logs.append({
                    "frame_index": idx,
                    "eye_detected": False,
                    "reason": "decode_failed",
                })
                consecutive_valid = 0
                continue

            h, w, _ = frame.shape
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(
                image_format=mp.ImageFormat.SRGB, data=rgb_frame,
            )
            results = face_landmarker.detect(mp_image)

            if not results.face_landmarks or len(results.face_landmarks) == 0:
                frame_logs.append({
                    "frame_index": idx,
                    "eye_detected": False,
                    "reason": "no_face_detected",
                })
                consecutive_valid = 0
                continue

            face_lms = results.face_landmarks[0]

            # Strict eye presence validation: check landmarks + EAR
            ff = _extract_features(face_lms, w, h)
            if ff is None:
                frame_logs.append({
                    "frame_index": idx,
                    "eye_detected": False,
                    "reason": "insufficient_landmarks",
                })
                consecutive_valid = 0
                continue

            # Gate: eyes must be open (not blinking)
            if ff.avg_ear < BLINK_EAR_THRESHOLD * 0.8:
                frame_logs.append({
                    "frame_index": idx,
                    "eye_detected": False,
                    "reason": "eyes_closed",
                })
                # Still count face detection but don't extract features
                frames_with_face += 1
                ear_series.append(ff.avg_ear)
                consecutive_valid = 0
                continue

            frames_with_face += 1
            consecutive_valid += 1
            max_consecutive = max(max_consecutive, consecutive_valid)

            # Apply phase metadata if available
            if frame_metadata and idx < len(frame_metadata):
                meta = frame_metadata[idx]
                ff.phase = meta.get("phase", PHASE_FREE_GAZE)
                ff.stimulus_x = meta.get("stimulus_x")
                ff.stimulus_y = meta.get("stimulus_y")

            # Hand-near-eye stimming detection
            hand_near, hand_dist = _detect_hand_near_eye(
                hand_landmarker, mp_image, face_lms, w, h,
            )
            ff.hand_near_eye = hand_near
            ff.hand_eye_distance = hand_dist

            features.append(ff)
            ear_series.append(ff.avg_ear)

            frame_logs.append({
                "frame_index": idx,
                "eye_detected": True,
                "ear": round(ff.avg_ear, 3),
                "gaze_ratio": round(ff.avg_gaze_ratio, 3),
                "phase": ff.phase,
                "hand_near_eye": ff.hand_near_eye,
            })
    finally:
        face_landmarker.close()
        if hand_landmarker is not None:
            hand_landmarker.close()

    total_frames = len(frames_base64)

    # -- Strict eye detection gating --
    if (frames_with_face == 0 or len(features) == 0
            or max_consecutive < CONSECUTIVE_FRAMES_REQUIRED):
        eye_detected = frames_with_face > 0

        feedback = "Please bring your eyes into the frame."
        if frames_with_face == 0:
            feedback = (
                "No face detected in submitted frames. Please ensure your "
                "face is clearly visible, well-lit, and centred in the camera."
            )
        elif len(features) == 0:
            feedback = (
                "Eyes were not clearly visible. Please keep your eyes open "
                "and look toward the camera."
            )
        elif max_consecutive < CONSECUTIVE_FRAMES_REQUIRED:
            feedback = (
                f"Eyes were only detected in {max_consecutive} consecutive "
                f"frames (need {CONSECUTIVE_FRAMES_REQUIRED}). Please hold "
                f"steady and look at the camera."
            )

        return {
            "eye_detected": eye_detected,
            "gaze_points_count": len(features),
            "avg_fixation_duration": 0.0,
            "attention_score": 0.0,
            "gaze_pattern_type": "no_reliable_detection",
            "left_eye_openness": 0.0,
            "right_eye_openness": 0.0,
            "blink_rate": 0.0,
            "saccade_frequency": 0.0,
            "joint_attention_score": 0.0,
            "asd_risk_score": 0.0,
            "confidence_score": 0.0,
            "behavior_scores": {
                "eye_contact_score": 0.0,
                "gaze_stability_score": 0.0,
                "fixation_score": 0.0,
                "tracking_score": 0.0,
                "atypical_movement_score": 0.0,
                "social_engagement_score": 0.0,
                "stimming_detected": False,
                "habituation_score": 0.0,
                "blink_abnormality_score": 0.0,
            },
            "frame_log": frame_logs,
            "insights": [feedback],
            "feedback_message": feedback,
        }

    # -- Temporal processing --
    _apply_temporal_smoothing(features)
    _compute_velocities(features)

    # -- Blink analysis --
    blink_count = _detect_blinks(ear_series)
    duration_min = max((total_frames * FRAME_INTERVAL_S) / 60.0, 0.01)
    blink_rate = blink_count / duration_min

    # -- Fixation/saccade analysis --
    fix_durs, _, _, sac_count = _compute_fixations_and_saccades(features)
    avg_fix = float(np.mean(fix_durs)) if fix_durs else 0.0
    saccade_freq = sac_count / duration_min

    # -- 8-Dimensional Behavior Analysis --
    behavior_results = {
        "gaze_stability": _analyze_gaze_stability(features),
        "eye_contact": _analyze_eye_contact(features),
        "tracking": _analyze_object_tracking(features),
        "atypical_movement": _analyze_atypical_movements(features),
        "fixation": _analyze_fixation_staring(features),
        "social_engagement": _analyze_social_engagement(features),
        "stimming": _analyze_stimming(features),
        "habituation": _analyze_habituation(features),
    }

    # -- Derived metrics --
    face_rate = frames_with_face / max(total_frames, 1)
    central_ratio = sum(
        1 for f in features
        if EYE_CONTACT_RATIO_MIN <= f.avg_gaze_ratio <= EYE_CONTACT_RATIO_MAX
    ) / len(features)
    attention_score = (face_rate * 0.4 + central_ratio * 0.6) * 100

    gaze_var = float(np.var([f.avg_gaze_ratio for f in features]))
    joint_attention = max(
        0.0,
        min(100.0, central_ratio * 70 + (1.0 - min(gaze_var * 20, 1.0)) * 30),
    )

    # Gaze pattern classification
    gaze_std_x = float(np.std(
        [(f.smoothed_gaze_x - f.nose_x) / f.inter_ocular_dist for f in features]
    )) if len(features) > 1 else 0.0
    gaze_std_y = float(np.std(
        [(f.smoothed_gaze_y - f.nose_y) / f.inter_ocular_dist for f in features]
    )) if len(features) > 1 else 0.0
    total_gaze_std = math.sqrt(gaze_std_x**2 + gaze_std_y**2)

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

    # -- Final ASD risk scoring --
    asd_risk_score, confidence_score, insights = _compute_final_score(
        behavior_results,
        face_detection_rate=face_rate,
        total_frames=total_frames,
        frames_with_face=frames_with_face,
        blink_rate_per_min=blink_rate,
    )

    # Build behavior scores dict
    behavior_scores = {
        "eye_contact_score": behavior_results["eye_contact"]["score"],
        "gaze_stability_score": behavior_results["gaze_stability"]["score"],
        "fixation_score": behavior_results["fixation"]["score"],
        "tracking_score": behavior_results["tracking"]["score"],
        "atypical_movement_score": behavior_results["atypical_movement"]["score"],
        "social_engagement_score": behavior_results["social_engagement"]["score"],
        "stimming_detected": behavior_results["stimming"].get(
            "stimming_detected", False
        ),
        "habituation_score": behavior_results["habituation"]["score"],
        "blink_abnormality_score": round(
            _compute_blink_score(blink_rate), 1
        ),
    }

    return {
        "eye_detected": True,
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
        "behavior_scores": behavior_scores,
        "frame_log": frame_logs,
        "insights": insights,
        "feedback_message": None,
    }


# ===================================================================
# Public API
# ===================================================================


def analyze_eye_tracking(
    user_id: str,
    frames_base64: list[str],
    frame_metadata: Optional[list[dict]] = None,
) -> EyeTrackingResponse:
    """Analyse eye tracking frames and persist results.

    Parameters
    ----------
    user_id : str
        Firebase user UID.
    frames_base64 : list[str]
        Base64-encoded camera frames.
    frame_metadata : list[dict], optional
        Per-frame metadata with phase and stimulus position info.
    """
    assessment_id = str(uuid.uuid4())

    with get_db() as conn:
        conn.execute(
            "INSERT INTO assessments (id, user_id, type, status) "
            "VALUES (?, ?, 'eye_tracking', 'processing')",
            (assessment_id, user_id),
        )

    try:
        results = _analyze_frames(frames_base64, frame_metadata)

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
                    json.dumps(results["frame_log"]),
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
            eye_detected=results["eye_detected"],
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
            behavior_scores=BehaviorScores(
                eye_contact_score=results["behavior_scores"]["eye_contact_score"],
                gaze_stability_score=results["behavior_scores"]["gaze_stability_score"],
                fixation_score=results["behavior_scores"]["fixation_score"],
                tracking_score=results["behavior_scores"]["tracking_score"],
                atypical_movement_score=results["behavior_scores"]["atypical_movement_score"],
                social_engagement_score=results["behavior_scores"]["social_engagement_score"],
                stimming_detected=results["behavior_scores"]["stimming_detected"],
                habituation_score=results["behavior_scores"]["habituation_score"],
                blink_abnormality_score=results["behavior_scores"]["blink_abnormality_score"],
            ),
            asd_risk_score=results["asd_risk_score"],
            confidence_score=results.get("confidence_score", 0.0),
            insights=results["insights"],
            frame_log=[
                FrameAnalysisLog(**log) for log in results["frame_log"]
            ],
            feedback_message=results.get("feedback_message"),
        )

    except Exception as e:
        with get_db() as conn:
            conn.execute(
                "UPDATE assessments SET status = 'failed', "
                "updated_at = datetime('now') WHERE id = ?",
                (assessment_id,),
            )
        raise RuntimeError(f"Eye tracking analysis failed: {e}") from e
