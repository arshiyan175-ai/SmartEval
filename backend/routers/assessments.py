from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from lib.db import db
from models.assessment import Assessment, AssessmentCreate, CriterionResult

router = APIRouter(prefix="/assessments", tags=["assessments"])


def build_assessment(input: AssessmentCreate) -> Assessment:
    answer = input.answer_text.strip() or (
        "The answer was extracted from the uploaded document. Add pasted answer text "
        "for a more precise MOCK assessment."
    )
    answer_length = len(input.answer_text.strip())
    if answer_length >= 180:
        ratio = 0.86
        confidence = "High"
    elif answer_length >= 60:
        ratio = 0.72
        confidence = "Medium"
    else:
        ratio = 0.58
        confidence = "Low"

    score = max(0, min(input.max_marks, round(input.max_marks * ratio)))
    percentage = round((score / input.max_marks) * 100)
    first_max = max(1, round(input.max_marks * 0.4))
    second_max = max(1, round(input.max_marks * 0.35))
    final_max = max(1, input.max_marks - first_max - second_max)
    first_score = min(first_max, round(first_max * ratio))
    second_score = min(second_max, round(second_max * ratio))
    final_score = min(final_max, score - first_score - second_score)

    return Assessment(
        file_name=input.file_name,
        file_type=input.file_type,
        student_name=input.student_name.strip() or "Untitled student",
        subject=input.subject.strip() or "General",
        question_text=input.question_text.strip(),
        extracted_answer=answer,
        max_marks=input.max_marks,
        score=score,
        percentage=percentage,
        confidence=confidence,
        feedback=(
            "The response shows a workable understanding of the prompt. "
            "Review the highlighted criteria before publishing the final mark."
        ),
        strengths=[
            "The response addresses the central idea of the question.",
            "Key terms are used in a mostly relevant way.",
        ],
        improvements=[
            "Add one specific example or piece of evidence.",
            "Make the final explanation more precise and complete.",
        ],
        criteria=[
            CriterionResult(
                criterion="Core understanding",
                score=first_score,
                max_score=first_max,
                comment="The main concept is present, with room for a clearer explanation.",
            ),
            CriterionResult(
                criterion="Evidence & detail",
                score=second_score,
                max_score=second_max,
                comment="Some supporting detail appears, but it could be more specific.",
            ),
            CriterionResult(
                criterion="Clarity & accuracy",
                score=final_score,
                max_score=final_max,
                comment="The answer is readable; tighten the conclusion and terminology.",
            ),
        ],
    )


@router.get("", response_model=list[Assessment])
async def get_assessments() -> list[Assessment]:
    documents = await db.assessments.find().sort("created_at", -1).to_list(100)
    results = []
    for document in documents:
        document.pop("_id", None)
        created_at = document.get("created_at")
        if isinstance(created_at, datetime) and created_at.tzinfo is None:
            document["created_at"] = created_at.replace(tzinfo=timezone.utc)
        results.append(Assessment(**document))
    return results


@router.post("", response_model=Assessment)
async def create_assessment(input: AssessmentCreate) -> Assessment:
    assessment = build_assessment(input)
    await db.assessments.insert_one(assessment.model_dump())
    return assessment


@router.delete("/{assessment_id}", status_code=204)
async def delete_assessment(assessment_id: str) -> None:
    result = await db.assessments.delete_one({"id": assessment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Assessment not found")