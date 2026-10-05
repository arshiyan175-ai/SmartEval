export interface CriterionResult {
  criterion: string;
  score: number;
  max_score: number;
  comment: string;
}

export interface Assessment {
  id: string;
  file_name: string;
  file_type: string;
  student_name: string;
  subject: string;
  question_text: string;
  extracted_answer: string;
  max_marks: number;
  score: number;
  percentage: number;
  confidence: "High" | "Medium" | "Low";
  status: "Ready for review";
  ai_source: "Live AI" | "MOCKED";
  quality: string;
  quality_summary: string;
  word_count: number;
  length_assessment: string;
  short_answer_assessment: string;
  score_justification: string;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  criteria: CriterionResult[];
  created_at: string;
}

export interface AssessmentCreate {
  file_name: string;
  file_type: string;
  file_data: string;
  student_name: string;
  subject: string;
  question_text: string;
  answer_text: string;
  max_marks: number;
  rubric: string;
}

export interface ExamDocument {
  file_name: string;
  file_type: string;
  file_data: string;
}

export interface ExamQuestion {
  number: string;
  question_text: string;
  max_marks: number;
}

export interface ExamDraft {
  exam_title: string;
  subject: string;
  total_marks: number;
  confidence: "High" | "Medium" | "Low";
  questions: ExamQuestion[];
}

export interface ExamQuestionResult {
  number: string;
  question_text: string;
  matched_answer: string;
  max_marks: number;
  awarded_marks: number;
  match_confidence: "High" | "Medium" | "Low";
  reason: string;
  quality: string;
  improvement: string;
}

export interface ExamResult {
  id: string;
  student_name: string;
  exam_title: string;
  subject: string;
  answer_sheet_names: string[];
  total_marks: number;
  score: number;
  percentage: number;
  confidence: "High" | "Medium" | "Low";
  overall_quality: string;
  overall_feedback: string;
  question_results: ExamQuestionResult[];
  created_at: string;
}