"""ASD Detection Backend API.

FastAPI backend providing AI-powered Autism Spectrum Disorder (ASD) assessment
through three modules: eye tracking analysis, speech/voice detection, and
MCQ behavioral questionnaire scoring.

Security posture:

* All ``/api/assessment/*`` endpoints require a valid Firebase ID token.
* The verified UID, **not the request body**, is the only source of identity.
* CORS is restricted to a configurable allow-list — no wildcard with
  credentials.
* Request bodies are capped via :class:`MaxBodySizeMiddleware`.
* Errors are returned in a uniform envelope and never leak tracebacks in
  production.
"""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
import logging

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .database import init_db, get_db_health
from .logging_config import setup_logging
from .middleware import (
    ErrorEnvelopeMiddleware,
    MaxBodySizeMiddleware,
    SecurityHeadersMiddleware,
    http_exception_handler,
    validation_exception_handler,
)
from .routers.assessment import router as assessment_router


_settings = get_settings()


# Install structured logging immediately, before any other module emits
# its first log line. Format is JSON in production, text in development
# (override with ``ASD_LOG_FORMAT=json|text``).
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialise database (and warm any other singletons) on startup."""
    init_db()
    logger.info(
        "ASD backend starting up: env=%s, cors_origins=%s, max_body=%dKB",
        _settings.env,
        _settings.cors_allowed_origins,
        _settings.max_request_body_bytes // 1024,
    )
    yield


app = FastAPI(
    title="ASD Detection API",
    description=(
        "AI-powered Autism Spectrum Disorder assessment backend. "
        "Provides eye tracking analysis (MediaPipe + trained MLP), "
        "speech analysis (librosa), and MCQ behavioral assessment scoring "
        "with combined ASD risk reports. All data-access endpoints require "
        "a valid Firebase ID token."
    ),
    version="1.1.0",
    lifespan=lifespan,
    # Hide internal docs in production.
    docs_url=None if _settings.is_production else "/docs",
    redoc_url=None if _settings.is_production else "/redoc",
    openapi_url=None if _settings.is_production else "/openapi.json",
)


# ---------------------------------------------------------------------------
# Middleware (order matters: outermost first).
# ---------------------------------------------------------------------------

# 1. Catch unhandled errors so security headers etc. still apply.
app.add_middleware(ErrorEnvelopeMiddleware)

# 2. Hard cap request body size BEFORE any handler reads it.
app.add_middleware(
    MaxBodySizeMiddleware,
    max_bytes=_settings.max_request_body_bytes,
)

# 3. Attach security headers to every response.
app.add_middleware(SecurityHeadersMiddleware)

# 4. CORS — strict allow-list, never a wildcard combined with credentials.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    max_age=600,
)


# ---------------------------------------------------------------------------
# Exception handlers (sanitised envelope).
# ---------------------------------------------------------------------------

app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(assessment_router)


# ---------------------------------------------------------------------------
# Public endpoints (no auth)
# ---------------------------------------------------------------------------


@app.get("/healthz")
async def healthz() -> dict:
    """Liveness probe — must remain unauthenticated."""
    return {"status": "ok", "service": "asd-detection-api", "version": "1.1.0"}


@app.get("/readyz")
async def readyz() -> dict:
    """Readiness probe — verifies dependencies are reachable.

    The probe runs cheap, side-effect-free checks against:

    * **SQLite** — opens a connection and runs ``PRAGMA integrity_check``
      against the soft-delete columns added in PR-B.
    * **Firebase Admin** — confirms the verifier is initialised and the
      service account is loadable (only meaningful in non-test mode).

    Returns 503 if any check fails so Kubernetes / Cloud Run pull the
    pod out of rotation rather than serving requests it can't actually
    fulfil.
    """
    settings = get_settings()
    checks: dict[str, str] = {}

    # SQLite — fast (~1ms) read against the assessments table.
    try:
        get_db_health()
        checks["sqlite"] = "ok"
    except Exception as exc:  # pragma: no cover - exercised by tests
        logger.error("readyz: sqlite check failed: %s", exc)
        checks["sqlite"] = f"error: {exc.__class__.__name__}"

    # Firebase Admin — skip in test mode (we use stub tokens, no SDK).
    if settings.auth_test_mode:
        checks["firebase_admin"] = "skipped (test mode)"
    else:
        try:
            # Lazy import — module-level import would force credential
            # validation at server start.
            from .auth import _ensure_firebase_initialised

            _ensure_firebase_initialised()
            checks["firebase_admin"] = "ok"
        except Exception as exc:  # pragma: no cover
            logger.error("readyz: firebase admin check failed: %s", exc)
            checks["firebase_admin"] = f"error: {exc.__class__.__name__}"

    is_ok = all(value == "ok" or value.startswith("skipped") for value in checks.values())
    if not is_ok:
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "checks": checks},
        )
    return {"status": "ready", "checks": checks}


@app.get("/")
async def root() -> dict:
    """Root endpoint with API information.

    All ``/api/assessment/*`` endpoints require a Firebase ID token in
    the ``Authorization: Bearer <token>`` header.
    """
    return {
        "service": "ASD Detection API",
        "version": "1.1.0",
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
            "docs": "/docs" if not _settings.is_production else None,
        },
    }
