import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpenCheck,
  BrainCircuit,
  Check,
  ChevronDown,
  ClipboardList,
  FileCheck2,
  FileText,
  GraduationCap,
  Loader2,
  PencilLine,
  Plus,
  ScanText,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { EvalXLogo } from "@/components/EvalXLogo";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { ExamDocument, ExamDraft, ExamQuestion, ExamResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const fileToDocument = (file: File) => new Promise<ExamDocument>((resolve, reject) => {
  if (!allowedTypes.has(file.type)) {
    reject(new Error(`${file.name} is not a supported image or PDF`));
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    reject(new Error(`${file.name} is larger than 12 MB`));
    return;
  }
  const reader = new FileReader();
  reader.onload = () => resolve({ file_name: file.name, file_type: file.type, file_data: String(reader.result ?? "") });
  reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
  reader.readAsDataURL(file);
});

function ExamScore({ score, total }: { score: number; total: number }) {
  const percentage = Math.round((score / total) * 100);
  return (
    <div className="flex items-end gap-3" data-testid="exam-score">
      <p className="font-heading text-6xl font-semibold leading-none tracking-[-0.07em] text-white" data-testid="exam-score-value">{score}</p>
      <div className="pb-1"><p className="text-sm font-bold text-white/70">out of {total}</p><p className="mt-1 text-xs font-bold text-[#efb293]">{percentage}% overall</p></div>
    </div>
  );
}

export default function ExamGrader() {
  const queryClient = useQueryClient();
  const questionInputRef = useRef<HTMLInputElement>(null);
  const answerInputRef = useRef<HTMLInputElement>(null);
  const [questionPaper, setQuestionPaper] = useState<ExamDocument | null>(null);
  const [answerSheets, setAnswerSheets] = useState<ExamDocument[]>([]);
  const [subjectHint, setSubjectHint] = useState("");
  const [totalMarksHint, setTotalMarksHint] = useState("");
  const [studentName, setStudentName] = useState("");
  const [draft, setDraft] = useState<ExamDraft | null>(null);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [openQuestionIndex, setOpenQuestionIndex] = useState<number | null>(null);

  const examsQuery = useQuery({
    queryKey: ["exams"],
    queryFn: () => apiGet<ExamResult[]>("/exams"),
    retry: false,
  });

  const extractMutation = useMutation({
    mutationFn: () => apiPost<ExamDraft>("/exams/extract", {
      question_paper: questionPaper,
      subject_hint: subjectHint,
      total_marks_hint: totalMarksHint ? Number(totalMarksHint) : null,
    }),
    onSuccess: (nextDraft) => {
      setDraft(nextDraft);
      setSubjectHint(nextDraft.subject);
      setTotalMarksHint(String(nextDraft.total_marks));
      toast.success(`${nextDraft.questions.length} questions extracted for review`);
    },
    onError: () => toast.error("We could not read this question paper. Try a clearer file."),
  });

  const gradeMutation = useMutation({
    mutationFn: () => apiPost<ExamResult>("/exams/grade", {
      student_name: studentName,
      exam_title: draft?.exam_title,
      subject: draft?.subject,
      total_marks: draft?.total_marks,
      questions: draft?.questions,
      answer_sheets: answerSheets,
    }),
    onSuccess: (nextResult) => {
      setResult(nextResult);
      setOpenQuestionIndex(nextResult.question_results.length ? 0 : null);
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Full exam graded and ready for review");
    },
    onError: () => toast.error("Exam grading did not complete. Please review the files and try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/exams/${id}`),
    onSuccess: (_, id) => {
      if (result?.id === id) setResult(null);
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exam result removed");
    },
  });

  const reviewedTotal = draft?.questions.reduce((sum, question) => sum + question.max_marks, 0) ?? 0;

  const chooseQuestionPaper = async (file?: File) => {
    if (!file) return;
    try {
      setQuestionPaper(await fileToDocument(file));
      setDraft(null);
      setResult(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid question paper");
    }
  };

  const chooseAnswerSheets = async (files: FileList | null) => {
    if (!files?.length) return;
    if (files.length > 8) {
      toast.error("Add up to 8 answer-sheet files at a time");
      return;
    }
    try {
      setAnswerSheets(await Promise.all(Array.from(files).map(fileToDocument)));
      setResult(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid answer sheet");
    }
  };

  const updateQuestion = (index: number, patch: Partial<ExamQuestion>) => {
    if (!draft) return;
    const questions = draft.questions.map((question, questionIndex) => questionIndex === index ? { ...question, ...patch } : question);
    setDraft({ ...draft, questions, total_marks: questions.reduce((sum, question) => sum + question.max_marks, 0) });
  };

  const addQuestion = () => {
    if (!draft) return;
    const questions = [...draft.questions, { number: String(draft.questions.length + 1), question_text: "", max_marks: 1 }];
    setDraft({ ...draft, questions, total_marks: reviewedTotal + 1 });
  };

  const removeQuestion = (index: number) => {
    if (!draft || draft.questions.length === 1) return;
    const questions = draft.questions.filter((_, questionIndex) => questionIndex !== index);
    setDraft({ ...draft, questions, total_marks: questions.reduce((sum, question) => sum + question.max_marks, 0) });
  };

  const gradeExam = () => {
    if (!draft) return;
    if (!answerSheets.length) {
      toast.error("Upload at least one student answer sheet");
      return;
    }
    if (draft.questions.some((question) => !question.number.trim() || !question.question_text.trim() || question.max_marks < 1)) {
      toast.error("Complete every question number, text, and mark before grading");
      return;
    }
    gradeMutation.mutate();
  };

  return (
    <div className="min-h-svh bg-[#f7f6f2] text-[#1a201c]" data-testid="exam-grader-app">
      <header className="sticky top-0 z-30 border-b border-[#e2e3de] bg-[#faf9f6]/90 backdrop-blur-xl" data-testid="exam-header">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
          <EvalXLogo />
          <div className="flex items-center gap-2"><Link to="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-[#647168]")} data-testid="back-home-link"><ArrowLeft /> Home</Link><Badge variant="outline" className="hidden border-[#d2ddd4] bg-[#eef4ef] text-[#35634b] sm:flex" data-testid="exam-mode-badge"><GraduationCap /> Full exam mode</Badge></div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 pb-20 pt-10 sm:px-8 lg:px-12">
        <section className="grid gap-8 border-b border-[#dedfd9] pb-10 lg:grid-cols-[1fr_auto] lg:items-end" data-testid="exam-intro">
          <div><div className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.17em] text-[#52735e]"><Sparkles size={13} /> Question paper + answer sheets</div><h1 className="max-w-4xl font-heading text-4xl font-semibold leading-[1.02] tracking-[-0.06em] text-[#172a20] sm:text-5xl lg:text-6xl" data-testid="exam-page-title">Grade the whole exam,<br /><span className="text-[#77857c]">question by question.</span></h1><p className="mt-5 max-w-2xl text-base leading-7 text-[#65736a]">Upload the original question paper, review the extracted marks, then add every page of the student's answer sheet. EvalX matches and grades the complete attempt.</p></div>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-[#dce1dc] bg-[#dce1dc] shadow-sm" data-testid="exam-flow-steps">{[{ n: "01", label: "Question paper" }, { n: "02", label: "Review marks" }, { n: "03", label: "Grade answers" }].map((step, index) => <div key={step.n} className={cn("min-w-28 bg-white px-4 py-4", (index === 0 && !draft) || (index === 1 && draft && !result) || (index === 2 && result) ? "bg-[#edf4ee]" : "")} data-testid={`exam-step-${index + 1}`}><p className="font-mono text-[10px] font-bold text-[#b06a4e]">{step.n}</p><p className="mt-1 text-xs font-bold text-[#34463b]">{step.label}</p></div>)}</div>
        </section>

        <section className="grid gap-6 py-8 lg:grid-cols-2" data-testid="exam-files-section">
          <article className="overflow-hidden rounded-2xl border border-[#dde2dd] bg-white shadow-[0_10px_35px_rgba(40,51,43,0.05)]" data-testid="question-paper-card">
            <div className="flex items-center justify-between border-b border-[#ebede9] px-5 py-4"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-[#edf4ee] text-[#35634b]"><ClipboardList size={17} /></span><div><p className="text-sm font-bold text-[#1e3a2b]">Question paper</p><p className="text-[11px] text-[#8a998f]">One image or PDF</p></div></div>{questionPaper && <Badge className="bg-[#e7f2e9] text-[#35634b] hover:bg-[#e7f2e9]"><Check /> Ready</Badge>}</div>
            <div className="p-5"><input ref={questionInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => chooseQuestionPaper(event.target.files?.[0])} data-testid="question-paper-input" />{questionPaper ? <div className="flex items-center justify-between rounded-xl border border-[#dce4dd] bg-[#f7faf7] p-4" data-testid="question-paper-file"><div className="flex min-w-0 items-center gap-3"><FileText className="shrink-0 text-[#52735e]" size={20} /><div className="min-w-0"><p className="truncate text-sm font-bold text-[#34463b]">{questionPaper.file_name}</p><p className="mt-1 text-[11px] text-[#8a998f]">Ready to extract questions and marks</p></div></div><button type="button" onClick={() => { setQuestionPaper(null); setDraft(null); setResult(null); }} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#9aa49d] hover:bg-[#f5e9e4] hover:text-[#b35b40]" aria-label="Remove question paper" data-testid="remove-question-paper-button"><X size={15} /></button></div> : <button type="button" onClick={() => questionInputRef.current?.click()} className="group flex min-h-32 w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#bccac0] bg-[#fafcf9] p-5 hover:border-[#52735e] hover:bg-[#f3f8f4]" data-testid="question-paper-dropzone"><Upload className="text-[#52735e] transition-transform group-hover:-translate-y-1" size={22} /><p className="mt-3 text-sm font-bold text-[#34463b]">Choose question paper</p><p className="mt-1 text-xs text-[#8a998f]">JPG, PNG, WEBP, or PDF · up to 12 MB</p></button>}
              <div className="mt-4 grid gap-3 sm:grid-cols-2"><label><span className="form-label">Subject hint</span><Input value={subjectHint} onChange={(event) => setSubjectHint(event.target.value)} placeholder="e.g. Mathematics" className="form-input" data-testid="exam-subject-hint-input" /></label><label><span className="form-label">Expected total <span className="normal-case tracking-normal text-[#a2aca5]">(optional)</span></span><Input type="number" min={1} max={500} value={totalMarksHint} onChange={(event) => setTotalMarksHint(event.target.value)} placeholder="e.g. 100" className="form-input" data-testid="exam-total-hint-input" /></label></div>
              <Button type="button" onClick={() => questionPaper ? extractMutation.mutate() : toast.error("Upload the question paper first")} disabled={extractMutation.isPending} className="mt-4 h-11 w-full bg-[#1e3a2b] text-white hover:bg-[#14281e]" data-testid="extract-question-paper-button">{extractMutation.isPending ? <><Loader2 className="animate-spin" /> Reading question paper…</> : <><ScanText /> Extract questions & marks</>}</Button>
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-[#dde2dd] bg-white shadow-[0_10px_35px_rgba(40,51,43,0.05)]" data-testid="answer-sheets-card">
            <div className="flex items-center justify-between border-b border-[#ebede9] px-5 py-4"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-[#fff2ec] text-[#b56549]"><BookOpenCheck size={17} /></span><div><p className="text-sm font-bold text-[#1e3a2b]">Student answer sheets</p><p className="text-[11px] text-[#8a998f]">One or more images/PDFs, in page order</p></div></div><Badge variant="outline" data-testid="answer-sheet-count">{answerSheets.length} file{answerSheets.length === 1 ? "" : "s"}</Badge></div>
            <div className="p-5"><input ref={answerInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => chooseAnswerSheets(event.target.files)} data-testid="answer-sheets-input" /><button type="button" onClick={() => answerInputRef.current?.click()} className="group flex min-h-32 w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#d3c2b9] bg-[#fffaf7] p-5 hover:border-[#b56549] hover:bg-[#fff6f1]" data-testid="answer-sheets-dropzone"><Plus className="text-[#b56549] transition-transform group-hover:rotate-90" size={22} /><p className="mt-3 text-sm font-bold text-[#34463b]">Add all answer pages</p><p className="mt-1 text-xs text-[#8a998f]">Select up to 8 files together, in reading order</p></button>{answerSheets.length > 0 && <div className="mt-4 grid gap-2" data-testid="answer-sheet-files">{answerSheets.map((sheet, index) => <div key={`${sheet.file_name}-${index}`} className="flex items-center justify-between rounded-lg border border-[#ebe5df] px-3 py-2"><div className="flex min-w-0 items-center gap-2"><span className="flex size-6 items-center justify-center rounded-md bg-[#f4eee9] font-mono text-[10px] font-bold text-[#a65f45]">{index + 1}</span><p className="truncate text-xs font-semibold text-[#526057]">{sheet.file_name}</p></div><button type="button" onClick={() => setAnswerSheets((current) => current.filter((_, sheetIndex) => sheetIndex !== index))} className="text-[#a2aca5] hover:text-[#b35b40]" aria-label={`Remove ${sheet.file_name}`} data-testid={`remove-answer-sheet-${index + 1}`}><X size={14} /></button></div>)}</div>}<label className="mt-4 block"><span className="form-label">Student name</span><Input value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="e.g. Aisha Khan" className="form-input" data-testid="exam-student-name-input" /></label></div>
          </article>
        </section>

        {draft && (
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[24px] border border-[#d9dfda] bg-white shadow-[0_18px_55px_rgba(40,51,43,0.08)]" data-testid="question-review-section">
            <div className="flex flex-col justify-between gap-5 bg-[#1e3a2b] px-5 py-6 text-white sm:flex-row sm:items-center sm:px-7"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.17em] text-[#a9c1b0]"><PencilLine size={14} /> Review before grading</div><h2 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.035em]" data-testid="draft-exam-title">{draft.exam_title}</h2><p className="mt-1 text-sm text-white/55" data-testid="draft-exam-subject">{draft.subject} · {draft.questions.length} questions detected · {draft.confidence} confidence</p></div><div className="rounded-xl border border-white/10 bg-white/[0.06] px-5 py-3 text-right"><p className="text-[9px] font-bold uppercase tracking-[0.17em] text-white/45">Reviewed total</p><p className="mt-1 font-heading text-3xl font-semibold" data-testid="reviewed-total-marks">{reviewedTotal}<span className="ml-1 text-sm text-white/45">marks</span></p></div></div>
            <div className="p-5 sm:p-7"><div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><p className="max-w-2xl text-sm leading-6 text-[#65736a]">Check each question and its maximum marks. Edit anything the paper scan did not read correctly.</p><Button type="button" variant="outline" onClick={addQuestion} className="border-[#d5dfd7] text-[#35634b]" data-testid="add-exam-question-button"><Plus /> Add question</Button></div><div className="space-y-3" data-testid="question-review-list">{draft.questions.map((question, index) => <article key={`${question.number}-${index}`} className="grid gap-3 rounded-xl border border-[#e2e6e2] bg-[#fcfdfb] p-4 sm:grid-cols-[88px_1fr_100px_34px] sm:items-start" data-testid={`review-question-${index + 1}`}><label><span className="form-label">Number</span><Input value={question.number} onChange={(event) => updateQuestion(index, { number: event.target.value })} className="form-input font-mono" data-testid={`question-number-${index + 1}`} /></label><label><span className="form-label">Question text</span><Textarea value={question.question_text} onChange={(event) => updateQuestion(index, { question_text: event.target.value })} rows={2} className="form-input resize-none leading-5" data-testid={`question-text-${index + 1}`} /></label><label><span className="form-label">Max marks</span><Input type="number" min={1} max={100} value={question.max_marks} onChange={(event) => updateQuestion(index, { max_marks: Math.max(1, Number(event.target.value)) })} className="form-input font-mono" data-testid={`question-marks-${index + 1}`} /></label><button type="button" onClick={() => removeQuestion(index)} disabled={draft.questions.length === 1} className="mt-6 flex size-8 items-center justify-center rounded-lg text-[#a2aca5] hover:bg-[#f8eae4] hover:text-[#b35b40] disabled:opacity-30" aria-label={`Remove question ${question.number}`} data-testid={`remove-question-${index + 1}`}><Trash2 size={15} /></button></article>)}</div><div className="mt-6 flex flex-col gap-4 border-t border-[#e8ebe7] pt-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-xs text-[#718077]"><BrainCircuit size={15} className="text-[#b56549]" /> The next click uses one AI grading call for all answer sheets.</div><Button type="button" onClick={gradeExam} disabled={gradeMutation.isPending} className="h-11 bg-[#1e3a2b] px-5 text-white hover:bg-[#14281e]" data-testid="grade-full-exam-button">{gradeMutation.isPending ? <><Loader2 className="animate-spin" /> Matching & grading all answers…</> : <>Grade complete exam <ArrowRight /></>}</Button></div></div>
          </motion.section>
        )}

        {result && (
          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mt-8 overflow-hidden rounded-[26px] border border-[#d7ded8] bg-white shadow-[0_24px_70px_rgba(40,51,43,0.10)]" data-testid="exam-result-section">
            <div className="grid gap-7 bg-[#173426] px-6 py-8 text-white sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center lg:px-10"><div><div className="flex flex-wrap items-center gap-2"><Badge className="border border-[#8ab29a]/35 bg-[#315c46] text-[#e3f4e8] hover:bg-[#315c46]"><FileCheck2 /> Full exam assessed</Badge><Badge variant="outline" className="border-white/15 bg-white/[0.05] text-white/70">{result.confidence} matching confidence</Badge></div><p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{result.subject} · {result.exam_title}</p><h2 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.04em]" data-testid="exam-result-heading">{result.student_name}'s exam result</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-white/65" data-testid="exam-overall-feedback">{result.overall_feedback}</p></div><div><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{result.overall_quality}</p><ExamScore score={result.score} total={result.total_marks} /></div></div>
            <div className="bg-[#f6f4ef] p-5 sm:p-8 lg:p-10"><div className="mb-5 flex items-center justify-between"><div><p className="section-kicker">Question-by-question report</p><h3 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.035em] text-[#1e3a2b]">Every answer, matched and explained</h3></div><span className="hidden rounded-full bg-[#e4eee7] px-3 py-1.5 text-xs font-bold text-[#35634b] sm:block">{result.question_results.length} questions</span></div><div className="space-y-3" data-testid="exam-question-results">{result.question_results.map((question, index) => { const isOpen = openQuestionIndex === index; return <article key={`${question.number}-${index}`} className="overflow-hidden rounded-2xl border border-[#dfe4df] bg-white" data-testid={`exam-result-question-${index + 1}`}><button type="button" onClick={() => setOpenQuestionIndex((current) => current === index ? null : index)} className="grid w-full gap-3 px-5 py-4 text-left sm:grid-cols-[44px_1fr_auto_24px] sm:items-center" data-testid={`toggle-result-question-${index + 1}`}><span className="flex size-9 items-center justify-center rounded-xl bg-[#edf4ee] font-mono text-xs font-bold text-[#35634b]">{question.number}</span><div><p className="line-clamp-1 text-sm font-bold text-[#2e4035]">{question.question_text}</p><p className="mt-1 text-[11px] font-semibold text-[#8a998f]">{question.quality} · {question.match_confidence} answer match</p></div><p className="font-heading text-2xl font-semibold text-[#1e3a2b]">{question.awarded_marks}<span className="text-xs font-medium text-[#9aa49d]">/{question.max_marks}</span></p><ChevronDown size={17} className={cn("text-[#9aa49d] transition-transform", isOpen && "rotate-180")} /></button>{isOpen && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="border-t border-[#e9ece8]" data-testid={`result-question-detail-${index + 1}`}><div className="grid gap-5 p-5 lg:grid-cols-2"><div className="rounded-xl border border-[#e4e6e1] bg-[#fffefa] p-4"><p className="section-kicker text-[#35634b]">Matched student answer</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#536159]" data-testid={`matched-answer-${index + 1}`}>{question.matched_answer}</p></div><div className="space-y-3"><div className="rounded-xl border border-[#eadfd7] bg-[#fff9f5] p-4"><p className="section-kicker text-[#a65f45]">Why these marks?</p><p className="mt-3 text-sm leading-6 text-[#536159]" data-testid={`question-reason-${index + 1}`}>{question.reason}</p></div><div className="rounded-xl border border-[#d9e4dc] bg-[#f1f7f2] p-4"><p className="section-kicker text-[#35634b]">How to improve</p><p className="mt-3 text-sm leading-6 text-[#536159]">{question.improvement}</p></div></div></div></motion.div>}</article>; })}</div></div>
          </motion.section>
        )}

        <section className="mt-12" data-testid="recent-exams-section"><div className="mb-4 flex items-end justify-between"><div><p className="section-kicker">Saved results</p><h2 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.035em] text-[#1e3a2b]">Recent full exams</h2></div><span className="text-xs text-[#8a998f]">{examsQuery.data?.length ?? 0} saved</span></div><div className="overflow-hidden rounded-2xl border border-[#dfe3df] bg-white">{examsQuery.data?.length ? examsQuery.data.map((exam) => <div key={exam.id} className="grid gap-3 border-b border-[#eceeea] px-5 py-4 last:border-0 sm:grid-cols-[1fr_0.6fr_auto_36px] sm:items-center" data-testid={`saved-exam-${exam.id}`}><button type="button" onClick={() => { setResult(exam); setOpenQuestionIndex(exam.question_results.length ? 0 : null); }} className="text-left" data-testid={`open-saved-exam-${exam.id}`}><p className="text-sm font-bold text-[#2e4035] hover:text-[#b56549]">{exam.student_name}</p><p className="mt-1 text-xs text-[#8a998f]">{exam.exam_title} · {exam.question_results.length} questions</p></button><p className="text-xs font-semibold text-[#65736a]">{exam.subject}</p><p className="font-heading text-lg font-semibold text-[#1e3a2b]">{exam.score}<span className="text-xs text-[#9aa49d]">/{exam.total_marks}</span></p><button type="button" onClick={() => deleteMutation.mutate(exam.id)} className="flex size-8 items-center justify-center rounded-lg text-[#a2aca5] hover:bg-[#f8eae4] hover:text-[#b35b40]" aria-label={`Delete ${exam.student_name} exam`} data-testid={`delete-saved-exam-${exam.id}`}><Trash2 size={15} /></button></div>) : <div className="px-5 py-10 text-center"><Award className="mx-auto text-[#aab3ad]" /><p className="mt-3 text-sm font-bold text-[#65736a]">No full exams graded yet</p><p className="mt-1 text-xs text-[#9aa49d]">Your completed exam reports will appear here.</p></div>}</div></section>
      </main>
    </div>
  );
}