"""MCQ assessment scoring service.

Scores behavioral questionnaire responses using weighted ASD-informed criteria
inspired by standardized screening tools (AQ-10, M-CHAT-R).
Each question maps to specific behavioral domains relevant to ASD detection.
"""

import json
import uuid

from ..database import get_db
from ..schemas.assessment import (
    AssessmentStatus,
    MCQAnswer,
    MCQAssessmentResponse,
    QuestionScore,
    RiskLevel,
)

# Question bank with ASD-relevant scoring weights
# Each option has a score (0-100) indicating ASD-related behavioral tendency
# Higher score = more typical of ASD traits
QUESTIONS = {
    1: {
        "text": "How often do you get lost in thought?",
        "domain": "cognitive_absorption",
        "asd_weight": 0.15,
        "options": [
            {"text": "Never - always aware", "score": 20},
            {"text": "Rarely - stay focused", "score": 30},
            {"text": "Sometimes - when engaged", "score": 50},
            {"text": "Often - frequently absorbed", "score": 75},
            {"text": "Always - almost always lost", "score": 90},
        ],
    },
    2: {
        "text": "How do you approach complex problems?",
        "domain": "problem_solving",
        "asd_weight": 0.20,
        "options": [
            {"text": "Break into smaller steps", "score": 70},
            {"text": "Look for patterns", "score": 80},
            {"text": "Discuss with others", "score": 20},
            {"text": "Trust intuition", "score": 40},
            {"text": "Take time to reflect", "score": 60},
        ],
    },
    3: {
        "text": "How do you prefer to learn?",
        "domain": "learning_style",
        "asd_weight": 0.15,
        "options": [
            {"text": "Hands-on experience", "score": 50},
            {"text": "Reading materials", "score": 60},
            {"text": "Visual aids", "score": 70},
            {"text": "Listening to explanations", "score": 30},
            {"text": "Trial and error", "score": 55},
        ],
    },
    4: {
        "text": "What describes your social energy?",
        "domain": "social_interaction",
        "asd_weight": 0.30,
        "options": [
            {"text": "Gain energy from social", "score": 10},
            {"text": "Need both social and alone", "score": 30},
            {"text": "Comfortable in both", "score": 40},
            {"text": "Prefer small groups", "score": 65},
            {"text": "Gain energy from solitude", "score": 85},
        ],
    },
    5: {
        "text": "How do you make decisions?",
        "domain": "decision_making",
        "asd_weight": 0.20,
        "options": [
            {"text": "Logic and facts", "score": 75},
            {"text": "Gut feelings", "score": 25},
            {"text": "Consider others", "score": 20},
            {"text": "Weigh all options", "score": 65},
            {"text": "Quick decisions", "score": 35},
        ],
    },
}

# Extended question bank for comprehensive assessment
EXTENDED_QUESTIONS = {
    6: {
        "text": "How do you react to unexpected changes in routine?",
        "domain": "flexibility",
        "asd_weight": 0.25,
        "options": [
            {"text": "Easily adapt", "score": 10},
            {"text": "Mild discomfort but manage", "score": 30},
            {"text": "Need time to adjust", "score": 55},
            {"text": "Significant distress", "score": 80},
            {"text": "Very difficult to handle", "score": 95},
        ],
    },
    7: {
        "text": "How do you interpret sarcasm or figurative language?",
        "domain": "communication",
        "asd_weight": 0.25,
        "options": [
            {"text": "Easily understand", "score": 10},
            {"text": "Usually get it", "score": 25},
            {"text": "Sometimes miss it", "score": 50},
            {"text": "Often take literally", "score": 75},
            {"text": "Almost always literal", "score": 90},
        ],
    },
    8: {
        "text": "How sensitive are you to sensory input (lights, sounds, textures)?",
        "domain": "sensory_processing",
        "asd_weight": 0.20,
        "options": [
            {"text": "Not sensitive at all", "score": 10},
            {"text": "Slightly sensitive", "score": 30},
            {"text": "Moderately sensitive", "score": 50},
            {"text": "Very sensitive", "score": 75},
            {"text": "Extremely sensitive", "score": 95},
        ],
    },
    9: {
        "text": "Do you have specific interests or hobbies you focus on intensely?",
        "domain": "restricted_interests",
        "asd_weight": 0.20,
        "options": [
            {"text": "Many varied interests", "score": 15},
            {"text": "Several interests", "score": 25},
            {"text": "A few focused interests", "score": 50},
            {"text": "One or two intense interests", "score": 75},
            {"text": "Single all-consuming interest", "score": 90},
        ],
    },
    10: {
        "text": "How comfortable are you with eye contact during conversation?",
        "domain": "social_communication",
        "asd_weight": 0.30,
        "options": [
            {"text": "Very comfortable", "score": 10},
            {"text": "Generally comfortable", "score": 25},
            {"text": "Depends on the person", "score": 45},
            {"text": "Often uncomfortable", "score": 75},
            {"text": "Very uncomfortable", "score": 90},
        ],
    },
}

# Merge all questions
ALL_QUESTIONS = {**QUESTIONS, **EXTENDED_QUESTIONS}


def _score_answers(answers: list[MCQAnswer]) -> tuple[list[QuestionScore], float, float]:
    """Score individual answers and calculate total."""
    question_scores: list[QuestionScore] = []
    weighted_sum = 0.0
    total_weight = 0.0

    for answer in answers:
        q_id = answer.question_id
        if q_id not in ALL_QUESTIONS:
            continue

        question = ALL_QUESTIONS[q_id]
        options = question["options"]

        # Validate option index
        if answer.selected_option < 0 or answer.selected_option >= len(options):
            continue

        selected = options[answer.selected_option]
        weight = question["asd_weight"]

        question_scores.append(
            QuestionScore(
                question_id=q_id,
                question_text=question["text"],
                selected_option=selected["text"],
                score=selected["score"],
                asd_indicator_weight=weight,
            )
        )

        weighted_sum += selected["score"] * weight
        total_weight += weight

    # Normalize to 0-100
    total_score = (weighted_sum / max(total_weight, 0.01))
    max_possible = 100.0

    return question_scores, round(total_score, 1), max_possible


