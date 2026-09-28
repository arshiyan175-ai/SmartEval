from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


class CriterionResult(BaseModel):
    criterion: str
    score: int
    max_score: int
    comment: str


class AssessmentCreate(BaseModel):
    file_name: str
    file_type: str
    file_data: str = ""
    student_name: str = "Untitled student"
    subject: str = "General"
    question_text: str = ""
    answer_text: str = ""
    max_marks: int = Field(default=10, ge=1, le=100)
    rubric: str = ""


class Assessment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    file_name: str
    file_type: str
    student_name: str
    subject: str
    question_text: str
    extracted_answer: str
    max_marks: int
    score: int
    percentage: int
    confidence: Literal["High", "Medium", "Low"]
    status: Literal["Ready for review"] = "Ready for review"
    ai_source: Literal["Live AI", "MOCKED"] = "Live AI"
    quality: str = "Developing"
    quality_summary: str = ""
    word_count: int = 0
    length_assessment: str = "Not extracted"
    short_answer_assessment: str = ""
    score_justification: str = ""
    feedback: str
    strengths: list[str]
    weaknesses: list[str] = Field(default_factory=list)
    improvements: list[str]
    criteria: list[CriterionResult]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))