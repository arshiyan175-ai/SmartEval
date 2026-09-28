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