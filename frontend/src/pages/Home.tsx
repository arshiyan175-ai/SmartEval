import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
  ClipboardCheck,
  FileImage,
  FileText,
  History,
  Loader2,
  MessageSquareText,
  Search,
  ScanText,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { Assessment, AssessmentCreate } from "@/lib/types";

const defaultForm: AssessmentCreate = {
  file_name: "",
  file_type: "",
  file_data: "",
  student_name: "",
  subject: "Biology",
  question_text: "",
  answer_text: "",
  max_marks: 10,
  rubric: "Mention chlorophyll, light energy, carbon dioxide and water, glucose and oxygen.",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(value),
  );

function ScoreRing({ score, maxMarks }: { score: number; maxMarks: number }) {
  const percentage = Math.round((score / maxMarks) * 100);
  return (
    <div className="relative flex size-32 items-center justify-center rounded-full border-[12px] border-[#dfe9e2] text-center" data-testid="score-ring">
      <div className="absolute inset-[-12px] rounded-full border-[12px] border-transparent border-t-[#1e3a2b] border-r-[#1e3a2b]" />
      <div>
        <p className="font-serif text-4xl font-bold leading-none text-[#1e3a2b]">{score}</p>
        <p className="mt-1 text-xs font-semibold text-[#718077]">of {maxMarks} · {percentage}%</p>
      </div>
    </div>
  );
}

