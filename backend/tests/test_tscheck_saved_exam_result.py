"""Covers: 'Saved full exam result is complete' acceptance criterion.

GET /api/exams must surface the seeded Aisha Khan / Biology Unit Test ExamResult
with total score 10/10, overall feedback, exactly 3 question results, and two
answer sheet file names. This endpoint consumes no AI credit (pure read).
"""


def test_saved_exam_result_is_complete(client):
    response = client.get("/exams")
    assert response.status_code == 200, response.text
    exams = response.json()
    assert isinstance(exams, list)

    aisha_exam = next(
        (
            exam
            for exam in exams
            if exam.get("student_name") == "Aisha Khan"
            and exam.get("exam_title") == "Biology Unit Test"
        ),
        None,
    )
    assert aisha_exam is not None, f"Seeded Aisha Khan Biology Unit Test exam not found in {exams}"

    assert aisha_exam["subject"] == "Biology"
    assert aisha_exam["total_marks"] == 10
    assert aisha_exam["score"] == 10
    assert aisha_exam["overall_feedback"]
    assert isinstance(aisha_exam["overall_feedback"], str) and len(aisha_exam["overall_feedback"]) > 0

    question_results = aisha_exam["question_results"]
    assert len(question_results) == 3
    numbers = [q["number"] for q in question_results]
    assert numbers == ["Q1", "Q2", "Q3"]
    for question in question_results:
        assert question["matched_answer"]
        assert question["reason"]
        assert question["improvement"]

    answer_sheet_names = aisha_exam["answer_sheet_names"]
    assert len(answer_sheet_names) == 2
