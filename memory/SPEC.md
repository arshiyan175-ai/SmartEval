# EvalX — Living Spec

## What it does
EvalX is a teacher-facing workspace for uploading a student answer image or PDF, entering the question and maximum marks, and receiving a live Gemini vision extraction plus a review-ready score, mark breakdown, transparent justification, answer-quality review, short-answer assessment, and constructive feedback.

## Data model
- `AssessmentCreate`: file name/type, base64 file data, student name, subject, optional question text, optional pasted answer, maximum marks, and optional rubric.
- `Assessment`: persisted assessment with score, percentage, confidence, live-AI source, extracted question/answer, word count, answer quality, length assessment, short-answer assessment, score justification, feedback, strengths, weaknesses, improvements, criterion breakdown, and UTC creation time.

## Key flows
1. Teacher uploads an image/PDF in the Studio panel.
2. Teacher configures optional question, marks, subject, optional rubric, and optional pasted answer.
3. Teacher selects Assess answer; Gemini vision reads the image/PDF and returns the score plus detailed explanation.
4. Assessments persist in MongoDB and appear in Recent assessments; rows can be reopened or deleted.

## Full exam flow
1. From `/exams`, the teacher uploads one question-paper image/PDF and optional subject/total-mark hints.
2. One Gemini vision call extracts the exam title, subject, numbered questions/sub-questions, and printed maximum marks.
3. The teacher reviews and edits every question number, text, and maximum mark; the reviewed marks automatically determine the exam total.
4. The teacher uploads one to eight answer-sheet images/PDFs in reading order and enters the student name.
5. One Gemini vision call reads all answer sheets, matches each response to the reviewed question list (using best-effort content matching when numbering is unclear), and grades the whole exam.
6. The persisted report shows total score plus every question, matched answer, awarded/maximum marks, match confidence, exact reasoning, answer quality, and improvement guidance. Saved full exams can be reopened or deleted.

### Full exam data model
- `ExamDocument`: file name, MIME type, and base64 file data.
- `ExamDraft`: extracted exam title, subject, confidence, total marks, and editable `ExamQuestion` rows.
- `ExamResult`: student/exam metadata, total score, overall feedback, and ordered `ExamQuestionResult` rows.

## Result experience
The result workspace uses a professional dark score summary followed by three tabs: Overview for score justification and criterion marks, Extracted work for a paper-style question/answer transcript, and Feedback for teacher comments, strengths, improvements, and short-answer judgement. This presentation is frontend-only and does not make additional AI requests.

## Landing experience
The landing page uses a modern minimal visual system with Instrument Sans headings and DM Sans body copy. It includes an animated product preview, direct upload/workspace actions, hover-responsive three-step grading journey cards, and viewport-based section reveals. These interactions are frontend-only and consume no AI credits.

## Brand identity
The product is branded **EvalX** with the line “Evaluation, explained.” Its custom monogram combines an answer sheet, a teacher checkmark, and a terracotta X inside the evergreen rounded-square mark. The logo is used in the header and SVG favicon; browser title and metadata use EvalX consistently.

## Auth and integrations
There is no authentication. Live grading uses Gemini `gemini-3.1-pro-preview` through the Emergent universal key in `backend/.env`. The teacher-facing mark is an AI suggestion and must remain reviewable; legacy records may display **MOCKED** because they were created before live grading was enabled.