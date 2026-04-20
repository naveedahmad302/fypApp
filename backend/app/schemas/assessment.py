"""Pydantic schemas for assessment endpoints."""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class AssessmentType(str, Enum):
    EYE_TRACKING = "eye_tracking"
    SPEECH = "speech"
    MCQ = "mcq"
    COMBINED = "combined"


class AssessmentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class RiskLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"


# --- Eye Tracking Schemas ---


class FrameMetadata(BaseModel):
    """Per-frame metadata sent by the frontend during multi-phase assessment."""
    phase: str = Field("free_gaze", description="Assessment phase: free_gaze, object_tracking, social_stimulus")
    timestamp_ms: int = Field(0, description="Timestamp in milliseconds since tracking start")
    stimulus_x: Optional[float] = Field(None, description="Moving stimulus X position (for object tracking phase)")
    stimulus_y: Optional[float] = Field(None, description="Moving stimulus Y position (for object tracking phase)")


class EyeTrackingRequest(BaseModel):
    """Request schema for eye tracking analysis. Accepts base64-encoded image frames."""
    user_id: str = Field(..., description="Firebase user UID")
    frames_base64: list[str] = Field(
        ...,
        description="List of base64-encoded image frames from the front camera",
        min_length=1,
    )
    frame_metadata: Optional[list[FrameMetadata]] = Field(
        None,
        description="Per-frame metadata with phase and stimulus position info",
    )


class GazeMetrics(BaseModel):
    gaze_points_count: int = Field(0, description="Number of detected gaze points")
    avg_fixation_duration: float = Field(0.0, description="Average fixation duration in seconds")
    attention_score: float = Field(0.0, description="Overall attention score (0-100)")
    gaze_pattern_type: str = Field("normal", description="Classified gaze pattern type")
    left_eye_openness: float = Field(0.0, description="Left eye openness ratio (0-1)")
    right_eye_openness: float = Field(0.0, description="Right eye openness ratio (0-1)")
    blink_rate: float = Field(0.0, description="Blinks per minute")
    saccade_frequency: float = Field(0.0, description="Rapid eye movements per minute")
    joint_attention_score: float = Field(0.0, description="Joint attention capability score (0-100)")


class BehaviorScores(BaseModel):
    """Per-feature ASD behavioral scores (0-100 each, higher = more atypical)."""
    eye_contact_score: float = Field(0.0, description="Eye contact quality score (0-100)")
    gaze_stability_score: float = Field(0.0, description="Gaze stability / jitter score (0-100)")
    fixation_score: float = Field(0.0, description="Fixation & staring behaviour score (0-100)")
    tracking_score: float = Field(0.0, description="Object tracking accuracy score (0-100)")
    atypical_movement_score: float = Field(0.0, description="Atypical eye movement score (0-100)")
    social_engagement_score: float = Field(0.0, description="Social engagement response score (0-100)")
    stimming_detected: bool = Field(False, description="Whether hand-near-eye stimming was detected")
    habituation_score: float = Field(0.0, description="Temporal habituation score (0-100)")
    blink_abnormality_score: float = Field(0.0, description="Blink rate abnormality score (0-100)")


class FrameAnalysisLog(BaseModel):
    """Per-frame detection log entry."""
    frame_index: int = Field(0, description="Frame index in the sequence")
    eye_detected: bool = Field(False, description="Whether eyes were detected in this frame")
    reason: Optional[str] = Field(None, description="Reason for failed detection")
    ear: Optional[float] = Field(None, description="Eye aspect ratio")
    gaze_ratio: Optional[float] = Field(None, description="Horizontal gaze ratio")
    phase: Optional[str] = Field(None, description="Assessment phase")
    hand_near_eye: Optional[bool] = Field(None, description="Hand detected near eye")


class EyeTrackingResponse(BaseModel):
    assessment_id: str
    status: AssessmentStatus
    eye_detected: bool = Field(True, description="Whether eyes were reliably detected (gate check)")
    metrics: GazeMetrics
    behavior_scores: BehaviorScores = Field(default_factory=BehaviorScores)
    asd_risk_score: float = Field(0.0, description="ASD risk score from eye tracking (0-100)")
    confidence_score: float = Field(0.0, description="Confidence in the result (0-100, higher = more reliable)")
    insights: list[str] = Field(default_factory=list)
    frame_log: list[FrameAnalysisLog] = Field(default_factory=list, description="Per-frame detection log")
    feedback_message: Optional[str] = Field(None, description="Real-time feedback message for the user")


