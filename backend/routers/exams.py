import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from lib.ai_exam_grader import extract_exam_paper, grade_full_exam
from lib.db import db
from models.exam import ExamDraft, ExamExtractRequest, ExamGradeRequest, ExamQuestionResult, ExamResult

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/exams", tags=["exams"])


@router.post("/extract", response_model=ExamDraft)
async def extract_question_paper(input: ExamExtractRequest) -> ExamDraft:
    try:
        return await extract_exam_paper(input)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Question paper extraction failed")
        raise HTTPException(status_code=502, detail="Question paper extraction failed. Please try again.") from exc


@router.post("/grade", response_model=ExamResult)
async def grade_exam(input: ExamGradeRequest) -> ExamResult:
    try:
        payload = await grade_full_exam(input)
        raw_results = payload.get("question_results", [])
        if len(raw_results) != len(input.questions):
            raise ValueError("The AI did not return every reviewed question")
        results: list[ExamQuestionResult] = []
        for question, raw in zip(input.questions, raw_results, strict=True):
            awarded = max(0, min(question.max_marks, int(raw.get("awarded_marks", 0))))
            results.append(ExamQuestionResult(
                number=question.number,
                question_text=question.question_text,
                matched_answer=str(raw.get("matched_answer", "Not answered")).strip() or "Not answered",
                max_marks=question.max_marks,
                awarded_marks=awarded,
                match_confidence=raw.get("match_confidence") if raw.get("match_confidence") in {"High", "Medium", "Low"} else "Medium",
                reason=str(raw.get("reason", "No explanation returned.")).strip(),
                quality=str(raw.get("quality", "Developing")).strip(),
                improvement=str(raw.get("improvement", "Review this answer with the student.")).strip(),
            ))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Full exam grading failed")
        raise HTTPException(status_code=502, detail="Full exam grading failed. Please try again.") from exc

    score = sum(result.awarded_marks for result in results)
    exam = ExamResult(
        student_name=input.student_name.strip() or "Untitled student",
        exam_title=input.exam_title,
        subject=input.subject,
        answer_sheet_names=[document.file_name for document in input.answer_sheets],
        total_marks=input.total_marks,
        score=score,
        percentage=round(score / input.total_marks * 100),
        confidence=payload.get("confidence") if payload.get("confidence") in {"High", "Medium", "Low"} else "Medium",
        overall_quality=str(payload.get("overall_quality", "Developing")),
        overall_feedback=str(payload.get("overall_feedback", "Review the question-level feedback below.")),
        question_results=results,
    )
    await db.exam_results.insert_one(exam.model_dump())
    return exam


@router.get("", response_model=list[ExamResult])
async def list_exams() -> list[ExamResult]:
    documents = await db.exam_results.find().sort("created_at", -1).to_list(50)
    results = []
    for document in documents:
        document.pop("_id", None)
        created_at = document.get("created_at")
        if isinstance(created_at, datetime) and created_at.tzinfo is None:
            document["created_at"] = created_at.replace(tzinfo=timezone.utc)
        results.append(ExamResult(**document))
    return results


@router.delete("/{exam_id}", status_code=204)
async def delete_exam(exam_id: str) -> None:
    result = await db.exam_results.delete_one({"id": exam_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Exam result not found")