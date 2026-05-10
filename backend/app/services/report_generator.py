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
    "eye_tracking": 0.25,  # Eye contact and gaze patterns are strong ASD indicators
    "speech": 0.25,  # Speech prosody and patterns
    "mcq": 0.50,  # Behavioral questionnaire - primary assessment weight
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
    """Generate personalized recommendations based on three-assessment results."""
    recommendations: list[str] = []

    # Combined assessment recommendations
    if risk_level == RiskLevel.HIGH:
        recommendations.append(
            "HIGH RISK: Strong ASD indicators detected across multiple assessments. "
            "Immediate consultation with autism specialist recommended for comprehensive evaluation."
        )
        recommendations.append(
            "Schedule diagnostic assessment with developmental pediatrician or clinical psychologist "
            "specializing in autism spectrum disorders."
        )
        recommendations.append(
            "Early intervention services may be beneficial - explore occupational therapy, "
            "speech therapy, and social skills training."
        )
    elif risk_level == RiskLevel.MODERATE:
        recommendations.append(
            "MODERATE RISK: Some ASD indicators present across assessments. "
            "Discuss results with healthcare provider for further evaluation."
        )
        recommendations.append(
            "Consider developmental monitoring and targeted interventions for specific concerns."
        )
        recommendations.append(
            "Speech therapy or social skills training may help address identified areas."
        )
    else:
        recommendations.append(
            "LOW RISK: Assessment results within typical developmental ranges."
        )
        recommendations.append(
            "Continue monitoring developmental milestones and social communication skills."
        )
        recommendations.append(
            "Consult professional if new concerns arise or if development plateaus."
        )

    # Overall assessment recommendations based on three-module results
    if risk_level == RiskLevel.HIGH:
        recommendations.append(
                "STRONG ASD INDICATORS: Multiple assessment modules show concerning patterns. "
                "Immediate comprehensive evaluation by autism specialist recommended."
            )
        recommendations.append(
                "Focus on social communication development, joint attention skills, and adaptive behaviors."
            )
        recommendations.append(
                "Consider early intervention services: occupational therapy, speech therapy, and ABA therapy."
            )
        recommendations.append(
                "Develop structured routines and visual supports to improve daily functioning."
            )
    elif risk_level == RiskLevel.MODERATE:
        recommendations.append(
                "MODERATE ASD INDICATORS: Some assessment areas show atypical patterns. "
                "Further evaluation by healthcare provider recommended for clarity."
            )
        recommendations.append(
                "Target specific areas of concern identified in assessments with focused interventions."
            )
        recommendations.append(
                "Social skills training and communication therapy may address identified challenges."
            )
        recommendations.append(
                "Monitor developmental progress and adjust support strategies as needed."
            )
    else:
        recommendations.append(
                "TYPICAL DEVELOPMENT: Assessment results within normal ranges. "
                "Continue monitoring developmental milestones and social communication."
            )
        recommendations.append(
                "Maintain supportive environment for continued healthy development."
            )
        recommendations.append(
                "Regular developmental check-ups recommended to track progress."
            )

    # Integrated recommendations based on assessment patterns
    completed_count = sum([
        1 for result in [eye_result, speech_result, mcq_result] 
        if result and result.get("status") == "completed"
    ])
    
    if completed_count == 3:
        recommendations.append(
            "COMPLETE ASSESSMENT: All three modules completed for comprehensive evaluation. "
            "Results provide holistic view across behavioral, visual, and verbal domains."
        )
    elif completed_count == 2:
        recommendations.append(
            "PARTIAL ASSESSMENT: Two modules completed. "
            "Consider completing remaining assessment for more comprehensive evaluation."
        )
    elif completed_count == 1:
        recommendations.append(
            "LIMITED ASSESSMENT: Only one module completed. "
            "Complete additional assessments for more accurate risk evaluation."
        )

    # Resource recommendations
    if risk_level in [RiskLevel.HIGH, RiskLevel.MODERATE]:
        recommendations.append(
            "RESOURCES: Contact local autism support organizations and early intervention services."
        )
        recommendations.append(
            "RESOURCES: Explore parent training programs and educational support services."
        )
        recommendations.append(
            "RESOURCES: Consider assistive technology and communication aids if needed."
        )

    # Medical disclaimer
    recommendations.append(
        "MEDICAL DISCLAIMER: This is a screening tool, not diagnostic. "
        "Professional clinical evaluation required for formal ASD diagnosis."
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

    # Determine risk level (aligned with MCQ 50% weight thresholds)
    if overall_risk >= 60:
        risk_level = RiskLevel.HIGH
    elif overall_risk >= 41:
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
    """Get the latest live report for a user.

    Soft-deleted reports (``deleted_at IS NOT NULL``) are skipped — they
    remain in the table for audit but are invisible to ordinary owner
    queries.
    """
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM reports "
            "WHERE user_id = ? AND deleted_at IS NULL "
            "ORDER BY created_at DESC LIMIT 1",
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
