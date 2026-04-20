"""API routes for ASD assessment endpoints."""

from fastapi import APIRouter, HTTPException

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
from ..services.speech_analysis import analyze_speech
from ..services.mcq_assessment import assess_mcq
from ..services.report_generator import generate_report, get_user_report
from ..database import get_db

router = APIRouter(prefix="/api/assessment", tags=["Assessment"])


@router.post("/eye-tracking", response_model=EyeTrackingResponse)
def eye_tracking_analysis(request: EyeTrackingRequest) -> EyeTrackingResponse:
    """Analyze eye tracking data from camera frames.

    Accepts base64-encoded image frames captured from the front camera
    during the eye tracking assessment. Uses MediaPipe Face Mesh to
    detect eye landmarks, calculate gaze patterns, fixation duration,
    blink rate, and other metrics relevant to ASD screening.

    Returns detailed gaze metrics and an ASD risk score.
    """
    try:
        # Convert FrameMetadata pydantic models to dicts for the service
        frame_meta = None
        if request.frame_metadata:
            frame_meta = [fm.model_dump() for fm in request.frame_metadata]

        result = analyze_eye_tracking(
            user_id=request.user_id,
            frames_base64=request.frames_base64,
            frame_metadata=frame_meta,
        )
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Eye tracking analysis failed: {str(e)}",
        )


@router.post("/speech", response_model=SpeechAnalysisResponse)
def speech_analysis(request: SpeechAnalysisRequest) -> SpeechAnalysisResponse:
    """Analyze speech patterns from audio recording.

    Accepts a base64-encoded audio file (WAV or MP3) recorded during
    the speech assessment. Uses librosa for audio feature extraction
    including pitch analysis, energy patterns, MFCC features, pause
    detection, and speech rate estimation.

    Returns speech metrics and an ASD risk score based on prosody analysis.
    """
    try:
        result = analyze_speech(
            user_id=request.user_id,
            audio_base64=request.audio_base64,
            audio_format=request.audio_format,
        )
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Speech analysis failed: {str(e)}",
        )


@router.post("/mcq", response_model=MCQAssessmentResponse)
def mcq_assessment(request: MCQAssessmentRequest) -> MCQAssessmentResponse:
    """Score MCQ behavioral questionnaire responses.

    Accepts answers to the behavioral questionnaire. Each answer is
    scored against ASD-informed criteria covering domains like social
    interaction, communication, sensory processing, cognitive style,
    and flexibility.

    Returns individual question scores, total score, risk level,
    and behavioral insights.
    """
    try:
        result = assess_mcq(
            user_id=request.user_id,
            answers=request.answers,
        )
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"MCQ assessment failed: {str(e)}",
        )


@router.post("/report/generate", response_model=ReportResponse)
def generate_assessment_report(
    request: GenerateReportRequest,
) -> ReportResponse:
    """Generate a combined ASD assessment report.

    Aggregates results from eye tracking, speech analysis, and MCQ
    assessment modules using weighted scoring to produce a comprehensive
    ASD risk assessment report with personalized recommendations.

    At least one assessment module must be completed to generate a report.
    """
    if not any([
        request.eye_tracking_assessment_id,
        request.speech_assessment_id,
        request.mcq_assessment_id,
    ]):
        raise HTTPException(
            status_code=400,
            detail="At least one assessment ID must be provided",
        )

    try:
        result = generate_report(request)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Report generation failed: {str(e)}",
        )


@router.get("/report/{user_id}", response_model=ReportResponse)
def get_report(user_id: str) -> ReportResponse:
    """Get the latest assessment report for a user.

    Returns the most recent combined assessment report including
    scores from all completed modules, risk level, and recommendations.
    """
    result = get_user_report(user_id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"No report found for user {user_id}",
        )
    return result


@router.get("/history/{user_id}", response_model=UserAssessmentHistory)
def get_assessment_history(user_id: str) -> UserAssessmentHistory:
    """Get assessment history for a user.

    Returns a list of all assessments (eye tracking, speech, MCQ)
    completed by the user, ordered by most recent first.
    """
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, type, status, created_at FROM assessments WHERE user_id = ? ORDER BY created_at DESC",
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


@router.get("/questions")
def get_mcq_questions() -> dict:
    """Get the list of MCQ questions for the assessment.

    Returns all available questions with their options.
    The frontend can use this to dynamically load questions
    instead of hardcoding them.
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
