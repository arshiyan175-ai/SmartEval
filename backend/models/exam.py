from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field, model_validator


class ExamDocument(BaseModel):
    file_name: str
    file_type: str
    file_data: str


class ExamQuestion(BaseModel):
    number: str
    question_text: str
    max_marks: int = Field(ge=1, le=100)


class ExamExtractRequest(BaseModel):
    question_paper: ExamDocument
    subject_hint: str = ""
    total_marks_hint: int | None = Field(default=None, ge=1, le=500)


class ExamDraft(BaseModel):
    exam_title: str
    subject: str
    total_marks: int
    confidence: Literal["High", "Medium", "Low"]
    questions: list[ExamQuestion]


class ExamGradeRequest(BaseModel):
    student_name: str = "Untitled student"
    exam_title: str = "Exam"
    subject: str
    total_marks: int = Field(ge=1, le=500)
    questions: list[ExamQuestion] = Field(min_length=1, max_length=100)
    answer_sheets: list[ExamDocument] = Field(min_length=1, max_length=8)

    @model_validator(mode="after")
    def marks_must_match_total(self):
        if sum(question.max_marks for question in self.questions) != self.total_marks:
            raise ValueError("Question marks must add up to the exam total")
        return self


class ExamQuestionResult(BaseModel):
    number: str
    question_text: str
    matched_answer: str
    max_marks: int
    awarded_marks: int
    match_confidence: Literal["High", "Medium", "Low"]
    reason: str
    quality: str
    improvement: str


class ExamResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    student_name: str
    exam_title: str
    subject: str
    answer_sheet_names: list[str]
    total_marks: int
    score: int
    percentage: int
    confidence: Literal["High", "Medium", "Low"]
    overall_quality: str
    overall_feedback: str
    question_results: list[ExamQuestionResult]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))