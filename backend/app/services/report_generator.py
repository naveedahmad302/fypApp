"""Combined ASD assessment report generation service.

Aggregates results from eye tracking, speech analysis, and MCQ assessment
modules to produce a comprehensive ASD risk assessment report with
weighted scoring and personalized recommendations.
"""

import json
import uuid

from ..database import get_db
from ..schemas.assessment import (
    GenerateReportRequest,
    ModuleResult,
    ReportResponse,
    RiskLevel,
)

# Module weights for combined scoring
MODULE_WEIGHTS = {
    "eye_tracking": 0.35,  # Eye contact and gaze patterns are strong ASD indicators
    "speech": 0.30,  # Speech prosody and patterns
    "mcq": 0.35,  # Behavioral questionnaire
}


def _get_eye_tracking_result(assessment_id: str) -> dict | None:
    """Fetch eye tracking results from database."""
    with get_db() as conn:
        row = conn.execute(
            """SELECT e.*, a.status FROM eye_tracking_results e
               JOIN assessments a ON a.id = e.assessment_id
               WHERE e.assessment_id = ?""",
            (assessment_id,),
        ).fetchone()
        if row:
            return dict(row)
    return None


def _get_speech_result(assessment_id: str) -> dict | None:
    """Fetch speech analysis results from database."""
    with get_db() as conn:
        row = conn.execute(
            """SELECT s.*, a.status FROM speech_results s
               JOIN assessments a ON a.id = s.assessment_id
               WHERE s.assessment_id = ?""",
            (assessment_id,),
        ).fetchone()
        if row:
            return dict(row)
    return None


def _get_mcq_result(assessment_id: str) -> dict | None:
    """Fetch MCQ assessment results from database."""
    with get_db() as conn:
        row = conn.execute(
            """SELECT m.*, a.status FROM mcq_results m
               JOIN assessments a ON a.id = m.assessment_id
               WHERE m.assessment_id = ?""",
            (assessment_id,),
        ).fetchone()
        if row:
            return dict(row)
    return None


def _generate_recommendations(
    risk_level: RiskLevel,
    eye_result: dict | None,
    speech_result: dict | None,
    mcq_result: dict | None,
) -> list[str]:
    """Generate personalized recommendations based on assessment results."""
    recommendations: list[str] = []

    if risk_level == RiskLevel.HIGH:
        recommendations.append(
            "We recommend consulting with a healthcare professional "
            "specializing in autism spectrum disorders for a comprehensive evaluation."
        )
        recommendations.append(
            "Consider scheduling a formal diagnostic assessment with a "
            "developmental pediatrician or clinical psychologist."
        )
    elif risk_level == RiskLevel.MODERATE:
        recommendations.append(
            "Some indicators suggest further evaluation may be beneficial. "
            "Consider discussing these results with your healthcare provider."
        )
    else:
        recommendations.append(
            "Results are within typical ranges. Continue monitoring "
            "development and consult a professional if concerns arise."
        )

    # Eye tracking specific recommendations
    if eye_result:
        attention_score = eye_result.get("attention_score", 0)
        if attention_score < 40:
            recommendations.append(
                "Eye tracking shows reduced attention patterns. Activities "
                "that encourage joint attention and eye contact may be helpful."
            )
        gaze_pattern = eye_result.get("gaze_pattern_type", "")
        if gaze_pattern == "avoidant":
            recommendations.append(
                "Gaze avoidance patterns were detected. Social skills "
                "training focusing on comfortable eye contact may be beneficial."
            )

    # Speech specific recommendations
    if speech_result:
        monotone = speech_result.get("monotone_score", 0)
        if monotone > 60:
            recommendations.append(
                "Speech analysis indicates limited vocal variation. "
                "Speech therapy focusing on prosody and intonation may help."
            )
        wpm = speech_result.get("words_per_minute", 0)
        if wpm < 80:
            recommendations.append(
                "Speaking rate is below typical range. Speech-language "
                "therapy may help develop more fluent communication."
            )

    # MCQ specific recommendations
    if mcq_result:
        risk = mcq_result.get("risk_level", "low")
        if risk == "high":
            recommendations.append(
                "Behavioral questionnaire responses indicate significant "
                "ASD-associated traits across multiple domains."
            )

    # General recommendations
    recommendations.append(
        "This assessment is a screening tool and should not be used as "
        "a definitive diagnosis. Professional clinical evaluation is "
        "recommended for accurate diagnosis."
    )

    return recommendations


