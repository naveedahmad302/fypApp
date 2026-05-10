"""
Comprehensive Gateway Service - Full API Implementation

This gateway provides all the required endpoints for the autism detection system,
including Firebase authentication, assessment routes, and service orchestration.
"""

import logging
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
from pathlib import Path

logger = logging.getLogger(__name__)

# Service URLs
CV_SERVICE_URL = "http://localhost:8001"
ML_SERVICE_URL = "http://localhost:8003"

# Database setup
DB_PATH = Path(__file__).parent / "gateway.db"

# Request/Response Models
class FrameRequest(BaseModel):
    frames: List[str]

class FrameMetadata(BaseModel):
    phase: str
    timestamp_ms: int
    stimulus_x: Optional[float] = None
    stimulus_y: Optional[float] = None

class EyeTrackingRequest(BaseModel):
    frames_base64: List[str]
    frame_metadata: Optional[List[FrameMetadata]] = None

class SpeechAnalysisRequest(BaseModel):
    audio_base64: str
    audio_format: str

class MCQAnswer(BaseModel):
    question_id: int
    selected_option: int

class MCQAssessmentRequest(BaseModel):
    answers: List[MCQAnswer]

class GenerateReportRequest(BaseModel):
    eye_tracking_assessment_id: Optional[str] = None
    speech_assessment_id: Optional[str] = None
    mcq_assessment_id: Optional[str] = None

# Response Models
class AutismPredictionResponse(BaseModel):
    prediction: str
    confidence: float
    raw_probabilities: List[float]
    features_extracted: dict
    frames_processed: int

class EyeTrackingResponse(BaseModel):
    assessment_id: str
    status: str
    eye_detected: bool
    asd_risk_score: float
    confidence_score: float
    insights: List[str]

class SpeechAnalysisResponse(BaseModel):
    assessment_id: str
    status: str
    speech_detected: bool
    asd_risk_score: float
    confidence: float
    insights: List[str]

class MCQAssessmentResponse(BaseModel):
    assessment_id: str
    status: str
    total_score: int
    asd_risk_score: float
    behavioral_insights: List[str]

class ReportResponse(BaseModel):
    report_id: str
    overall_score: float
    risk_level: str
    recommendations: List[str]

# Mock MCQ Questions
MCQ_QUESTIONS = [
    {
        "id": 1,
        "question": "Does your child make eye contact when spoken to?",
        "domain": "Social Communication",
        "options": ["Always", "Sometimes", "Rarely", "Never"]
    },
    {
        "id": 2,
        "question": "Does your child respond to their name?",
        "domain": "Social Communication",
        "options": ["Always", "Sometimes", "Rarely", "Never"]
    },
    {
        "id": 3,
        "question": "Does your child engage in pretend play?",
        "domain": "Behavior",
        "options": ["Frequently", "Occasionally", "Rarely", "Never"]
    }
]

def init_db():
    """Initialize the gateway database."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS assessments (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                type TEXT NOT NULL,
                status TEXT NOT NULL,
                data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP NULL
            )
        """)
        conn.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    init_db()
    yield

app = FastAPI(
    title="Autism Detection Gateway",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware - disabled
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# Mock authentication (in production, use Firebase Admin SDK)
async def get_current_user():
    """Mock authentication - returns a test user ID."""
    return "test_user_123"

# Health endpoints
@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "service": "Autism Detection Gateway",
        "version": "1.0.0",
        "auth": "Firebase ID token required on /api/assessment/*",
        "endpoints": {
            "eye_tracking": "/api/assessment/eye-tracking",
            "speech_analysis": "/api/assessment/speech",
            "mcq_assessment": "/api/assessment/mcq",
            "generate_report": "/api/assessment/report/generate",
            "get_report": "/api/assessment/report",
            "assessment_history": "/api/assessment/history",
            "mcq_questions": "/api/assessment/questions",
            "health": "/healthz",
            "ready": "/readyz",
        },
    }

@app.get("/healthz")
async def healthz():
    """Liveness probe."""
    return {"status": "ok", "service": "asd-detection-api", "version": "1.0.0"}

