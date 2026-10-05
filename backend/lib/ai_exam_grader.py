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

from models.exam import ExamDocument, ExamDraft, ExamExtractRequest, ExamGradeRequest


def _decode(document: ExamDocument) -> bytes:
    encoded = document.file_data.split(",", 1)[1] if "," in document.file_data else document.file_data
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, base64.binascii.Error) as exc:
        raise ValueError(f"{document.file_name} could not be decoded") from exc
    if len(raw) > 12 * 1024 * 1024:
        raise ValueError(f"{document.file_name} is larger than 12 MB")
    return raw


def _attachment(document: ExamDocument, temporary_paths: list[Path]):
    raw = _decode(document)
    if document.file_type in {"image/jpeg", "image/png", "image/webp"}:
        return ImageContent(image_base64=base64.b64encode(raw).decode("ascii"))
    if document.file_type == "application/pdf":
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temporary_file:
            temporary_file.write(raw)
            path = Path(temporary_file.name)
        temporary_paths.append(path)
        return FileContentWithMimeType(file_path=str(path), mime_type="application/pdf")
    raise ValueError(f"{document.file_name} must be a JPG, PNG, WEBP, or PDF")


async def _run(prompt: str, documents: list[ExamDocument], session_prefix: str) -> dict:
    api_key = os.environ.get("EMERGENT_LLM_KEY", "").strip()
    if not api_key:
        raise ValueError("EMERGENT_LLM_KEY is not configured")
    if sum(len(document.file_data) for document in documents) > 44 * 1024 * 1024:
        raise ValueError("The combined files are too large. Keep the upload below 32 MB")

    temporary_paths: list[Path] = []
    try:
        contents = [_attachment(document, temporary_paths) for document in documents]
        chat = LlmChat(
            api_key=api_key,
            session_id=f"{session_prefix}-{uuid4()}",
            system_message=(
                "You are a careful exam assessor. Preserve question numbering, match answers fairly, "
                "show mark reasoning, and return only the requested JSON."
            ),
        ).with_model("gemini", "gemini-3.1-pro-preview")
        response_parts: list[str] = []
        async for event in chat.stream_message(UserMessage(text=prompt, file_contents=contents)):
            if isinstance(event, TextDelta):
                response_parts.append(event.content)
            elif isinstance(event, StreamDone):
                break
        match = re.search(r"\{.*\}", "".join(response_parts), flags=re.DOTALL)
        if not match:
            raise ValueError("The AI returned an unreadable exam response")
        return json.loads(match.group(0))
    finally:
        for path in temporary_paths:
            path.unlink(missing_ok=True)


async def extract_exam_paper(input: ExamExtractRequest) -> ExamDraft:
    prompt = f"""Read this complete question paper and prepare it for grading.
Subject hint from teacher: {input.subject_hint or "Not provided"}
Total marks hint from teacher: {input.total_marks_hint or "Not provided"}

Extract the exam title, subject, and every distinct numbered question or sub-question that expects an answer. Preserve labels such as 1, 1(a), 1(b), 2. Extract each printed maximum mark. If a mark is genuinely absent, allocate a reasonable positive integer while keeping the detected total consistent. Return only JSON:
{{"exam_title":"string","subject":"string","total_marks":0,"confidence":"High | Medium | Low","questions":[{{"number":"1(a)","question_text":"full question text","max_marks":5}}]}}
The sum of question max_marks must equal total_marks. Prefer the teacher's total marks hint when supplied, but preserve printed per-question marks wherever possible."""
    payload = await _run(prompt, [input.question_paper], "exam-extract")
    draft = ExamDraft.model_validate(payload)
    calculated_total = sum(question.max_marks for question in draft.questions)
    draft.total_marks = calculated_total
    if input.subject_hint.strip():
        draft.subject = input.subject_hint.strip()
    return draft


async def grade_full_exam(input: ExamGradeRequest) -> dict:
    questions_json = json.dumps([question.model_dump() for question in input.questions], ensure_ascii=False)
    prompt = f"""Grade the student's complete answer sheets against this reviewed question list.
Exam: {input.exam_title}
Subject: {input.subject}
Total marks: {input.total_marks}
Reviewed questions: {questions_json}

Read all answer-sheet files in their supplied order. Match answers by written question labels and content. When a label is unclear, make the best content-based match instead of leaving it unmatched. Never award more than max_marks. An omitted answer earns 0 and must say it was not found. Judge each response for correctness, relevance, completeness, method/evidence, and clarity appropriate to its marks.

Return only JSON:
{{
  "confidence":"High | Medium | Low",
  "overall_quality":"Excellent | Strong | Developing | Needs support",
  "overall_feedback":"concise whole-exam feedback",
  "question_results":[
    {{"number":"1(a)","question_text":"exact reviewed question","matched_answer":"faithful extracted answer or Not answered","max_marks":5,"awarded_marks":3,"match_confidence":"High | Medium | Low","reason":"exactly why these marks were awarded and what was missing","quality":"Excellent | Strong | Developing | Needs support | Not answered","improvement":"specific better-answer guidance"}}
  ]
}}
Return exactly one result for every reviewed question, in the same order."""
    return await _run(prompt, input.answer_sheets, "exam-grade")