def generate_report(request: GenerateReportRequest) -> ReportResponse:
    """Generate a combined ASD assessment report from all modules."""
    report_id = str(uuid.uuid4())

    # Fetch results for each module
    eye_result = None
    speech_result = None
    mcq_result = None

    eye_module = ModuleResult(module_name="Eye Tracking", status="not_completed")
    speech_module = ModuleResult(module_name="Speech Analysis", status="not_completed")
    mcq_module = ModuleResult(module_name="MCQ Assessment", status="not_completed")

    if request.eye_tracking_assessment_id:
        eye_result = _get_eye_tracking_result(request.eye_tracking_assessment_id)
        if eye_result:
            insights = json.loads(eye_result.get("insights_json", "[]"))
            eye_module = ModuleResult(
                module_name="Eye Tracking",
                score=round(eye_result.get("attention_score", 0), 1),
                risk_score=round(eye_result.get("asd_risk_score", 0), 1),
                insights=insights,
                status="completed",
            )

    if request.speech_assessment_id:
        speech_result = _get_speech_result(request.speech_assessment_id)
        if speech_result:
            insights = json.loads(speech_result.get("insights_json") or "[]")
            # Module "score" is a non-risk view of the result. Prefer a
            # direct inversion of the upgraded ASD likelihood (clamped to
            # 0-100) so the report number always lines up with the
            # probabilistic model; fall back to the legacy clarity score
            # for rows produced before the upgrade.
            likelihood = speech_result.get("final_asd_likelihood")
            if likelihood is not None:
                module_score = round((1.0 - float(likelihood)) * 100.0, 1)
            else:
                module_score = round(speech_result.get("clarity_score", 0), 1)
            speech_module = ModuleResult(
                module_name="Speech Analysis",
                score=module_score,
                risk_score=round(speech_result.get("asd_risk_score", 0), 1),
                insights=insights,
                status="completed",
            )

    if request.mcq_assessment_id:
        mcq_result = _get_mcq_result(request.mcq_assessment_id)
        if mcq_result:
            insights = json.loads(mcq_result.get("behavioral_insights_json", "[]"))
            mcq_module = ModuleResult(
                module_name="MCQ Assessment",
                score=round(mcq_result.get("total_score", 0), 1),
                risk_score=round(mcq_result.get("asd_risk_score", 0), 1),
                insights=insights,
                status="completed",
            )

    # Calculate weighted overall score
    total_weight = 0.0
    weighted_risk = 0.0
    completed_modules = 0

    if eye_module.status == "completed":
        weighted_risk += eye_module.risk_score * MODULE_WEIGHTS["eye_tracking"]
        total_weight += MODULE_WEIGHTS["eye_tracking"]
        completed_modules += 1

    if speech_module.status == "completed":
        weighted_risk += speech_module.risk_score * MODULE_WEIGHTS["speech"]
        total_weight += MODULE_WEIGHTS["speech"]
        completed_modules += 1

    if mcq_module.status == "completed":
        weighted_risk += mcq_module.risk_score * MODULE_WEIGHTS["mcq"]
        total_weight += MODULE_WEIGHTS["mcq"]
        completed_modules += 1

    # Normalize risk score
    if total_weight > 0:
        overall_risk = weighted_risk / total_weight
    else:
        overall_risk = 0.0

    # Overall score is inverse of risk (higher score = better)
    overall_score = round(100 - overall_risk, 1)

    # Determine risk level
    if overall_risk >= 65:
        risk_level = RiskLevel.HIGH
    elif overall_risk >= 40:
        risk_level = RiskLevel.MODERATE
    else:
        risk_level = RiskLevel.LOW

    # Generate recommendations
    recommendations = _generate_recommendations(
        risk_level, eye_result, speech_result, mcq_result
    )

    # Store report
    with get_db() as conn:
        conn.execute(
            """INSERT INTO reports
            (id, user_id, overall_score, eye_tracking_score, speech_score,
             mcq_score, risk_level, risk_percentage, recommendations_json,
             eye_assessment_id, speech_assessment_id, mcq_assessment_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                report_id,
                request.user_id,
                overall_score,
                eye_module.score if eye_module.status == "completed" else None,
                speech_module.score if speech_module.status == "completed" else None,
                mcq_module.score if mcq_module.status == "completed" else None,
                risk_level.value,
                round(overall_risk, 1),
                json.dumps(recommendations),
                request.eye_tracking_assessment_id,
                request.speech_assessment_id,
                request.mcq_assessment_id,
            ),
        )

    return ReportResponse(
        report_id=report_id,
        user_id=request.user_id,
        overall_score=overall_score,
        risk_level=risk_level,
        risk_percentage=round(overall_risk, 1),
        eye_tracking=eye_module,
        speech_analysis=speech_module,
        mcq_assessment=mcq_module,
        recommendations=recommendations,
        created_at=_get_report_created_at(report_id),
    )


def get_user_report(user_id: str) -> ReportResponse | None:
    """Get the latest report for a user."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
            (user_id,),
        ).fetchone()

    if not row:
        return None

    report = dict(row)
    recommendations = json.loads(report.get("recommendations_json", "[]"))

    # Build module results
    eye_module = ModuleResult(module_name="Eye Tracking", status="not_completed")
    speech_module = ModuleResult(module_name="Speech Analysis", status="not_completed")
    mcq_module = ModuleResult(module_name="MCQ Assessment", status="not_completed")

    if report.get("eye_assessment_id"):
        eye_result = _get_eye_tracking_result(report["eye_assessment_id"])
        if eye_result:
            eye_module = ModuleResult(
                module_name="Eye Tracking",
                score=round(report.get("eye_tracking_score", 0) or 0, 1),
                risk_score=round(eye_result.get("asd_risk_score", 0), 1),
                insights=json.loads(eye_result.get("insights_json", "[]")),
                status="completed",
            )

    if report.get("speech_assessment_id"):
        speech_result = _get_speech_result(report["speech_assessment_id"])
        if speech_result:
            speech_module = ModuleResult(
                module_name="Speech Analysis",
                score=round(report.get("speech_score", 0) or 0, 1),
                risk_score=round(speech_result.get("asd_risk_score", 0), 1),
                insights=json.loads(speech_result.get("insights_json", "[]")),
                status="completed",
            )

    if report.get("mcq_assessment_id"):
        mcq_result = _get_mcq_result(report["mcq_assessment_id"])
        if mcq_result:
            mcq_module = ModuleResult(
                module_name="MCQ Assessment",
                score=round(report.get("mcq_score", 0) or 0, 1),
                risk_score=round(mcq_result.get("asd_risk_score", 0), 1),
                insights=json.loads(mcq_result.get("behavioral_insights_json", "[]")),
                status="completed",
            )

    return ReportResponse(
        report_id=report["id"],
        user_id=report["user_id"],
        overall_score=round(report.get("overall_score", 0), 1),
        risk_level=RiskLevel(report.get("risk_level", "low")),
        risk_percentage=round(report.get("risk_percentage", 0), 1),
        eye_tracking=eye_module,
        speech_analysis=speech_module,
        mcq_assessment=mcq_module,
        recommendations=recommendations,
        created_at=report.get("created_at", ""),
    )


def _get_report_created_at(report_id: str) -> str:
    """Get the created_at timestamp for a report."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT created_at FROM reports WHERE id = ?", (report_id,)
        ).fetchone()
        if row:
            return row["created_at"]
    return ""
