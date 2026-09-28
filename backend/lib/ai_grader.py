import base64
import json
import os
import re
import tempfile
from pathlib import Path
from uuid import uuid4

from emergentintegrations.llm.chat import (
    FileContentWithMimeType,
    ImageContent,
    LlmChat,
    StreamDone,
    TextDelta,
    UserMessage,
)

from models.assessment import AssessmentCreate, CriterionResult


class AIEvaluation:
    def __init__(self, payload: dict):
        self.question_text = str(payload.get("question_text", "")).strip()
        self.extracted_answer = str(payload.get("extracted_answer", "")).strip()
        self.score = int(payload.get("score", 0))
        self.confidence = str(payload.get("confidence", "Medium"))
        self.quality = str(payload.get("quality", "Developing"))
        self.quality_summary = str(payload.get("quality_summary", "")).strip()
        self.word_count = max(0, int(payload.get("word_count", 0)))
        self.short_answer_assessment = str(payload.get("short_answer_assessment", "")).strip()
        self.length_assessment = str(payload.get("length_assessment", "")).strip()
        self.score_justification = str(payload.get("score_justification", "")).strip()
        self.feedback = str(payload.get("feedback", "")).strip()
        self.strengths = [str(item).strip() for item in payload.get("strengths", []) if str(item).strip()]
        self.weaknesses = [str(item).strip() for item in payload.get("weaknesses", []) if str(item).strip()]
        self.improvements = [str(item).strip() for item in payload.get("improvements", []) if str(item).strip()]
        self.criteria = [CriterionResult.model_validate(item) for item in payload.get("criteria", [])]


def _decode_data_url(data_url: str, expected_mime: str) -> bytes:
    if not data_url:
        return b""
    encoded = data_url.split(",", 1)[1] if "," in data_url else data_url
    try:
        decoded = base64.b64decode(encoded, validate=True)
    except (ValueError, base64.binascii.Error) as exc:
        raise ValueError("The uploaded document could not be decoded") from exc
    if len(decoded) > 12 * 1024 * 1024:
        raise ValueError("Please upload a document smaller than 12 MB")
    if expected_mime.startswith("image/") and not data_url.startswith(f"data:{expected_mime};"):
        raise ValueError("The image MIME type does not match the uploaded file")
    return decoded


def _prompt(input: AssessmentCreate) -> str:
    provided_question = input.question_text.strip() or "(No question was provided. Extract the question from the document.)"
    provided_answer = input.answer_text.strip() or "(No pasted answer was provided. Extract the student's answer from the document.)"
    rubric = input.rubric.strip() or "No rubric was provided. Build a fair criterion breakdown from the question and maximum marks."
    return f"""Assess this student's answer as a careful, transparent teacher assistant.

Maximum marks: {input.max_marks}
Teacher-provided question (use it when present, otherwise extract the question): {provided_question}
Teacher marking guide: {rubric}
Optional pasted answer (use it as a supplement, but prefer the uploaded document): {provided_answer}

Read the uploaded image or PDF. Extract the question and the student's answer faithfully. Do not invent missing text; if handwriting is unclear, say so in confidence and quality notes. Judge a short answer fairly: assess relevance, completeness, accuracy, clarity, and whether its length is appropriate for the marks. Do not penalize brevity when the answer is complete for the question.

Return ONLY valid JSON with exactly these keys:
{{
  "question_text": "string",
  "extracted_answer": "string",
  "score": 0,
  "confidence": "High | Medium | Low",
  "quality": "Excellent | Strong | Developing | Needs support",
  "quality_summary": "one concise paragraph about overall answer quality",
  "word_count": 0,
  "length_assessment": "one sentence about answer length for this question and marks",
  "short_answer_assessment": "one sentence explaining whether the answer is too short, appropriately concise, or unnecessarily long",
  "score_justification": "clear explanation of why this exact score was awarded and what was missing from the maximum",
  "feedback": "teacher-facing summary",
  "strengths": ["specific strength"],
  "weaknesses": ["specific weakness"],
  "improvements": ["specific next step"],
  "criteria": [
    {{"criterion": "criterion name", "score": 0, "max_score": 0, "comment": "why this criterion earned this mark"}}
  ]
}}
The criterion max_score values must add up to {input.max_marks}, and their scores must add up to score. Keep every score an integer between zero and its criterion maximum. Make the explanation understandable to a teacher, not a model developer."""


async def grade_with_gemini(input: AssessmentCreate) -> AIEvaluation:
    api_key = os.environ.get("EMERGENT_LLM_KEY", "").strip()
    if not api_key:
        raise ValueError("EMERGENT_LLM_KEY is not configured")

    file_contents: list[object] = []
    temporary_path: Path | None = None
    try:
        if input.file_data:
            raw = _decode_data_url(input.file_data, input.file_type)
            if input.file_type.startswith("image/"):
                file_contents.append(ImageContent(image_base64=base64.b64encode(raw).decode("ascii")))
            elif input.file_type == "application/pdf":
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temporary_file:
                    temporary_file.write(raw)
                    temporary_path = Path(temporary_file.name)
                file_contents.append(FileContentWithMimeType(file_path=str(temporary_path), mime_type="application/pdf"))
            else:
                raise ValueError("Please upload a JPG, PNG, WEBP, or PDF document")
        elif not input.answer_text.strip():
            raise ValueError("Upload a document or paste the student's answer text")

        chat = (
            LlmChat(
                api_key=api_key,
                session_id=f"assessment-{uuid4()}",
                system_message="You are a fair, evidence-based educational assessor. Be precise, transparent, and never invent unreadable text.",
            )
            .with_model("gemini", "gemini-3.1-pro-preview")
        )
        response_parts: list[str] = []
        async for event in chat.stream_message(UserMessage(text=_prompt(input), file_contents=file_contents)):
            if isinstance(event, TextDelta):
                response_parts.append(event.content)
            elif isinstance(event, StreamDone):
                break

        raw_response = "".join(response_parts).strip()
        json_match = re.search(r"\{.*\}", raw_response, flags=re.DOTALL)
        if not json_match:
            raise ValueError("The AI returned an unreadable grading response")
        return AIEvaluation(json.loads(json_match.group(0)))
    finally:
        if temporary_path:
            temporary_path.unlink(missing_ok=True)