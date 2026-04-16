"""ASD Detection Backend API.

FastAPI backend providing AI-powered Autism Spectrum Disorder (ASD) assessment
through three modules: eye tracking analysis, speech/voice detection, and
MCQ behavioral questionnaire scoring.
"""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers.assessment import router as assessment_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialize database on startup."""
    init_db()
    yield


app = FastAPI(
    title="ASD Detection API",
    description=(
        "AI-powered Autism Spectrum Disorder assessment backend. "
        "Provides eye tracking analysis (MediaPipe), speech analysis (librosa), "
        "and MCQ behavioral assessment scoring with combined ASD risk reports."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Include routers
app.include_router(assessment_router)


@app.get("/healthz")
async def healthz() -> dict:
    """Health check endpoint."""
    return {"status": "ok", "service": "asd-detection-api", "version": "1.0.0"}


@app.get("/")
async def root() -> dict:
    """Root endpoint with API information."""
    return {
        "service": "ASD Detection API",
        "version": "1.0.0",
        "description": "AI-powered Autism Spectrum Disorder assessment backend",
        "endpoints": {
            "eye_tracking": "/api/assessment/eye-tracking",
            "speech_analysis": "/api/assessment/speech",
            "mcq_assessment": "/api/assessment/mcq",
            "generate_report": "/api/assessment/report/generate",
            "get_report": "/api/assessment/report/{user_id}",
            "assessment_history": "/api/assessment/history/{user_id}",
            "mcq_questions": "/api/assessment/questions",
            "health": "/healthz",
            "docs": "/docs",
        },
    }
