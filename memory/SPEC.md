# GradeWise — Living Spec

## What it does
GradeWise is a teacher-facing workspace for uploading a student answer image or PDF, entering the question and maximum marks, and receiving a live Gemini vision extraction plus a review-ready score, mark breakdown, transparent justification, answer-quality review, short-answer assessment, and constructive feedback.

## Data model
- `AssessmentCreate`: file name/type, base64 file data, student name, subject, optional question text, optional pasted answer, maximum marks, and optional rubric.
- `Assessment`: persisted assessment with score, percentage, confidence, live-AI source, extracted question/answer, word count, answer quality, length assessment, short-answer assessment, score justification, feedback, strengths, weaknesses, improvements, criterion breakdown, and UTC creation time.

## Key flows
1. Teacher uploads an image/PDF in the Studio panel.
2. Teacher configures optional question, marks, subject, optional rubric, and optional pasted answer.
3. Teacher selects Assess answer; Gemini vision reads the image/PDF and returns the score plus detailed explanation.
4. Assessments persist in MongoDB and appear in Recent assessments; rows can be reopened or deleted.

## Result experience
The result workspace uses a professional dark score summary followed by three tabs: Overview for score justification and criterion marks, Extracted work for a paper-style question/answer transcript, and Feedback for teacher comments, strengths, improvements, and short-answer judgement. This presentation is frontend-only and does not make additional AI requests.

## Landing experience
The landing page uses a modern minimal visual system with Instrument Sans headings and DM Sans body copy. It includes an animated product preview, direct upload/workspace actions, hover-responsive three-step grading journey cards, and viewport-based section reveals. These interactions are frontend-only and consume no AI credits.

## Auth and integrations
There is no authentication. Live grading uses Gemini `gemini-3.1-pro-preview` through the Emergent universal key in `backend/.env`. The teacher-facing mark is an AI suggestion and must remain reviewable; legacy records may display **MOCKED** because they were created before live grading was enabled.