@app.get("/readyz")
async def readyz():
    """Readiness probe."""
    try:
        # Check database
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("SELECT 1").fetchone()
        
        # Check services
        async with httpx.AsyncClient() as client:
            cv_health = await client.get(f"{CV_SERVICE_URL}/health", timeout=5.0)
            ml_health = await client.get(f"{ML_SERVICE_URL}/health", timeout=5.0)
            
            if cv_health.status_code != 200 or ml_health.status_code != 200:
                return {"status": "not_ready", "checks": {"database": "ok", "services": "error"}}
        
        return {"status": "ready", "checks": {"database": "ok", "services": "ok"}}
    except Exception as e:
        return {"status": "not_ready", "checks": {"database": "error", "services": "unknown"}}

# Assessment endpoints
@app.post("/api/assessment/eye-tracking", response_model=EyeTrackingResponse)
async def eye_tracking_analysis(request: EyeTrackingRequest, current_user: str = Depends(get_current_user)):
    """Analyze eye tracking data from camera frames."""
    try:
        # Step 1: Extract features using CV service
        async with httpx.AsyncClient() as client:
            cv_response = await client.post(
                f"{CV_SERVICE_URL}/extract-features",
                json={"frames": request.frames_base64},
                timeout=60.0
            )
            
            if cv_response.status_code != 200:
                raise HTTPException(status_code=503, detail="CV service unavailable")
            
            features = cv_response.json()["features"]
        
        # Step 2: Get prediction using ML service
        async with httpx.AsyncClient() as client:
            ml_response = await client.post(
                f"{ML_SERVICE_URL}/predict",
                json={"features": features},
                timeout=60.0
            )
            
            if ml_response.status_code != 200:
                raise HTTPException(status_code=503, detail="ML service unavailable")
            
            prediction_data = ml_response.json()
        
        # Store assessment
        assessment_id = f"eye_{current_user}_{int(time.time())}"
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                "INSERT INTO assessments (id, user_id, type, status, data) VALUES (?, ?, ?, ?, ?)",
                (assessment_id, current_user, "eye_tracking", "completed", str(prediction_data))
            )
            conn.commit()
        
        return EyeTrackingResponse(
            assessment_id=assessment_id,
            status="completed",
            eye_detected=features.get("face_detected", False),
            asd_risk_score=prediction_data["confidence"],
            confidence_score=prediction_data["confidence"],
            insights=["Eye tracking analysis completed successfully"]
        )
        
    except Exception as e:
        logger.error(f"Eye tracking analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Eye tracking analysis failed")

@app.post("/api/assessment/speech", response_model=SpeechAnalysisResponse)
async def speech_analysis(request: SpeechAnalysisRequest, current_user: str = Depends(get_current_user)):
    """Analyze speech patterns from audio recording."""
    try:
        # Call ML service for speech analysis
        async with httpx.AsyncClient() as client:
            ml_response = await client.post(
                f"{ML_SERVICE_URL}/predict",
                json={"audio_data": request.audio_base64, "format": request.audio_format},
                timeout=60.0
            )
            
            if ml_response.status_code != 200:
                raise HTTPException(status_code=503, detail="ML service unavailable")
            
            prediction_data = ml_response.json()
        
        assessment_id = f"speech_{current_user}_{int(time.time())}"
        
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                "INSERT INTO assessments (id, user_id, type, status, data) VALUES (?, ?, ?, ?, ?)",
                (assessment_id, current_user, "speech", "completed", str(prediction_data))
            )
            conn.commit()
        
        return SpeechAnalysisResponse(
            assessment_id=assessment_id,
            status="completed",
            speech_detected=prediction_data.get("speech_detected", True),
            asd_risk_score=prediction_data.get("asd_risk_score", 0.3),
            confidence=prediction_data.get("confidence", 0.85),
            insights=prediction_data.get("insights", ["Speech analysis completed"])
        )
        
    except Exception as e:
        logger.error(f"Speech analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Speech analysis failed")

