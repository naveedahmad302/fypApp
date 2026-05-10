"""MCQ assessment scoring service.

Scores behavioral questionnaire responses using standardized screening tools:
- M-CHAT-R (Modified Checklist for Autism in Toddlers) for 16-30 months
- CAST (Childhood Autism Spectrum Test) for 4-11 years

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

# M-CHAT-R (Modified Checklist for Autism in Toddlers)
# Target: 16-30 months
# These 10 items are "Critical Items" that most strongly predict ASD risk in toddlers
M_CHAT_R_QUESTIONS = {
    1: {
        "text": "If you point at something across the room, does your child look at it?",
        "domain": "joint_attention",
        "asd_weight": 0.15,
        "options": [
            {"text": "Yes", "score": 10},
            {"text": "No", "score": 90},
        ],
    },
    2: {
        "text": "Does your child point with one finger to show you something interesting?",
        "domain": "gesture_communication",
        "asd_weight": 0.15,
        "options": [
            {"text": "Yes", "score": 10},
            {"text": "No", "score": 90},
        ],
    },
    3: {
        "text": "Does your child play pretend (e.g., talk on a toy phone, feed a doll)?",
        "domain": "imaginative_play",
        "asd_weight": 0.15,
        "options": [
            {"text": "Yes", "score": 10},
            {"text": "No", "score": 90},
        ],
    },
    4: {
        "text": "Does your child respond when you call their name?",
        "domain": "response_to_name",
        "asd_weight": 0.20,
        "options": [
            {"text": "Yes", "score": 10},
            {"text": "No", "score": 90},
        ],
    },
    5: {
        "text": "Does your child look you in the eye when you are talking or playing?",
        "domain": "eye_contact",
        "asd_weight": 0.20,
        "options": [
            {"text": "Yes", "score": 10},
            {"text": "No", "score": 90},
        ],
    },
    6: {
        "text": "Does your child try to copy what you do (e.g., wave, clap)?",
        "domain": "imitation",
        "asd_weight": 0.15,
        "options": [
            {"text": "Yes", "score": 10},
            {"text": "No", "score": 90},
        ],
    },
    7: {
        "text": "If you turn to look at something, does your child look too?",
        "domain": "joint_attention",
        "asd_weight": 0.15,
        "options": [
            {"text": "Yes", "score": 10},
            {"text": "No", "score": 90},
        ],
    },
    8: {
        "text": "Does your child try to get you to watch them (e.g., 'Look at me')?",
        "domain": "social_initiation",
        "asd_weight": 0.15,
        "options": [
            {"text": "Yes", "score": 10},
            {"text": "No", "score": 90},
        ],
    },
    9: {
        "text": "Does your child understand when you tell them to do something?",
        "domain": "comprehension",
        "asd_weight": 0.15,
        "options": [
            {"text": "Yes", "score": 10},
            {"text": "No", "score": 90},
        ],
    },
    10: {
        "text": "Does your child make unusual finger movements near their eyes?",
        "domain": "repetitive_behaviors",
        "asd_weight": 0.15,
        "options": [
            {"text": "Yes", "score": 90},
            {"text": "No", "score": 10},
        ],
    },
}

# CAST (Childhood Autism Spectrum Test)
# Target: 4-11 years
# These 10 questions focus on social communication and repetitive behaviors
CAST_QUESTIONS = {
    11: {
        "text": "Does child join in playing games with other children easily?",
        "domain": "social_interaction",
        "asd_weight": 0.15,
        "options": [
            {"text": "Yes", "score": 10},
            {"text": "No", "score": 90},
        ],
    },
    12: {
        "text": "Can child keep a two-way conversation going easily?",
        "domain": "conversation",
        "asd_weight": 0.15,
        "options": [
            {"text": "Yes", "score": 10},
            {"text": "No", "score": 90},
        ],
    },
    13: {
        "text": "Do they find it easy to 'read between the lines' when someone talks?",
        "domain": "social_comprehension",
        "asd_weight": 0.15,
        "options": [
            {"text": "Yes", "score": 10},
            {"text": "No", "score": 90},
        ],
    },
    14: {
        "text": "Do they have an interest that takes up almost all their time?",
        "domain": "restricted_interests",
        "asd_weight": 0.15,
        "options": [
            {"text": "Yes", "score": 90},
            {"text": "No", "score": 10},
        ],
    },
    15: {
        "text": "Do they take things very literally (miss jokes or sarcasm)?",
        "domain": "literal_thinking",
        "asd_weight": 0.15,
        "options": [
            {"text": "Yes", "score": 90},
            {"text": "No", "score": 10},
        ],
    },
    16: {
        "text": "Do they struggle to work out what someone is feeling from their face?",
        "domain": "emotion_recognition",
        "asd_weight": 0.15,
        "options": [
            {"text": "Yes", "score": 90},
            {"text": "No", "score": 10},
        ],
    },
    17: {
        "text": "Do they like to do things over and over in exactly the same way?",
        "domain": "repetitive_behaviors",
        "asd_weight": 0.15,
        "options": [
            {"text": "Yes", "score": 90},
            {"text": "No", "score": 10},
        ],
    },
    18: {
        "text": "Do they often bring things they are interested in to show you?",
        "domain": "social_sharing",
        "asd_weight": 0.10,
        "options": [
            {"text": "Yes", "score": 10},
            {"text": "No", "score": 90},
        ],
    },
    19: {
        "text": "Is their voice unusual (e.g., very flat, monotonous, or too loud)?",
        "domain": "vocal_characteristics",
        "asd_weight": 0.15,
        "options": [
            {"text": "Yes", "score": 90},
            {"text": "No", "score": 10},
        ],
    },
    20: {
        "text": "Do they have an unusual memory for details (e.g., car numbers, dates)?",
        "domain": "detail_focused_memory",
        "asd_weight": 0.10,
        "options": [
            {"text": "Yes", "score": 90},
            {"text": "No", "score": 10},
        ],
    },
}

# Additional MCQ questions - all duplicates removed
# Questions 29-30 were duplicates of CAST questions 19-20, so no additional unique questions remain
ADDITIONAL_QUESTIONS = {}

# Merge all questions
ALL_QUESTIONS = {**M_CHAT_R_QUESTIONS, **CAST_QUESTIONS, **ADDITIONAL_QUESTIONS}


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
    """Determine ASD risk level from MCQ score.
    
    Updated thresholds for improved accuracy with 50% weight:
    - HIGH: >= 60 (more sensitive to catch potential cases)
    - MODERATE: >= 41 (aligned with overall assessment)
    - LOW: < 40
    """
    if score >= 60:
        return RiskLevel.HIGH
    elif score >= 41:
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

    # M-CHAT-R specific insights (toddler assessment)
    mchat_domains = ["joint_attention", "gesture_communication", "imaginative_play", 
                   "response_to_name", "eye_contact", "imitation", 
                   "social_initiation", "comprehension", "repetitive_behaviors"]
    mchat_scores = []
    for domain in mchat_domains:
        if domain in domain_scores:
            mchat_scores.extend(domain_scores[domain])
    
    if mchat_scores:
        avg_mchat = sum(mchat_scores) / len(mchat_scores)
        if avg_mchat > 65:
            insights.append("M-CHAT-R responses indicate significant ASD risk markers in toddler")
        elif avg_mchat > 41:
            insights.append("M-CHAT-R responses show moderate ASD indicators in toddler")
        else:
            insights.append("M-CHAT-R responses within typical developmental range")

    # CAST specific insights (children 4-11 years)
    cast_domains = ["social_interaction", "conversation", "social_comprehension", 
                  "restricted_interests", "literal_thinking", "emotion_recognition",
                  "repetitive_behaviors", "social_sharing", "vocal_characteristics", 
                  "detail_focused_memory"]
    cast_scores = []
    for domain in cast_domains:
        if domain in domain_scores:
            cast_scores.extend(domain_scores[domain])
    
    if cast_scores:
        avg_cast = sum(cast_scores) / len(cast_scores)
        if avg_cast > 65:
            insights.append("CAST responses indicate strong ASD traits in school-age child")
        elif avg_cast > 41:
            insights.append("CAST responses show moderate ASD characteristics")
        else:
            insights.append("CAST responses within typical range for school-age child")

    # Additional MCQ insights (questions 21-30)
    additional_domains = ["social_interaction", "conversation", "social_comprehension",
                       "restricted_interests", "literal_thinking", "emotion_recognition",
                       "repetitive_behaviors", "social_sharing", "vocal_characteristics",
                       "detail_focused_memory"]
    additional_scores = []
    for domain in additional_domains:
        if domain in domain_scores:
            additional_scores.extend(domain_scores[domain])
    
    if additional_scores:
        avg_additional = sum(additional_scores) / len(additional_scores)
        if avg_additional > 65:
            insights.append("Additional MCQ responses indicate strong ASD behavioral patterns")
        elif avg_additional > 41:
            insights.append("Additional MCQ responses show moderate ASD characteristics")
        else:
            insights.append("Additional MCQ responses within typical range")

    # Domain-specific insights for both tools (updated thresholds)
    # Joint attention issues
    joint_attention = domain_scores.get("joint_attention", [])
    if joint_attention and sum(joint_attention) / len(joint_attention) > 65:
        insights.append("Joint attention difficulties — core ASD indicator")

    # Social communication
    social_comm = domain_scores.get("social_communication", []) + domain_scores.get("conversation", [])
    if social_comm and sum(social_comm) / len(social_comm) > 65:
        insights.append("Social communication challenges — ASD hallmark")

    # Repetitive behaviors
    repetitive = domain_scores.get("repetitive_behaviors", [])
    if repetitive and sum(repetitive) / len(repetitive) > 65:
        insights.append("Repetitive behaviors present — significant ASD indicator")

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
