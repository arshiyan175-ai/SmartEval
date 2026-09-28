import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from lib.ai_grader import grade_with_gemini
from lib.db import db
from models.assessment import Assessment, AssessmentCreate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assessments", tags=["assessments"])


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
    try:
        evaluation = await grade_with_gemini(input)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Live Gemini assessment failed")
        raise HTTPException(status_code=502, detail="Live AI assessment failed. Please try again.") from exc

    score = max(0, min(input.max_marks, evaluation.score))
    question_text = evaluation.question_text or input.question_text.strip() or "Question could not be confidently extracted."
    assessment = Assessment(
        file_name=input.file_name,
        file_type=input.file_type,
        student_name=input.student_name.strip() or "Untitled student",
        subject=input.subject.strip() or "General",
        question_text=question_text,
        extracted_answer=evaluation.extracted_answer or input.answer_text.strip() or "No answer text could be confidently extracted.",
        max_marks=input.max_marks,
        score=score,
        percentage=round((score / input.max_marks) * 100),
        confidence=evaluation.confidence if evaluation.confidence in {"High", "Medium", "Low"} else "Medium",
        ai_source="Live AI",
        quality=evaluation.quality,
        quality_summary=evaluation.quality_summary,
        word_count=evaluation.word_count,
        length_assessment=evaluation.length_assessment,
        short_answer_assessment=evaluation.short_answer_assessment,
        score_justification=evaluation.score_justification,
        feedback=evaluation.feedback,
        strengths=evaluation.strengths,
        weaknesses=evaluation.weaknesses,
        improvements=evaluation.improvements,
        criteria=evaluation.criteria,
    )
    await db.assessments.insert_one(assessment.model_dump())
    return assessment


@router.delete("/{assessment_id}", status_code=204)
async def delete_assessment(assessment_id: str) -> None:
    result = await db.assessments.delete_one({"id": assessment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Assessment not found")