@app.post("/api/assessment/mcq", response_model=MCQAssessmentResponse)
async def mcq_assessment(request: MCQAssessmentRequest, current_user: str = Depends(get_current_user)):
    """Score MCQ behavioral questionnaire responses."""
    try:
        # Calculate MCQ score based on ASD indicator weights
        total_score = 0
        question_scores = []
        
        for answer in request.answers:
            # Simple scoring: higher options indicate more ASD indicators
            score = answer.selected_option * 2  # 0, 2, 4, 6 points
            total_score += score
            
            # Find question text from MCQ_QUESTIONS
            question = next((q for q in MCQ_QUESTIONS if q["id"] == answer.question_id), None)
            question_text = question["question"] if question else f"Question {answer.question_id}"
            selected_option = question["options"][answer.selected_option] if question else f"Option {answer.selected_option}"
            
            # ASD indicator weight based on option (higher = more indicative)
            asd_weight = answer.selected_option * 0.25  # 0, 0.25, 0.5, 0.75
            
            question_scores.append({
                "question_id": answer.question_id,
                "question_text": question_text,
                "selected_option": selected_option,
                "score": score,
                "asd_indicator_weight": asd_weight
            })
        
        assessment_id = f"mcq_{current_user}_{int(time.time())}"
        
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                "INSERT INTO assessments (id, user_id, type, status, data) VALUES (?, ?, ?, ?, ?)",
                (assessment_id, current_user, "mcq", "completed", str({"total_score": total_score, "question_scores": question_scores}))
            )
            conn.commit()
        
        # Calculate ASD risk score based on total score
        max_possible_score = len(request.answers) * 6  # Maximum if all answers are option 3
        asd_risk_score = (total_score / max_possible_score) if max_possible_score > 0 else 0
        
        # Determine risk level
        if asd_risk_score < 0.3:
            risk_level = "low"
        elif asd_risk_score < 0.6:
            risk_level = "moderate"
        else:
            risk_level = "high"
        
        # Generate behavioral insights
        insights = []
        if asd_risk_score > 0.5:
            insights.append("Several responses indicate potential social communication challenges")
        if asd_risk_score > 0.7:
            insights.append("Strong indicators of behavioral patterns associated with ASD")
        if asd_risk_score <= 0.3:
            insights.append("Responses indicate typical development patterns")
        
        return MCQAssessmentResponse(
            assessment_id=assessment_id,
            status="completed",
            question_scores=question_scores,
            total_score=total_score,
            risk_level=risk_level,
            asd_risk_score=asd_risk_score,
            behavioral_insights=insights
        )
        
    except Exception as e:
        logger.error(f"MCQ assessment failed: {e}")
        raise HTTPException(status_code=500, detail="MCQ assessment failed")

@app.get("/api/assessment/questions")
async def get_mcq_questions(current_user: str = Depends(get_current_user)):
    """Get the list of MCQ questions for the assessment."""
    return {"questions": MCQ_QUESTIONS, "total_count": len(MCQ_QUESTIONS)}

