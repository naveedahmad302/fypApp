"""API routes for ASD assessment endpoints.

Every route in this module is authenticated via the
``require_auth_uid`` dependency. The verified Firebase UID — and **only**
that UID — is used as the data-ownership key. Any ``user_id`` field that
might still be present in a request body is ignored.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import require_auth_uid
from ..config import get_settings
from ..database import get_db
from ..schemas.assessment import (
    EyeTrackingRequest,
    EyeTrackingResponse,
    GenerateReportRequest,
    MCQAssessmentRequest,
    MCQAssessmentResponse,
    ReportResponse,
    SpeechAnalysisRequest,
    SpeechAnalysisResponse,
    UserAssessmentHistory,
    AssessmentHistoryItem,
    AssessmentType,
    AssessmentStatus,
)
from ..services.eye_tracking import analyze_eye_tracking
from ..services.mcq_assessment import assess_mcq
from ..services.report_generator import generate_report, get_user_report
from ..services.speech_analysis import analyze_speech


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assessment", tags=["Assessment"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _enforce_payload_caps_eye(request: EyeTrackingRequest) -> None:
    """Defensive payload caps on the eye-tracking endpoint."""
    settings = get_settings()
    if len(request.frames_base64) > settings.max_eye_tracking_frames:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"Too many frames in one request "
                f"(max {settings.max_eye_tracking_frames})."
            ),
        )
    for frame in request.frames_base64:
        if len(frame) > settings.max_image_base64_chars:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="One or more frames exceed the per-frame size limit.",
            )


def _enforce_payload_caps_speech(request: SpeechAnalysisRequest) -> None:
    settings = get_settings()
    if len(request.audio_base64) > settings.max_audio_base64_chars:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Audio payload exceeds size limit.",
        )
    if request.audio_format.lower() not in {"wav", "mp3", "m4a"}:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported audio format. Allowed: wav, mp3, m4a.",
        )


def _enforce_payload_caps_mcq(request: MCQAssessmentRequest) -> None:
    settings = get_settings()
    if len(request.answers) > settings.max_mcq_answers:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="MCQ answer list is unexpectedly large.",
        )


def _assert_assessment_owned(assessment_id: str, user_id: str) -> None:
    """Raise 404 if ``assessment_id`` is not owned by ``user_id``.

    We deliberately return 404 (not 403) so that an attacker cannot
    enumerate assessment IDs belonging to other users.
    """
    if not assessment_id:
        return
    with get_db() as conn:
        row = conn.execute(
            "SELECT user_id FROM assessments WHERE id = ?",
            (assessment_id,),
        ).fetchone()
    if row is None or row["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found.",
        )


# ---------------------------------------------------------------------------
# Eye tracking
# ---------------------------------------------------------------------------


@router.post("/eye-tracking", response_model=EyeTrackingResponse)
def eye_tracking_analysis(
    request: EyeTrackingRequest,
    current_user_id: str = Depends(require_auth_uid),
) -> EyeTrackingResponse:
    """Analyze eye tracking data from camera frames.

    Owner of the resulting assessment is the authenticated user. Any
    ``user_id`` field present in the request body is ignored.
    """
    _enforce_payload_caps_eye(request)

    frame_meta = None
    if request.frame_metadata:
        frame_meta = [fm.model_dump() for fm in request.frame_metadata]

    try:
        return analyze_eye_tracking(
            user_id=current_user_id,
            frames_base64=request.frames_base64,
            frame_metadata=frame_meta,
        )
    except HTTPException:
        raise
    except RuntimeError as exc:
        logger.warning("Eye tracking runtime error for user=%s: %s", current_user_id, exc)
        raise HTTPException(status_code=500, detail="Eye tracking analysis failed.")
    except Exception:
        logger.exception("Eye tracking failed for user=%s", current_user_id)
        raise HTTPException(status_code=500, detail="Eye tracking analysis failed.")


# ---------------------------------------------------------------------------
# Speech analysis
# ---------------------------------------------------------------------------


@router.post("/speech", response_model=SpeechAnalysisResponse)
def speech_analysis(
    request: SpeechAnalysisRequest,
    current_user_id: str = Depends(require_auth_uid),
) -> SpeechAnalysisResponse:
    """Analyze speech patterns from audio recording."""
    _enforce_payload_caps_speech(request)

    try:
        return analyze_speech(
            user_id=current_user_id,
            audio_base64=request.audio_base64,
            audio_format=request.audio_format,
        )
    except HTTPException:
        raise
    except RuntimeError as exc:
        logger.warning("Speech analysis runtime error for user=%s: %s", current_user_id, exc)
        raise HTTPException(status_code=500, detail="Speech analysis failed.")
    except Exception:
        logger.exception("Speech analysis failed for user=%s", current_user_id)
        raise HTTPException(status_code=500, detail="Speech analysis failed.")


# ---------------------------------------------------------------------------
# MCQ
# ---------------------------------------------------------------------------


@router.post("/mcq", response_model=MCQAssessmentResponse)
def mcq_assessment(
    request: MCQAssessmentRequest,
    current_user_id: str = Depends(require_auth_uid),
) -> MCQAssessmentResponse:
    """Score MCQ behavioral questionnaire responses."""
    _enforce_payload_caps_mcq(request)

    try:
        return assess_mcq(
            user_id=current_user_id,
            answers=request.answers,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("MCQ scoring failed for user=%s", current_user_id)
        raise HTTPException(status_code=500, detail="MCQ assessment failed.")


# ---------------------------------------------------------------------------
# Combined report
# ---------------------------------------------------------------------------


@router.post("/report/generate", response_model=ReportResponse)
def generate_assessment_report(
    request: GenerateReportRequest,
    current_user_id: str = Depends(require_auth_uid),
) -> ReportResponse:
    """Generate a combined ASD assessment report.

    Aggregates results from eye tracking, speech analysis, and MCQ
    assessment modules using weighted scoring. Each referenced
    assessment is checked to ensure it belongs to the authenticated
    user before being included.
    """
    if not any([
        request.eye_tracking_assessment_id,
        request.speech_assessment_id,
        request.mcq_assessment_id,
    ]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one assessment ID must be provided.",
        )

    # Ownership checks — IDs must belong to the caller.
    _assert_assessment_owned(request.eye_tracking_assessment_id or "", current_user_id)
    _assert_assessment_owned(request.speech_assessment_id or "", current_user_id)
    _assert_assessment_owned(request.mcq_assessment_id or "", current_user_id)

    # Force the canonical user_id (overwrite anything the client sent).
    safe_request = request.model_copy(update={"user_id": current_user_id})

    try:
        return generate_report(safe_request)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Report generation failed for user=%s", current_user_id)
        raise HTTPException(status_code=500, detail="Report generation failed.")


@router.get("/report", response_model=ReportResponse)
def get_report_for_current_user(
    current_user_id: str = Depends(require_auth_uid),
) -> ReportResponse:
    """Get the latest report for the authenticated user."""
    result = get_user_report(current_user_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No report found.",
        )
    return result


# Legacy path kept for backwards compatibility — but ownership is now
# strictly enforced. Calling it for a different UID returns 404.
@router.get("/report/{user_id}", response_model=ReportResponse, deprecated=True)
def get_report_legacy(
    user_id: str,
    current_user_id: str = Depends(require_auth_uid),
) -> ReportResponse:
    if user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No report found.",
        )
    result = get_user_report(current_user_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No report found.",
        )
    return result


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------


@router.get("/history", response_model=UserAssessmentHistory)
def get_assessment_history_for_current_user(
    current_user_id: str = Depends(require_auth_uid),
) -> UserAssessmentHistory:
    """Get assessment history for the authenticated user."""
    return _load_history(current_user_id)


@router.get("/history/{user_id}", response_model=UserAssessmentHistory, deprecated=True)
def get_assessment_history_legacy(
    user_id: str,
    current_user_id: str = Depends(require_auth_uid),
) -> UserAssessmentHistory:
    if user_id != current_user_id:
        # Don't reveal whether the requested user exists.
        return UserAssessmentHistory(
            user_id=current_user_id, assessments=[], total_count=0
        )
    return _load_history(current_user_id)


def _load_history(user_id: str) -> UserAssessmentHistory:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, type, status, created_at FROM assessments "
            "WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()

    assessments = [
        AssessmentHistoryItem(
            assessment_id=row["id"],
            type=AssessmentType(row["type"]),
            status=AssessmentStatus(row["status"]),
            created_at=row["created_at"],
        )
        for row in rows
    ]
    return UserAssessmentHistory(
        user_id=user_id,
        assessments=assessments,
        total_count=len(assessments),
    )


# ---------------------------------------------------------------------------
# MCQ question bank — public read-only metadata.
# ---------------------------------------------------------------------------


@router.get("/questions")
def get_mcq_questions(
    current_user_id: str = Depends(require_auth_uid),
) -> dict:
    """Get the list of MCQ questions for the assessment.

    Auth is required to keep the question bank private to logged-in
    users; no per-user data is returned.
    """
    from ..services.mcq_assessment import ALL_QUESTIONS

    questions = []
    for q_id, q_data in sorted(ALL_QUESTIONS.items()):
        questions.append({
            "id": q_id,
            "question": q_data["text"],
            "domain": q_data["domain"],
            "options": [opt["text"] for opt in q_data["options"]],
        })

    return {"questions": questions, "total_count": len(questions)}