function DocumentPreview({ file, fileName }: { file: File | null; fileName: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (preview) {
    return <img src={preview} alt="Uploaded answer sheet preview" className="h-full w-full object-contain" data-testid="uploaded-image-preview" />;
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center" data-testid="document-placeholder">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-[#e8f0ec] text-[#1e3a2b]">
        {fileName.toLowerCase().endsWith(".pdf") ? <FileText size={30} /> : <FileImage size={30} />}
      </div>
      <div>
        <p className="font-semibold text-[#1a201c]">{fileName || "Your answer sheet"}</p>
        <p className="mt-1 text-sm leading-6 text-[#718077]">{fileName ? "Ready for Gemini vision extraction" : "Drop an image or PDF to see it here"}</p>
      </div>
      <div className="w-full max-w-[210px] border-t border-dashed border-[#cbd6ce] pt-4 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-[#8a998f]">
        <p>Document canvas</p>
        <p className="mt-2">OCR layer · {fileName ? "ready" : "waiting"}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<AssessmentCreate>(defaultForm);
  const [file, setFile] = useState<File | null>(null);
  const [activeAssessment, setActiveAssessment] = useState<Assessment | null>(null);
  const [historySearch, setHistorySearch] = useState("");

  const assessmentsQuery = useQuery({
    queryKey: ["assessments"],
    queryFn: () => apiGet<Assessment[]>("/assessments"),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (payload: AssessmentCreate) => apiPost<Assessment>("/assessments", payload),
    onSuccess: (assessment) => {
      setActiveAssessment(assessment);
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      toast.success("Assessment ready for your review");
    },
    onError: () => toast.error("We could not assess this answer. Please try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/assessments/${id}`),
    onSuccess: (_, id) => {
      if (activeAssessment?.id === id) setActiveAssessment(null);
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      toast.success("Assessment removed");
    },
  });

  const recentAssessments = assessmentsQuery.data ?? [];
  const filteredAssessments = recentAssessments.filter((assessment) => {
    const haystack = `${assessment.student_name} ${assessment.subject} ${assessment.file_name}`.toLowerCase();
    return haystack.includes(historySearch.toLowerCase());
  });

  const updateField = <K extends keyof AssessmentCreate>(key: K, value: AssessmentCreate[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleFile = (nextFile?: File) => {
    if (!nextFile) return;
    const valid = nextFile.type.startsWith("image/") || nextFile.type === "application/pdf";
    if (!valid) {
      toast.error("Please choose a JPG, PNG, WEBP, or PDF file.");
      return;
    }
    setFile(nextFile);
    updateField("file_name", nextFile.name);
    updateField("file_type", nextFile.type);
    updateField("file_data", "");
  };

  const readFileAsDataUrl = (currentFile: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read the uploaded file"));
    reader.readAsDataURL(currentFile);
  });

  const assessAnswer = async () => {
    if (!file) {
      toast.error("Upload an answer sheet first");
      return;
    }
    try {
      const fileData = form.file_data || await readFileAsDataUrl(file);
      createMutation.mutate({ ...form, file_data: fileData });
    } catch {
      toast.error("We could not read that document. Please choose it again.");
    }
  };

  return (
    <div className="min-h-svh bg-[#faf8f5] text-[#1a201c]" data-testid="gradewise-app">
      <header className="sticky top-0 z-20 border-b border-[#e5dfd5]/80 bg-[#faf8f5]/90 backdrop-blur-xl" data-testid="app-header">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#1e3a2b] text-[#f7f4ed] shadow-[0_6px_20px_rgba(30,58,43,0.18)]" data-testid="brand-mark">
              <ClipboardCheck size={19} />
            </div>
            <div>
              <p className="font-heading text-lg font-bold tracking-[-0.04em] text-[#1e3a2b]">gradewise</p>
              <p className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a998f] sm:block">Teacher assessment studio</p>
            </div>
          </div>
          <nav className="flex items-center gap-1 text-sm font-semibold text-[#718077]" data-testid="main-navigation">
            <a href="#studio" className="rounded-lg px-3 py-2 hover:bg-[#edf2ee] hover:text-[#1e3a2b]" data-testid="studio-nav-link">Studio</a>
            <a href="#history" className="rounded-lg px-3 py-2 hover:bg-[#edf2ee] hover:text-[#1e3a2b]" data-testid="history-nav-link">History</a>
            <span className="ml-2 hidden items-center gap-2 border-l border-[#e5dfd5] pl-4 text-xs text-[#8a998f] sm:flex" data-testid="privacy-note"><span className="size-2 rounded-full bg-[#5b9a79]" /> Private workspace</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 pb-16 pt-8 sm:px-8 lg:px-12 lg:pt-12">
        <section className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end" data-testid="page-intro">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#dce7df] bg-[#edf4ee] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#35634b]" data-testid="workspace-status"><Sparkles size={13} /> New assessment</div>
            <h1 className="font-heading text-4xl font-bold leading-[1.04] tracking-[-0.06em] text-[#1e3a2b] sm:text-5xl lg:text-6xl" data-testid="page-title">From paper to<br /><span className="font-serif font-normal italic text-[#c86d51]">useful feedback.</span></h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#5b6c60] sm:text-lg" data-testid="page-description">Upload a student answer, add the question and marks, and get a thoughtful first-pass assessment your teacher judgement can build on.</p>
          </div>
          <div className="flex gap-8 border-l border-[#e5dfd5] pl-5 lg:mb-1" data-testid="workspace-stats">
            <div><p className="font-serif text-3xl font-bold text-[#1e3a2b]" data-testid="assessments-count">{recentAssessments.length}</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-[#8a998f]">Assessed</p></div>
            <div><p className="font-serif text-3xl font-bold text-[#1e3a2b]">{recentAssessments.length ? `${Math.round(recentAssessments.reduce((sum, item) => sum + item.percentage, 0) / recentAssessments.length)}%` : "—"}</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-[#8a998f]">Avg. score</p></div>
          </div>
        </section>

        <section id="studio" className="grid gap-6 xl:grid-cols-[minmax(300px,0.85fr)_minmax(460px,1.15fr)]" data-testid="grading-studio">
          <div className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-[#e5dfd5] bg-white shadow-[0_12px_35px_rgba(57,52,43,0.06)]" data-testid="document-panel">
            <div className="flex items-center justify-between border-b border-[#eee9e2] px-5 py-4">
              <div className="flex items-center gap-2"><FileText size={16} className="text-[#c86d51]" /><p className="text-sm font-bold">Answer sheet</p></div>
              <Badge variant="outline" className="border-[#dfe9e2] bg-[#f5f9f6] text-[#35634b]" data-testid="file-format-badge">JPG · PNG · PDF</Badge>
            </div>
            <div className="flex flex-1 items-center justify-center bg-[#f5f2ee] p-5">
              <div className="relative h-full min-h-[410px] w-full overflow-hidden rounded-xl border border-[#e0d9d0] bg-[#fffdfa] shadow-[0_8px_24px_rgba(57,52,43,0.08)]" data-testid="document-preview">
                <DocumentPreview file={file} fileName={form.file_name} />
                {file && <button type="button" onClick={() => { setFile(null); setForm((current) => ({ ...current, file_name: "", file_type: "", file_data: "" })); }} className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-[#1e3a2b] text-white shadow-md hover:bg-[#14281e]" aria-label="Remove uploaded file" data-testid="remove-file-button"><X size={14} /></button>}
              </div>
            </div>
            <div className="border-t border-[#eee9e2] p-5">
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} data-testid="upload-file-input" />
              <button type="button" onClick={() => fileInputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files[0]); }} className="group flex w-full items-center justify-between rounded-xl border border-dashed border-[#b9c8bc] bg-[#f8fbf8] px-4 py-3 text-left hover:border-[#1e3a2b] hover:bg-[#f0f6f1]" data-testid="upload-dropzone">
                <span className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-[#e8f0ec] text-[#1e3a2b]"><Upload size={17} /></span><span><span className="block text-sm font-bold text-[#1e3a2b]">{file ? "Replace answer sheet" : "Choose answer sheet"}</span><span className="block text-xs text-[#7a8a80]">or drag and drop here</span></span></span><ArrowRight size={17} className="text-[#8a998f] transition-transform group-hover:translate-x-1" />
              </button>
              <p className="mt-3 text-center text-[11px] text-[#9aa69d]" data-testid="upload-help">Maximum 12 MB · sent only when you choose Assess answer</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e5dfd5] bg-white p-5 shadow-[0_12px_35px_rgba(57,52,43,0.06)] sm:p-7" data-testid="assessment-form-panel">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#c86d51]">Step 01 / Configure</p><h2 className="font-heading text-2xl font-bold tracking-[-0.04em] text-[#1e3a2b]">Set the marking context</h2><p className="mt-2 text-sm leading-6 text-[#718077]">A little context helps the assessment stay anchored to your intent.</p></div>
              <div className="hidden size-10 items-center justify-center rounded-xl bg-[#fdf2ee] text-[#c86d51] sm:flex"><BookOpen size={18} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block" data-testid="student-name-field"><span className="form-label">Student name <span className="font-normal normal-case tracking-normal text-[#a2aca5]">(optional)</span></span><Input value={form.student_name} onChange={(event) => updateField("student_name", event.target.value)} placeholder="e.g. Aisha Khan" className="form-input" data-testid="student-name-input" /></label>
              <label className="block" data-testid="subject-field"><span className="form-label">Subject</span><Input value={form.subject} onChange={(event) => updateField("subject", event.target.value)} placeholder="e.g. Biology" className="form-input" data-testid="subject-input" /></label>
            </div>
            <label className="mt-5 block" data-testid="question-field"><span className="form-label">Question / prompt <span className="font-normal normal-case tracking-normal text-[#a2aca5]">(optional — AI can extract it)</span></span><Textarea value={form.question_text} onChange={(event) => updateField("question_text", event.target.value)} rows={3} placeholder="Leave blank to extract the question from the uploaded file" className="form-input resize-none leading-6" data-testid="question-input" /></label>
            <div className="mt-5 grid gap-4 sm:grid-cols-[0.38fr_1fr]">
              <label className="block" data-testid="max-marks-field"><span className="form-label">Maximum marks</span><Input type="number" min={1} max={100} value={form.max_marks} onChange={(event) => updateField("max_marks", Number(event.target.value))} className="form-input font-mono" data-testid="max-marks-input" /></label>
              <label className="block" data-testid="rubric-field"><span className="form-label">Marking guide <span className="font-normal normal-case tracking-normal text-[#a2aca5]">(optional)</span></span><Input value={form.rubric} onChange={(event) => updateField("rubric", event.target.value)} placeholder="Key ideas, evidence, or method to look for" className="form-input" data-testid="rubric-input" /></label>
            </div>
            <label className="mt-5 block" data-testid="answer-text-field"><span className="form-label">Paste answer text <span className="font-normal normal-case tracking-normal text-[#a2aca5]">(optional — AI reads the file)</span></span><Textarea value={form.answer_text} onChange={(event) => updateField("answer_text", event.target.value)} rows={4} placeholder="Optional: paste text to help the AI compare it with the uploaded answer." className="form-input resize-none leading-6" data-testid="answer-text-input" /></label>
            <div className="mt-6 flex flex-col gap-3 border-t border-[#eee9e2] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-[#718077]" data-testid="ai-disclosure"><BrainCircuit size={14} className="text-[#c86d51]" /><span>Powered by <strong className="text-[#526057]">Gemini vision</strong> · teacher review stays in control.</span></div>
              <Button type="button" onClick={assessAnswer} disabled={createMutation.isPending} className="h-11 bg-[#1e3a2b] px-5 text-[#f7f4ed] shadow-[0_8px_18px_rgba(30,58,43,0.16)] hover:bg-[#14281e]" data-testid="assess-answer-button">{createMutation.isPending ? <><Loader2 className="animate-spin" /> Reading & grading…</> : <>Assess answer <ArrowRight /></>}</Button>
            </div>
          </div>
        </section>

        {activeAssessment && (
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-8 overflow-hidden rounded-2xl border border-[#d9e6dc] bg-[#f5f9f6] shadow-[0_12px_35px_rgba(57,52,43,0.06)]" data-testid="assessment-result">
            <div className="flex flex-col justify-between gap-5 border-b border-[#dce8df] px-5 py-6 sm:flex-row sm:items-center sm:px-8">
              <div><div className="mb-2 flex flex-wrap items-center gap-2"><Badge className="bg-[#dcefe2] text-[#35634b] hover:bg-[#dcefe2]" data-testid="result-status-badge"><Check size={13} /> Ready for review</Badge><Badge variant="outline" className="border-[#e3c9bd] bg-[#fff8f5] text-[#a7543b]" data-testid="ai-source-badge"><BrainCircuit size={13} /> {activeAssessment.ai_source === "Live AI" ? "Live Gemini vision" : "MOCKED"}</Badge><span className="text-xs font-semibold text-[#8a998f]">{activeAssessment.subject} · {activeAssessment.file_name}</span></div><h2 className="font-heading text-2xl font-bold tracking-[-0.04em] text-[#1e3a2b]" data-testid="result-heading">Assessment for {activeAssessment.student_name}</h2></div>
              <div className="flex items-center gap-5"><div className="text-right"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#718077]">AI confidence</p><p className="mt-1 font-mono text-sm font-bold text-[#35634b]" data-testid="confidence-value">{activeAssessment.confidence}</p></div><ScoreRing score={activeAssessment.score} maxMarks={activeAssessment.max_marks} /></div>
            </div>
            <div className="grid gap-8 px-5 py-7 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="section-kicker">Question read from the paper</p>
                <div className="mt-3 flex gap-3 rounded-xl border border-[#e1e9e2] bg-white p-4 text-sm leading-6 text-[#526057]" data-testid="extracted-question"><ScanText size={17} className="mt-1 shrink-0 text-[#c86d51]" /><span>{activeAssessment.question_text}</span></div>
                <div className="mt-5 flex items-center justify-between"><p className="section-kicker">Student answer extracted</p><span className="font-mono text-[11px] text-[#8a998f]" data-testid="answer-word-count">{activeAssessment.word_count} words</span></div>
                <div className="mt-3 rounded-xl border border-[#e1e9e2] bg-white p-4 font-mono text-xs leading-6 text-[#526057]" data-testid="extracted-answer">{activeAssessment.extracted_answer}</div>
                <div className="mt-6 rounded-xl border border-[#e1e9e2] bg-white p-5" data-testid="feedback-panel"><p className="section-kicker">Teacher-facing feedback</p><p className="mt-3 text-sm leading-6 text-[#526057]" data-testid="teacher-feedback">{activeAssessment.feedback}</p><div className="mt-5 grid gap-5 sm:grid-cols-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#35634b]">What worked</p><ul className="mt-2 space-y-2 text-xs leading-5 text-[#526057]">{activeAssessment.strengths.map((item) => <li key={item} className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[#5b9a79]" />{item}</li>)}</ul></div><div><p className="text-xs font-bold uppercase tracking-wider text-[#c86d51]">Watch next</p><ul className="mt-2 space-y-2 text-xs leading-5 text-[#526057]">{activeAssessment.weaknesses.map((item) => <li key={item} className="flex gap-2"><AlertCircle size={14} className="mt-0.5 shrink-0 text-[#c86d51]" />{item}</li>)}</ul></div><div><p className="text-xs font-bold uppercase tracking-wider text-[#c86d51]">Suggested improvement</p><ul className="mt-2 space-y-2 text-xs leading-5 text-[#526057]">{activeAssessment.improvements.map((item) => <li key={item} className="flex gap-2"><ArrowRight size={14} className="mt-0.5 shrink-0 text-[#c86d51]" />{item}</li>)}</ul></div></div></div>
                <div className="mt-5 rounded-xl border border-[#e1e9e2] bg-white p-5" data-testid="answer-quality-panel"><div className="flex items-center justify-between gap-4"><div><p className="section-kicker">Answer quality</p><p className="mt-2 font-heading text-xl font-bold text-[#1e3a2b]" data-testid="answer-quality">{activeAssessment.quality}</p></div><div className="rounded-full bg-[#edf4ee] px-3 py-1.5 text-xs font-bold text-[#35634b]" data-testid="answer-length-assessment">{activeAssessment.length_assessment}</div></div><p className="mt-3 text-sm leading-6 text-[#526057]" data-testid="quality-summary">{activeAssessment.quality_summary}</p><div className="mt-4 flex gap-2 border-t border-[#eee9e2] pt-4 text-xs leading-5 text-[#718077]" data-testid="short-answer-assessment"><MessageSquareText size={15} className="mt-0.5 shrink-0 text-[#c86d51]" /><span>{activeAssessment.short_answer_assessment}</span></div></div>
              </div>
              <div><div className="rounded-xl border border-[#e8ded6] bg-[#fffaf7] p-5" data-testid="score-justification"><div className="flex items-center gap-2"><BrainCircuit size={16} className="text-[#c86d51]" /><p className="section-kicker text-[#a7543b]">Why this score?</p></div><p className="mt-3 text-sm leading-6 text-[#526057]" data-testid="score-justification-text">{activeAssessment.score_justification}</p></div><div className="mt-6 flex items-center justify-between"><p className="section-kicker">Mark breakdown</p><span className="font-mono text-xs text-[#8a998f]">{activeAssessment.score}/{activeAssessment.max_marks} total</span></div><div className="mt-3 space-y-3">{activeAssessment.criteria.map((criterion) => <div key={criterion.criterion} className="rounded-xl border border-[#e1e9e2] bg-white p-4" data-testid={`criterion-${criterion.criterion.toLowerCase().replaceAll(" ", "-")}`}><div className="flex items-center justify-between gap-4"><p className="text-sm font-bold text-[#1e3a2b]">{criterion.criterion}</p><p className="font-mono text-sm font-bold text-[#35634b]">{criterion.score}<span className="font-normal text-[#9aa69d]">/{criterion.max_score}</span></p></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e9efea]"><div className="h-full rounded-full bg-[#5b9a79]" style={{ width: `${(criterion.score / criterion.max_score) * 100}%` }} /></div><p className="mt-3 text-xs leading-5 text-[#718077]">{criterion.comment}</p></div>)}</div><div className="mt-5 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => toast.success("Feedback copied to clipboard")} className="border-[#c9dacc] bg-white text-[#35634b] hover:bg-[#edf4ee]" data-testid="copy-feedback-button">Copy feedback</Button><Button type="button" variant="ghost" onClick={() => setActiveAssessment(null)} className="text-[#718077]" data-testid="close-result-button">Close result</Button></div></div>
            </div>
          </motion.section>
        )}

        <section id="history" className="mt-14" data-testid="history-section">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="section-kicker">Your workspace</p><h2 className="mt-2 font-heading text-2xl font-bold tracking-[-0.04em] text-[#1e3a2b]">Recent assessments</h2></div><div className="relative w-full sm:w-64"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a998f]" /><Input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Search student or subject" className="h-9 border-[#e5dfd5] bg-white pl-9" data-testid="history-search-input" /></div></div>
          <div className="overflow-hidden rounded-2xl border border-[#e5dfd5] bg-white" data-testid="history-table">
            <div className="hidden grid-cols-[1.3fr_1fr_0.8fr_0.65fr_34px] items-center gap-4 border-b border-[#eee9e2] bg-[#fcfbf9] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a998f] sm:grid"><span>Student / file</span><span>Subject</span><span>Assessed</span><span>Score</span><span /></div>
            {filteredAssessments.length ? filteredAssessments.map((assessment) => <div key={assessment.id} className="grid gap-3 border-b border-[#f0ece7] px-5 py-4 last:border-0 sm:grid-cols-[1.3fr_1fr_0.8fr_0.65fr_34px] sm:items-center sm:gap-4" data-testid={`history-row-${assessment.id}`}><button type="button" className="text-left" onClick={() => setActiveAssessment(assessment)} data-testid={`history-open-${assessment.id}`}><p className="text-sm font-bold text-[#1e3a2b] hover:text-[#c86d51]">{assessment.student_name}</p><p className="mt-1 truncate text-xs text-[#8a998f]">{assessment.file_name}</p></button><p className="text-xs font-semibold text-[#526057]">{assessment.subject}</p><p className="text-xs text-[#718077]">{formatDate(assessment.created_at)}</p><p className="font-mono text-sm font-bold text-[#35634b]">{assessment.score}<span className="font-normal text-[#9aa69d]">/{assessment.max_marks}</span></p><button type="button" onClick={() => deleteMutation.mutate(assessment.id)} className="flex size-8 items-center justify-center rounded-lg text-[#a5aea7] hover:bg-[#fdf2ee] hover:text-[#c86d51]" aria-label={`Delete ${assessment.student_name} assessment`} data-testid={`history-delete-${assessment.id}`}><X size={15} /></button></div>) : <div className="flex flex-col items-center justify-center px-5 py-14 text-center" data-testid="history-empty"><div className="flex size-12 items-center justify-center rounded-2xl bg-[#f3efe9] text-[#8a998f]"><History size={21} /></div><p className="mt-4 text-sm font-bold text-[#526057]">No assessments yet</p><p className="mt-1 max-w-xs text-xs leading-5 text-[#8a998f]">Your graded answer sheets will appear here so you can revisit them later.</p></div>}
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-[1500px] items-center justify-between border-t border-[#e5dfd5] px-5 py-6 text-xs text-[#8a998f] sm:px-8 lg:px-12" data-testid="app-footer"><span>gradewise · made for thoughtful marking</span><span className="hidden items-center gap-1 sm:flex">Built for teacher review <ChevronDown size={13} /></span></footer>
    </div>
  );
}