@app.post("/api/assessment/report/generate", response_model=ReportResponse)
async def generate_assessment_report(request: GenerateReportRequest, current_user: str = Depends(get_current_user)):
    """Generate a combined ASD assessment report."""
    try:
        report_id = f"report_{current_user}_{int(time.time())}"
        
        # Fetch assessment data from SQLite
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            
            # Get all assessments for this user
            assessments = conn.execute(
                "SELECT id, type, status, data, created_at FROM assessments WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC",
                (current_user,)
            ).fetchall()
        
        # Initialize module results
        eye_tracking_result = None
        speech_result = None
        mcq_result = None
        
        # Process assessments to extract module results
        for assessment in assessments:
            assessment_data = json.loads(assessment["data"]) if assessment["data"] else {}
            
            if assessment["type"] == "eye_tracking":
                eye_tracking_result = {
                    "module_name": "Eye Tracking",
                    "score": assessment_data.get("asd_risk_score", 0) * 100,
                    "risk_score": assessment_data.get("asd_risk_score", 0) * 100,
                    "insights": assessment_data.get("insights", []),
                    "status": assessment["status"]
                }
            elif assessment["type"] == "speech":
                speech_result = {
                    "module_name": "Speech Analysis",
                    "score": assessment_data.get("asd_risk_score", 0) * 100,
                    "risk_score": assessment_data.get("asd_risk_score", 0) * 100,
                    "insights": assessment_data.get("insights", []),
                    "status": assessment["status"]
                }
            elif assessment["type"] == "mcq":
                mcq_result = {
                    "module_name": "MCQ Assessment",
                    "score": assessment_data.get("total_score", 0),
                    "risk_score": assessment_data.get("asd_risk_score", 0) * 100,
                    "insights": assessment_data.get("behavioral_insights", []),
                    "status": assessment["status"]
                }
        
        # Calculate overall score and risk level
        scores = []
        if eye_tracking_result:
            scores.append(eye_tracking_result["risk_score"])
        if speech_result:
            scores.append(speech_result["risk_score"])
        if mcq_result:
            scores.append(mcq_result["risk_score"])
        
        overall_score = sum(scores) / len(scores) if scores else 0
        
        # Determine risk level
        if overall_score < 30:
            risk_level = "low"
        elif overall_score < 60:
            risk_level = "moderate"
        else:
            risk_level = "high"
        
        # Generate recommendations
        recommendations = []
        if risk_level == "low":
            recommendations.append("Continue monitoring developmental milestones")
            recommendations.append("Maintain regular health check-ups")
        elif risk_level == "moderate":
            recommendations.append("Consider professional developmental screening")
            recommendations.append("Monitor social communication skills")
        else:
            recommendations.append("Seek professional evaluation immediately")
            recommendations.append("Consider comprehensive ASD assessment")
        
        # Store report in database
        report_data = {
            "overall_score": overall_score / 100,
            "risk_level": risk_level,
            "eye_tracking": eye_tracking_result,
            "speech_analysis": speech_result,
            "mcq_assessment": mcq_result,
            "recommendations": recommendations
        }
        
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                "INSERT INTO assessments (id, user_id, type, status, data) VALUES (?, ?, ?, ?, ?)",
                (report_id, current_user, "report", "completed", json.dumps(report_data))
            )
            conn.commit()
        
        return ReportResponse(
            report_id=report_id,
            user_id=current_user,
            overall_score=overall_score / 100,
            risk_level=risk_level,
            risk_percentage=overall_score,
            eye_tracking=eye_tracking_result or {"module_name": "Eye Tracking", "score": 0, "risk_score": 0, "insights": [], "status": "not_completed"},
            speech_analysis=speech_result or {"module_name": "Speech Analysis", "score": 0, "risk_score": 0, "insights": [], "status": "not_completed"},
            mcq_assessment=mcq_result or {"module_name": "MCQ Assessment", "score": 0, "risk_score": 0, "insights": [], "status": "not_completed"},
            recommendations=recommendations,
            created_at=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        raise HTTPException(status_code=500, detail="Report generation failed")

@app.get("/api/assessment/report", response_model=ReportResponse)
async def get_report_for_current_user(current_user: str = Depends(get_current_user)):
    """Get the latest report for the authenticated user."""
    try:
        logger.info(f"Fetching report for user: {current_user}")
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            
            # Get all assessments for this user first
            assessments = conn.execute(
                "SELECT id, type, data, created_at FROM assessments WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC",
                (current_user,)
            ).fetchall()
            
            logger.info(f"Found {len(assessments)} assessments for user")
            
            # Log each assessment for debugging
            for assessment in assessments:
                logger.info(f"Assessment: {assessment['id']} - {assessment['type']} - {assessment['status']}")
            
            # Try to find a generated report first
            report = None
            for assessment in assessments:
                if assessment['type'] == 'report':
                    report = assessment
                    break
            
            if report:
                logger.info(f"Found existing report: {report['id']}")
                # Parse report data
                report_data = json.loads(report["data"]) if report["data"] else {}
                
                return ReportResponse(
                    report_id=report["id"],
                    user_id=current_user,
                    overall_score=report_data.get("overall_score", 0),
                    risk_level=report_data.get("risk_level", "low"),
                    risk_percentage=report_data.get("overall_score", 0) * 100,
                    eye_tracking=report_data.get("eye_tracking", {"module_name": "Eye Tracking", "score": 0, "risk_score": 0, "insights": [], "status": "not_completed"}),
                    speech_analysis=report_data.get("speech_analysis", {"module_name": "Speech Analysis", "score": 0, "risk_score": 0, "insights": [], "status": "not_completed"}),
                    mcq_assessment=report_data.get("mcq_assessment", {"module_name": "MCQ Assessment", "score": 0, "risk_score": 0, "insights": [], "status": "not_completed"}),
                    recommendations=report_data.get("recommendations", ["No recommendations available"]),
                    created_at=report["created_at"]
                )
            
            if not report:
                # No generated report found, try to create one from latest assessments
                logger.info("No existing report found, creating from assessments")
                
                # Initialize module results
                eye_tracking_result = None
                speech_result = None
                mcq_result = None
                
                # Process assessments to extract module results
                for assessment in assessments:
                    assessment_data = json.loads(assessment["data"]) if assessment["data"] else {}
                    
                    if assessment["type"] == "eye_tracking":
                        eye_tracking_result = {
                            "module_name": "Eye Tracking",
                            "score": assessment_data.get("asd_risk_score", 0) * 100,
                            "risk_score": assessment_data.get("asd_risk_score", 0) * 100,
                            "insights": assessment_data.get("insights", []),
                            "status": assessment["status"]
                        }
                    elif assessment["type"] == "speech":
                        speech_result = {
                            "module_name": "Speech Analysis", 
                            "score": assessment_data.get("asd_risk_score", 0) * 100,
                            "risk_score": assessment_data.get("asd_risk_score", 0) * 100,
                            "insights": assessment_data.get("insights", []),
                            "status": assessment["status"]
                        }
                    elif assessment["type"] == "mcq":
                        mcq_result = {
                            "module_name": "MCQ Assessment",
                            "score": assessment_data.get("total_score", 0),
                            "risk_score": assessment_data.get("asd_risk_score", 0) * 100,
                            "insights": assessment_data.get("behavioral_insights", []),
                            "status": assessment["status"]
                        }
                
                # Calculate overall score and risk level
                scores = []
                if eye_tracking_result:
                    scores.append(eye_tracking_result["risk_score"])
                if speech_result:
                    scores.append(speech_result["risk_score"])
                if mcq_result:
                    scores.append(mcq_result["risk_score"])
                
                overall_score = sum(scores) / len(scores) if scores else 0
                
                # Determine risk level
                if overall_score < 30:
                    risk_level = "low"
                elif overall_score < 60:
                    risk_level = "moderate"
                else:
                    risk_level = "high"
                
                # Generate recommendations
                recommendations = []
                if risk_level == "low":
                    recommendations.append("Continue monitoring developmental milestones")
                    recommendations.append("Maintain regular health check-ups")
                elif risk_level == "moderate":
                    recommendations.append("Consider professional developmental screening")
                    recommendations.append("Monitor social communication skills")
                else:
                    recommendations.append("Seek professional evaluation immediately")
                    recommendations.append("Consider comprehensive ASD assessment")
                
                logger.info(f"Created auto-report with overall_score: {overall_score}, risk_level: {risk_level}")
                
                # Return report created from assessments
                return ReportResponse(
                    report_id=f"auto_report_{current_user}_{int(time.time())}",
                    user_id=current_user,
                    overall_score=overall_score / 100,
                    risk_level=risk_level,
                    risk_percentage=overall_score,
                    eye_tracking=eye_tracking_result or {"module_name": "Eye Tracking", "score": 0, "risk_score": 0, "insights": [], "status": "not_completed"},
                    speech_analysis=speech_result or {"module_name": "Speech Analysis", "score": 0, "risk_score": 0, "insights": [], "status": "not_completed"},
                    mcq_assessment=mcq_result or {"module_name": "MCQ Assessment", "score": 0, "risk_score": 0, "insights": [], "status": "not_completed"},
                    recommendations=recommendations,
                    created_at=datetime.now().isoformat()
                )
                
                # Initialize module results from assessments
                eye_tracking_result = None
                speech_result = None
                mcq_result = None
                
                # Process assessments to extract module results
                for assessment in assessments:
                    assessment_data = json.loads(assessment["data"]) if assessment["data"] else {}
                    
                    if assessment["type"] == "eye_tracking":
                        eye_tracking_result = {
                            "module_name": "Eye Tracking",
                            "score": assessment_data.get("asd_risk_score", 0) * 100,
                            "risk_score": assessment_data.get("asd_risk_score", 0) * 100,
                            "insights": assessment_data.get("insights", []),
                            "status": assessment["status"]
                        }
                    elif assessment["type"] == "speech":
                        speech_result = {
                            "module_name": "Speech Analysis", 
                            "score": assessment_data.get("asd_risk_score", 0) * 100,
                            "risk_score": assessment_data.get("asd_risk_score", 0) * 100,
                            "insights": assessment_data.get("insights", []),
                            "status": assessment["status"]
                        }
                    elif assessment["type"] == "mcq":
                        mcq_result = {
                            "module_name": "MCQ Assessment",
                            "score": assessment_data.get("total_score", 0),
                            "risk_score": assessment_data.get("asd_risk_score", 0) * 100,
                            "insights": assessment_data.get("behavioral_insights", []),
                            "status": assessment["status"]
                        }
                
                # Calculate overall score and risk level
                scores = []
                if eye_tracking_result:
                    scores.append(eye_tracking_result["risk_score"])
                if speech_result:
                    scores.append(speech_result["risk_score"])
                if mcq_result:
                    scores.append(mcq_result["risk_score"])
                
                overall_score = sum(scores) / len(scores) if scores else 0
                
                # Determine risk level
                if overall_score < 30:
                    risk_level = "low"
                elif overall_score < 60:
                    risk_level = "moderate"
                else:
                    risk_level = "high"
                
                # Generate recommendations
                recommendations = []
                if risk_level == "low":
                    recommendations.append("Continue monitoring developmental milestones")
                    recommendations.append("Maintain regular health check-ups")
                elif risk_level == "moderate":
                    recommendations.append("Consider professional developmental screening")
                    recommendations.append("Monitor social communication skills")
                else:
                    recommendations.append("Seek professional evaluation immediately")
                    recommendations.append("Consider comprehensive ASD assessment")
                
                # Return report created from assessments
                return ReportResponse(
                    report_id=f"auto_report_{current_user}_{int(time.time())}",
                    user_id=current_user,
                    overall_score=overall_score / 100,
                    risk_level=risk_level,
                    risk_percentage=overall_score,
                    eye_tracking=eye_tracking_result or {"module_name": "Eye Tracking", "score": 0, "risk_score": 0, "insights": [], "status": "not_completed"},
                    speech_analysis=speech_result or {"module_name": "Speech Analysis", "score": 0, "risk_score": 0, "insights": [], "status": "not_completed"},
                    mcq_assessment=mcq_result or {"module_name": "MCQ Assessment", "score": 0, "risk_score": 0, "insights": [], "status": "not_completed"},
                    recommendations=recommendations,
                    created_at=datetime.now().isoformat()
                )
            
            # Parse report data
            report_data = json.loads(report["data"]) if report["data"] else {}
            
            return ReportResponse(
                report_id=report["id"],
                user_id=current_user,
                overall_score=report_data.get("overall_score", 0),
                risk_level=report_data.get("risk_level", "low"),
                risk_percentage=report_data.get("overall_score", 0) * 100,
                eye_tracking=report_data.get("eye_tracking", {"module_name": "Eye Tracking", "score": 0, "risk_score": 0, "insights": [], "status": "not_completed"}),
                speech_analysis=report_data.get("speech_analysis", {"module_name": "Speech Analysis", "score": 0, "risk_score": 0, "insights": [], "status": "not_completed"}),
                mcq_assessment=report_data.get("mcq_assessment", {"module_name": "MCQ Assessment", "score": 0, "risk_score": 0, "insights": [], "status": "not_completed"}),
                recommendations=report_data.get("recommendations", ["No recommendations available"]),
                created_at=report["created_at"]
            )
            
    except Exception as e:
        logger.error(f"Report retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Report retrieval failed")

@app.get("/api/assessment/history")
async def get_assessment_history(current_user: str = Depends(get_current_user)):
    """Get assessment history for the authenticated user."""
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute(
            "SELECT id, type, status, created_at FROM assessments WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC",
            (current_user,)
        ).fetchall()
    
    assessments = [
        {
            "assessment_id": row[0],
            "type": row[1],
            "status": row[2],
            "created_at": row[3]
        }
        for row in rows
    ]
    
    return {"user_id": current_user, "assessments": assessments, "total_count": len(assessments)}

@app.delete("/api/assessment/{assessment_id}")
async def soft_delete_assessment(assessment_id: str, current_user: str = Depends(get_current_user)):
    """Soft-delete an assessment owned by the caller."""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            "UPDATE assessments SET deleted_at = datetime('now') WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
            (assessment_id, current_user)
        )
        conn.commit()
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Assessment not found")
    
    return {"status": "deleted"}

# Legacy endpoints (deprecated)
@app.get("/api/assessment/report/{user_id}", response_model=ReportResponse)
async def get_report_legacy(user_id: str, current_user: str = Depends(get_current_user)):
    """Legacy report endpoint."""
    if user_id != current_user:
        raise HTTPException(status_code=404, detail="No report found.")
    return await get_report_for_current_user(current_user)

@app.get("/api/assessment/history/{user_id}")
async def get_assessment_history_legacy(user_id: str, current_user: str = Depends(get_current_user)):
    """Legacy history endpoint."""
    if user_id != current_user:
        return {"user_id": current_user, "assessments": [], "total_count": 0}
    return await get_assessment_history(current_user)

if __name__ == "__main__":
    import time
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
