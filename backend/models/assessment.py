from datetime import datetime
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
    student_name: str = "Untitled student"
    subject: str = "General"
    question_text: str
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
    feedback: str
    strengths: list[str]
    improvements: list[str]
    criteria: list[CriterionResult]
    created_at: datetime = Field(default_factory=datetime.utcnow)