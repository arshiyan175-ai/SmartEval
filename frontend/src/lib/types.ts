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
  feedback: string;
  strengths: string[];
  improvements: string[];
  criteria: CriterionResult[];
  created_at: string;
}

export interface AssessmentCreate {
  file_name: string;
  file_type: string;
  student_name: string;
  subject: string;
  question_text: string;
  answer_text: string;
  max_marks: number;
  rubric: string;
}