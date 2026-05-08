"""Top-level v2 pipeline: frames → 14-feature matrix → model → response.

Public entry point: :func:`analyze_eye_tracking_v2`. The dispatcher in
``services/eye_tracking.py`` routes calls here when
``EYE_TRACKING_BACKEND=new_model`` (the default).

Design contract
---------------
1. Identical request signature to the legacy pipeline.
2. Returns the same ``EyeTrackingResponse`` schema so the frontend keeps
   working unchanged.
3. Falls back to the legacy MediaPipe behaviour pipeline (without
   crashing the request) when the trained-model artefact is missing AND
   ``PipelineConfig.fail_open`` is True.
4. Emits structured logs at every stage so failures are diagnosable.
"""

from __future__ import annotations

import base64
import json
import logging
import uuid
from typing import Optional

import numpy as np

from ...database import get_db
from ...schemas.assessment import (
    AssessmentStatus,
    BehaviorScores,
    EyeTrackingResponse,
    FrameAnalysisLog,
    GazeMetrics,
)
from .config import (
    FEATURE_ORDER,
    PipelineConfig,
    load_pipeline_config,
)
from .mediapipe_adapter import (
    landmarks_to_feature_vector,
)
from .model_runner import (
    InferenceResult,
    LoadedModel,
    ModelArtefactMissing,
    load_model,
    run_inference,
)
from .validation import FeatureValidationError

logger = logging.getLogger("eye_tracking_v2.pipeline")


# ---------------------------------------------------------------------------
# Lazy-loaded singletons
# ---------------------------------------------------------------------------
_MODEL_CACHE: Optional[LoadedModel] = None
_FACE_LANDMARKER: Optional[object] = None


def _get_face_landmarker(config: PipelineConfig):
    """Initialise + cache a MediaPipe FaceLandmarker for v2 use.

    Lower confidence thresholds than the legacy module since v2 is
    primarily a numeric extractor — the trained model handles the
    behaviour scoring.

    MediaPipe is imported lazily so this module remains importable in
    test / lint environments that don't have the heavy CV dependencies.
    """
    global _FACE_LANDMARKER
    if _FACE_LANDMARKER is not None:
        return _FACE_LANDMARKER

    from mediapipe.tasks.python import BaseOptions
    from mediapipe.tasks.python.vision import (
        FaceLandmarker,
        FaceLandmarkerOptions,
        RunningMode,
    )

    # Re-use the legacy module's task file so we don't ship duplicates.
    from .. import eye_tracking as legacy

    options = FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=legacy.MODEL_PATH),
        running_mode=RunningMode.IMAGE,
        num_faces=1,
        min_face_detection_confidence=config.adapter.min_face_detection_confidence,
        min_face_presence_confidence=config.adapter.min_face_presence_confidence,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
    )
    _FACE_LANDMARKER = FaceLandmarker.create_from_options(options)
    logger.info("eye_tracking_v2: FaceLandmarker initialised")
    return _FACE_LANDMARKER


def _get_model(config: PipelineConfig) -> LoadedModel:
    global _MODEL_CACHE
    if _MODEL_CACHE is not None:
        return _MODEL_CACHE
    _MODEL_CACHE = load_model(config.model_root)
    return _MODEL_CACHE


