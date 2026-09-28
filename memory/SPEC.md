# GradeWise — Living Spec

## What it does
GradeWise is a teacher-facing workspace for uploading a student answer image or PDF, entering the question and maximum marks, and receiving a review-ready first-pass score, mark breakdown, and constructive feedback.

## Data model
- `AssessmentCreate`: file name/type, student name, subject, question text, optional pasted answer, maximum marks, and optional rubric.
- `Assessment`: persisted assessment with score, percentage, confidence, extracted answer, feedback, strengths, improvements, criterion breakdown, and UTC creation time.

## Key flows
1. Teacher uploads an image/PDF in the Studio panel.
2. Teacher configures question, marks, subject, optional rubric, and optional pasted answer.
3. Teacher selects Assess answer and reviews the score and criteria breakdown.
4. Assessments persist in MongoDB and appear in Recent assessments; rows can be reopened or deleted.

## Auth and integrations
There is no authentication. The current grader is **MOCKED** and deterministic: it uses the optional pasted answer length to produce a review-ready score and clearly discloses that status in the UI. No external AI API is connected yet.