def _determine_risk_level(score: float) -> RiskLevel:
    """Determine ASD risk level from MCQ score."""
    if score >= 65:
        return RiskLevel.HIGH
    elif score >= 40:
        return RiskLevel.MODERATE
    else:
        return RiskLevel.LOW


def _generate_behavioral_insights(
    question_scores: list[QuestionScore], risk_level: RiskLevel
) -> list[str]:
    """Generate behavioral insights from MCQ responses."""
    insights: list[str] = []

    # Analyze domain-specific patterns
    domain_scores: dict[str, list[float]] = {}
    for qs in question_scores:
        q_id = qs.question_id
        if q_id in ALL_QUESTIONS:
            domain = ALL_QUESTIONS[q_id]["domain"]
            if domain not in domain_scores:
                domain_scores[domain] = []
            domain_scores[domain].append(qs.score)

    # Social interaction insights
    social_scores = domain_scores.get("social_interaction", []) + domain_scores.get("social_communication", [])
    if social_scores:
        avg_social = sum(social_scores) / len(social_scores)
        if avg_social > 65:
            insights.append("Responses indicate preference for limited social interaction — notable ASD trait")
        elif avg_social > 40:
            insights.append("Moderate social preferences — some indicators of social differences")
        else:
            insights.append("Social responses within typical range")

    # Cognitive style insights
    cognitive_scores = domain_scores.get("problem_solving", []) + domain_scores.get("cognitive_absorption", [])
    if cognitive_scores:
        avg_cognitive = sum(cognitive_scores) / len(cognitive_scores)
        if avg_cognitive > 65:
            insights.append("Strong systematic/pattern-based thinking style")
        else:
            insights.append("Balanced cognitive approach")

    # Communication insights
    comm_scores = domain_scores.get("communication", [])
    if comm_scores:
        avg_comm = sum(comm_scores) / len(comm_scores)
        if avg_comm > 60:
            insights.append("Tendency toward literal interpretation — common in ASD")

    # Sensory processing insights
    sensory_scores = domain_scores.get("sensory_processing", [])
    if sensory_scores:
        avg_sensory = sum(sensory_scores) / len(sensory_scores)
        if avg_sensory > 60:
            insights.append("Heightened sensory sensitivity reported — common ASD indicator")

    # Flexibility insights
    flex_scores = domain_scores.get("flexibility", [])
    if flex_scores:
        avg_flex = sum(flex_scores) / len(flex_scores)
        if avg_flex > 60:
            insights.append("Difficulty with routine changes — may indicate need for predictability")

    # Restricted interests
    interest_scores = domain_scores.get("restricted_interests", [])
    if interest_scores:
        avg_interest = sum(interest_scores) / len(interest_scores)
        if avg_interest > 60:
            insights.append("Intense focused interests reported — characteristic ASD trait")

    # Overall summary
    if risk_level == RiskLevel.HIGH:
        insights.append("Multiple ASD-associated behavioral patterns identified across domains")
    elif risk_level == RiskLevel.MODERATE:
        insights.append("Some ASD-associated patterns present — further evaluation recommended")
    else:
        insights.append("Behavioral responses largely within typical range")

    return insights


def assess_mcq(user_id: str, answers: list[MCQAnswer]) -> MCQAssessmentResponse:
    """Main entry point: score MCQ answers and store results."""
    assessment_id = str(uuid.uuid4())

    # Create assessment record
    with get_db() as conn:
        conn.execute(
            "INSERT INTO assessments (id, user_id, type, status) VALUES (?, ?, 'mcq', 'processing')",
            (assessment_id, user_id),
        )

    try:
        # Score answers
        question_scores, total_score, max_possible = _score_answers(answers)
        risk_level = _determine_risk_level(total_score)
        insights = _generate_behavioral_insights(question_scores, risk_level)

        # ASD risk score from MCQ (same as total_score for MCQ)
        asd_risk = total_score

        # Store results
        result_id = str(uuid.uuid4())
        with get_db() as conn:
            conn.execute(
                """INSERT INTO mcq_results
                (id, assessment_id, answers_json, question_scores_json,
                 total_score, max_possible_score, risk_level,
                 behavioral_insights_json, asd_risk_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    result_id,
                    assessment_id,
                    json.dumps([a.model_dump() for a in answers]),
                    json.dumps([qs.model_dump() for qs in question_scores]),
                    total_score,
                    max_possible,
                    risk_level.value,
                    json.dumps(insights),
                    asd_risk,
                ),
            )
            conn.execute(
                "UPDATE assessments SET status = 'completed', updated_at = datetime('now') WHERE id = ?",
                (assessment_id,),
            )

        return MCQAssessmentResponse(
            assessment_id=assessment_id,
            status=AssessmentStatus.COMPLETED,
            question_scores=question_scores,
            total_score=total_score,
            risk_level=risk_level,
            asd_risk_score=asd_risk,
            behavioral_insights=insights,
        )

    except Exception as e:
        with get_db() as conn:
            conn.execute(
                "UPDATE assessments SET status = 'failed', updated_at = datetime('now') WHERE id = ?",
                (assessment_id,),
            )
        raise RuntimeError(f"MCQ assessment failed: {e}") from e