def _decode_frame(b64: str) -> Optional[np.ndarray]:
    try:
        import cv2  # lazy — keeps import-time cost off the cold path

        data = base64.b64decode(b64)
        arr = np.frombuffer(data, np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("decode_frame: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Per-batch extraction
# ---------------------------------------------------------------------------
def extract_feature_matrix(
    frames_base64: list[str],
    config: PipelineConfig,
) -> tuple[np.ndarray, list[FrameAnalysisLog]]:
    """Decode frames and extract an (N, 14) feature matrix + frame log."""
    import cv2
    import mediapipe as mp

    landmarker = _get_face_landmarker(config)

    rows: list[np.ndarray] = []
    frame_log: list[FrameAnalysisLog] = []

    for idx, b64 in enumerate(frames_base64):
        frame = _decode_frame(b64)
        if frame is None:
            frame_log.append(
                FrameAnalysisLog(
                    frame_index=idx,
                    eye_detected=False,
                    reason="decode_failed",
                )
            )
            continue

        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = landmarker.detect(mp_image)

        if not result or not result.face_landmarks:
            frame_log.append(
                FrameAnalysisLog(
                    frame_index=idx,
                    eye_detected=False,
                    reason="no_face",
                )
            )
            continue

        lms = result.face_landmarks[0]
        fv = landmarks_to_feature_vector(
            lms, w, h, frame_index=idx, config=config.adapter
        )
        if fv is None:
            frame_log.append(
                FrameAnalysisLog(
                    frame_index=idx,
                    eye_detected=False,
                    reason="insufficient_landmarks",
                )
            )
            continue

        if not np.isfinite(fv.values).all():
            frame_log.append(
                FrameAnalysisLog(
                    frame_index=idx,
                    eye_detected=False,
                    reason="non_finite_features",
                )
            )
            continue

        rows.append(fv.values)
        frame_log.append(
            FrameAnalysisLog(
                frame_index=idx,
                eye_detected=True,
                reason=None,
            )
        )

    if not rows:
        matrix = np.empty((0, len(FEATURE_ORDER)), dtype=np.float64)
    else:
        matrix = np.vstack(rows)
    return matrix, frame_log


# ---------------------------------------------------------------------------
# Response assembly
# ---------------------------------------------------------------------------
def _build_response(
    *,
    assessment_id: str,
    inference: InferenceResult,
    frame_log: list[FrameAnalysisLog],
    eye_detected: bool,
    feedback: Optional[str],
) -> EyeTrackingResponse:
    """Map an InferenceResult into the existing EyeTrackingResponse schema."""
    asd_risk_score = round(float(inference.asd_probability) * 100.0, 2)
    confidence_score = round(float(inference.confidence) * 100.0, 2)

    # The trained model produces a single ASD likelihood; we surface it
    # via the existing `asd_risk_score` and `confidence_score` fields and
    # leave the legacy-style breakdown empty so the frontend treats this
    # as "model-driven" instead of "behaviour-rule-driven". Keeping the
    # other fields at their defaults preserves type compatibility.
    insights = [
        f"Model-driven ASD likelihood: {inference.asd_probability:.2f}",
        f"Frames analysed: {inference.n_frames_used}",
    ]

    return EyeTrackingResponse(
        assessment_id=assessment_id,
        status=AssessmentStatus.COMPLETED,
        eye_detected=eye_detected,
        metrics=GazeMetrics(
            gaze_points_count=inference.n_frames_used,
        ),
        behavior_scores=BehaviorScores(),
        asd_risk_score=asd_risk_score,
        confidence_score=confidence_score,
        insights=insights,
        frame_log=frame_log,
        feedback_message=feedback,
    )


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def analyze_eye_tracking_v2(
    user_id: str,
    frames_base64: list[str],
    frame_metadata: Optional[list[dict]] = None,  # noqa: ARG001 — kept for API parity
) -> EyeTrackingResponse:
    """Run the v2 (trained-model) eye-tracking pipeline.

    On any unrecoverable failure (e.g. model artefact missing) and when
    ``fail_open=True`` (the default), this function delegates to the
    legacy pipeline so the request never crashes the API. The fallback
    is logged so missing artefacts are visible in operations.
    """
    cfg = load_pipeline_config()
    assessment_id = str(uuid.uuid4())

    with get_db() as conn:
        conn.execute(
            "INSERT INTO assessments (id, user_id, type, status) "
            "VALUES (?, ?, 'eye_tracking', 'processing')",
            (assessment_id, user_id),
        )

    try:
        # ----------------------------------------------------------------
        # 1. Decode + extract 14-feature vectors per frame.
        # ----------------------------------------------------------------
        feature_matrix, frame_log = extract_feature_matrix(frames_base64, cfg)
        n_used = int(feature_matrix.shape[0])
        logger.info(
            "eye_tracking_v2: extracted %d/%d usable feature vectors",
            n_used,
            len(frames_base64),
        )

        if n_used == 0:
            with get_db() as conn:
                conn.execute(
                    "UPDATE assessments SET status = 'completed', "
                    "updated_at = datetime('now') WHERE id = ?",
                    (assessment_id,),
                )
            return EyeTrackingResponse(
                assessment_id=assessment_id,
                status=AssessmentStatus.COMPLETED,
                eye_detected=False,
                metrics=GazeMetrics(),
                behavior_scores=BehaviorScores(),
                asd_risk_score=0.0,
                confidence_score=0.0,
                insights=["No usable frames — eye landmarks were not detected."],
                frame_log=frame_log,
                feedback_message="Please ensure your face is clearly visible.",
            )

        # ----------------------------------------------------------------
        # 2. Load model (or fall back to legacy if artefact is missing).
        # ----------------------------------------------------------------
        try:
            model = _get_model(cfg)
        except ModelArtefactMissing as exc:
            if not cfg.fail_open:
                raise
            logger.warning(
                "eye_tracking_v2: model artefact missing (%s); "
                "falling back to legacy pipeline",
                exc,
            )
            return _delegate_to_legacy(
                user_id=user_id,
                frames_base64=frames_base64,
                frame_metadata=frame_metadata,
                assessment_id=assessment_id,
            )

        # ----------------------------------------------------------------
        # 3. Run inference + persist the row.
        # ----------------------------------------------------------------
        inference = run_inference(
            model, feature_matrix, preprocessing_mode=cfg.preprocessing
        )
        logger.info(
            "eye_tracking_v2: inference probability=%.3f confidence=%.3f "
            "n_frames=%d",
            inference.asd_probability,
            inference.confidence,
            inference.n_frames_used,
        )

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
                    inference.n_frames_used,
                    0.0,
                    round(100.0 - inference.asd_probability * 100.0, 2),
                    "model_driven",
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    round(inference.asd_probability * 100.0, 2),
                    json.dumps(
                        {
                            "feature_summary": inference.feature_summary,
                            "model_metadata": inference.model_metadata,
                        }
                    ),
                    json.dumps(
                        [
                            f"Model probability: {inference.asd_probability:.3f}",
                            f"Frames used: {inference.n_frames_used}",
                        ]
                    ),
                ),
            )
            conn.execute(
                "UPDATE assessments SET status = 'completed', "
                "updated_at = datetime('now') WHERE id = ?",
                (assessment_id,),
            )

        return _build_response(
            assessment_id=assessment_id,
            inference=inference,
            frame_log=frame_log,
            eye_detected=True,
            feedback=None,
        )

    except FeatureValidationError as exc:
        logger.exception("eye_tracking_v2: feature validation failed")
        with get_db() as conn:
            conn.execute(
                "UPDATE assessments SET status = 'failed', "
                "updated_at = datetime('now') WHERE id = ?",
                (assessment_id,),
            )
        if cfg.fail_open:
            return _delegate_to_legacy(
                user_id=user_id,
                frames_base64=frames_base64,
                frame_metadata=frame_metadata,
                assessment_id=assessment_id,
            )
        raise RuntimeError(f"Eye tracking analysis failed: {exc}") from exc

    except Exception as exc:
        logger.exception("eye_tracking_v2: unexpected failure")
        with get_db() as conn:
            conn.execute(
                "UPDATE assessments SET status = 'failed', "
                "updated_at = datetime('now') WHERE id = ?",
                (assessment_id,),
            )
        raise RuntimeError(f"Eye tracking analysis failed: {exc}") from exc


def _delegate_to_legacy(
    *,
    user_id: str,
    frames_base64: list[str],
    frame_metadata: Optional[list[dict]],
    assessment_id: str,
) -> EyeTrackingResponse:
    """Fall back to the legacy MediaPipe pipeline.

    The legacy entry point creates its own assessment row, so we mark the
    one we already created as ``failed`` and return the legacy response.
    This keeps DB rows consistent with what actually produced the result.
    """
    from .. import eye_tracking as legacy

    with get_db() as conn:
        conn.execute(
            "UPDATE assessments SET status = 'failed', "
            "updated_at = datetime('now') WHERE id = ?",
            (assessment_id,),
        )
    return legacy.analyze_eye_tracking_legacy(
        user_id=user_id,
        frames_base64=frames_base64,
        frame_metadata=frame_metadata,
    )