# --- Speech Analysis Schemas ---

class SpeechAnalysisRequest(BaseModel):
    """Request schema for speech analysis. Accepts base64-encoded audio."""
    user_id: str = Field(..., description="Firebase user UID")
    audio_base64: str = Field(..., description="Base64-encoded audio file (WAV or MP3)")
    audio_format: str = Field("wav", description="Audio format: wav or mp3")


class SpeechMetrics(BaseModel):
    words_per_minute: float = Field(0.0, description="Estimated speaking rate")
    avg_pause_duration: float = Field(0.0, description="Average pause duration in seconds")
    clarity_score: float = Field(0.0, description="Speech clarity score (0-100)")
    vocal_variation_score: float = Field(0.0, description="Vocal variation/prosody score (0-100)")
    pitch_mean: float = Field(0.0, description="Mean pitch in Hz")
    pitch_std: float = Field(0.0, description="Pitch standard deviation")
    energy_mean: float = Field(0.0, description="Mean energy level")
    speech_rate_variability: float = Field(0.0, description="Variability in speech rate")
    prosody_score: float = Field(0.0, description="Overall prosody score (0-100)")
    monotone_score: float = Field(0.0, description="Monotone tendency score (0-100, higher = more monotone)")


class SpeechAnalysisResponse(BaseModel):
    assessment_id: str
    status: AssessmentStatus
    metrics: SpeechMetrics
    asd_risk_score: float = Field(0.0, description="ASD risk score from speech analysis (0-100)")
    insights: list[str] = Field(default_factory=list)


# --- MCQ Assessment Schemas ---

class MCQAnswer(BaseModel):
    question_id: int = Field(..., description="Question ID (1-based)")
    selected_option: int = Field(..., description="Selected option index (0-based)")


class MCQAssessmentRequest(BaseModel):
    """Request schema for MCQ assessment scoring."""
    user_id: str = Field(..., description="Firebase user UID")
    answers: list[MCQAnswer] = Field(
        ...,
        description="List of MCQ answers",
        min_length=1,
    )


class QuestionScore(BaseModel):
    question_id: int
    question_text: str
    selected_option: str
    score: float = Field(0.0, description="Score for this question (0-100)")
    asd_indicator_weight: float = Field(0.0, description="Weight of this question as ASD indicator")


class MCQAssessmentResponse(BaseModel):
    assessment_id: str
    status: AssessmentStatus
    question_scores: list[QuestionScore]
    total_score: float = Field(0.0, description="Total MCQ score (0-100)")
    risk_level: RiskLevel
    asd_risk_score: float = Field(0.0, description="ASD risk score from MCQ (0-100)")
    behavioral_insights: list[str] = Field(default_factory=list)


# --- Combined Report Schemas ---

class GenerateReportRequest(BaseModel):
    """Request to generate a combined ASD assessment report."""
    user_id: str = Field(..., description="Firebase user UID")
    eye_tracking_assessment_id: Optional[str] = None
    speech_assessment_id: Optional[str] = None
    mcq_assessment_id: Optional[str] = None


class ModuleResult(BaseModel):
    module_name: str
    score: float = Field(0.0, description="Module score (0-100)")
    risk_score: float = Field(0.0, description="ASD risk score (0-100)")
    insights: list[str] = Field(default_factory=list)
    status: str = "not_completed"


class ReportResponse(BaseModel):
    report_id: str
    user_id: str
    overall_score: float = Field(0.0, description="Overall assessment score (0-100)")
    risk_level: RiskLevel
    risk_percentage: float = Field(0.0, description="ASD risk percentage (0-100)")
    eye_tracking: ModuleResult
    speech_analysis: ModuleResult
    mcq_assessment: ModuleResult
    recommendations: list[str] = Field(default_factory=list)
    created_at: str


class AssessmentHistoryItem(BaseModel):
    assessment_id: str
    type: AssessmentType
    status: AssessmentStatus
    created_at: str


class UserAssessmentHistory(BaseModel):
    user_id: str
    assessments: list[AssessmentHistoryItem]
    total_count: int
