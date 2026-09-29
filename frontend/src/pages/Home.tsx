import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
  FileImage,
  FileSearch,
  FileText,
  History,
  Lightbulb,
  ListChecks,
  Loader2,
  MessageSquareText,
  MousePointer2,
  Search,
  ScanText,
  ShieldCheck,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EvalXLogo } from "@/components/EvalXLogo";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <div className="relative flex size-32 items-center justify-center rounded-full p-[9px] shadow-[0_10px_32px_rgba(8,25,17,0.18)]" style={{ background: `conic-gradient(#dba07f ${percentage * 3.6}deg, rgba(255,255,255,0.14) 0deg)` }} data-testid="score-ring">
      <div className="flex size-full items-center justify-center rounded-full bg-[#183426] text-center ring-1 ring-white/10">
        <div>
          <p className="font-serif text-4xl font-bold leading-none text-white" data-testid="score-value">{score}</p>
          <p className="mt-1 text-[11px] font-semibold text-white/65" data-testid="score-maximum">of {maxMarks} · {percentage}%</p>
        </div>
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
    <div className="min-h-svh bg-[#faf8f5] text-[#1a201c]" data-testid="evalx-app">
      <header className="sticky top-0 z-20 border-b border-[#e5dfd5]/80 bg-[#faf8f5]/90 backdrop-blur-xl" data-testid="app-header">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
          <EvalXLogo />
          <nav className="flex items-center gap-1 text-sm font-semibold text-[#718077]" data-testid="main-navigation">
            <a href="#studio" className="rounded-lg px-3 py-2 hover:bg-[#edf2ee] hover:text-[#1e3a2b]" data-testid="studio-nav-link">Studio</a>
            <a href="#history" className="rounded-lg px-3 py-2 hover:bg-[#edf2ee] hover:text-[#1e3a2b]" data-testid="history-nav-link">History</a>
            <span className="ml-2 hidden items-center gap-2 border-l border-[#e5dfd5] pl-4 text-xs text-[#8a998f] sm:flex" data-testid="privacy-note"><span className="size-2 rounded-full bg-[#5b9a79]" /> Private workspace</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 pb-16 sm:px-8 lg:px-12">
        <section className="hero-grid relative -mx-5 overflow-hidden border-b border-[#e5dfd5] px-5 pb-14 pt-12 sm:-mx-8 sm:px-8 sm:pb-16 sm:pt-16 lg:-mx-12 lg:px-12 lg:pb-20 lg:pt-20" data-testid="landing-hero">
          <div className="pointer-events-none absolute left-[48%] top-8 size-[430px] rounded-full bg-[#dce9df]/45 blur-[100px]" />
          <div className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="max-w-3xl" data-testid="hero-copy">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d4ded6] bg-white/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.17em] text-[#456451] shadow-[0_4px_18px_rgba(40,51,43,0.04)]" data-testid="hero-eyebrow"><Sparkles size={13} /> AI-assisted marking, teacher approved</div>
              <h1 className="font-heading text-[2.8rem] font-semibold leading-[0.98] tracking-[-0.065em] text-[#18271f] sm:text-6xl lg:text-[4.7rem]" data-testid="page-title">Mark answers.<br /><span className="text-[#718279]">Keep your judgement.</span></h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-[#65736a] sm:text-lg" data-testid="page-description">Turn an answer sheet into an explainable score, clean transcript, and constructive feedback—without losing the human context behind the mark.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row" data-testid="hero-actions">
                <Button type="button" onClick={() => fileInputRef.current?.click()} className="group h-12 rounded-xl bg-[#1e3a2b] px-5 text-sm font-bold text-white shadow-[0_10px_28px_rgba(30,58,43,0.18)] hover:bg-[#14281e]" data-testid="hero-upload-button"><Upload className="transition-transform duration-200 group-hover:-translate-y-0.5" /> Upload an answer sheet</Button>
                <Button type="button" variant="outline" onClick={() => document.getElementById("studio")?.scrollIntoView({ behavior: "smooth" })} className="h-12 rounded-xl border-[#d6ddd7] bg-white/70 px-5 text-sm font-bold text-[#34463b] hover:bg-white" data-testid="hero-workspace-button">Open grading workspace <ArrowRight /></Button>
              </div>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-medium text-[#78857d]" data-testid="hero-trust-row"><span className="flex items-center gap-2"><ShieldCheck size={15} className="text-[#52735e]" /> Teacher stays in control</span><span className="flex items-center gap-2"><FileText size={15} className="text-[#52735e]" /> Images and PDFs</span><span className="flex items-center gap-2"><BrainCircuit size={15} className="text-[#52735e]" /> Clear score reasoning</span></div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.65, delay: 0.1 }} className="relative mx-auto w-full max-w-[590px]" data-testid="hero-product-preview">
              <div className="absolute -left-6 top-12 hidden rounded-xl border border-[#dbe3dc] bg-white px-4 py-3 shadow-[0_14px_36px_rgba(40,51,43,0.12)] sm:block hero-float" data-testid="hero-ocr-note"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8a998f]">OCR complete</p><p className="mt-1 text-sm font-bold text-[#1e3a2b]">Answer extracted</p></div>
              <div className="overflow-hidden rounded-[24px] border border-[#d9e1da] bg-white shadow-[0_28px_80px_rgba(40,51,43,0.13)]">
                <div className="flex items-center justify-between border-b border-[#e8ece8] bg-[#fbfcfa] px-5 py-3"><div className="flex gap-1.5"><span className="size-2 rounded-full bg-[#d9a48a]" /><span className="size-2 rounded-full bg-[#d6d8d2]" /><span className="size-2 rounded-full bg-[#9db5a5]" /></div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9aa49d]">Assessment preview</p><span className="size-5" /></div>
                <div className="grid min-h-[350px] sm:grid-cols-[0.84fr_1.16fr]">
                  <div className="border-b border-[#e7ebe7] bg-[#f0f2ee] p-5 sm:border-b-0 sm:border-r"><div className="h-full rounded-lg border border-[#d8d8d1] bg-[#fffefb] p-5 shadow-sm"><div className="h-2 w-20 rounded-full bg-[#ced6cf]" /><div className="mt-5 h-2 w-full rounded-full bg-[#e5e7e2]" /><div className="mt-2 h-2 w-4/5 rounded-full bg-[#e5e7e2]" /><div className="mt-8 space-y-3"><div className="h-px bg-[#dfe4de]" /><div className="h-px bg-[#dfe4de]" /><div className="h-px bg-[#dfe4de]" /><div className="h-px bg-[#dfe4de]" /></div><div className="mt-8 h-2 w-28 rounded-full bg-[#d9a48a]/70" /></div></div>
                  <div className="flex flex-col p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.17em] text-[#99a39c]">Suggested score</p><p className="mt-1 font-heading text-3xl font-semibold tracking-[-0.05em] text-[#1e3a2b]">8.5<span className="text-sm font-medium text-[#8b978f]"> / 10</span></p></div><div className="flex size-11 items-center justify-center rounded-full border-[5px] border-[#6f9a7e] border-r-[#e3e8e3] text-[10px] font-bold text-[#35634b]">85%</div></div><div className="mt-6 rounded-xl border border-[#e4e8e4] bg-[#f9faf8] p-4"><div className="flex items-center gap-2"><WandSparkles size={13} className="text-[#b56549]" /><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8c6b5f]">Why this score</p></div><p className="mt-3 text-xs leading-5 text-[#627068]">Strong understanding with accurate evidence. One final explanation would make the response complete.</p></div><div className="mt-5 space-y-3"><div><div className="flex justify-between text-[10px] font-bold text-[#66736b]"><span>Understanding</span><span>4/4</span></div><div className="mt-1.5 h-1.5 rounded-full bg-[#edf0ed]"><div className="h-full w-full rounded-full bg-[#6b9879]" /></div></div><div><div className="flex justify-between text-[10px] font-bold text-[#66736b]"><span>Evidence</span><span>3/4</span></div><div className="mt-1.5 h-1.5 rounded-full bg-[#edf0ed]"><div className="h-full w-3/4 rounded-full bg-[#d49576]" /></div></div></div><div className="mt-auto flex items-center gap-2 pt-5 text-[10px] font-bold text-[#52735e]"><Check size={13} /> Ready for teacher review</div></div>
                </div>
              </div>
              <div className="absolute -bottom-5 right-5 rounded-xl border border-[#dbe3dc] bg-[#1e3a2b] px-4 py-3 text-white shadow-[0_14px_36px_rgba(30,58,43,0.2)] hero-float-delayed" data-testid="hero-feedback-note"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/55">Quality check</p><p className="mt-1 text-sm font-bold">Strong response</p></div>
            </motion.div>
          </div>
        </section>

        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.5 }} className="py-14 sm:py-16" data-testid="grading-journey-section">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="section-kicker">A clearer marking flow</p><h2 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.045em] text-[#1e3a2b]" data-testid="journey-heading">One upload. Three useful outcomes.</h2></div><p className="max-w-md text-sm leading-6 text-[#718077]" data-testid="journey-description">The interface does the organising so you can focus on whether the assessment feels fair.</p></div>
          <div className="grid gap-4 md:grid-cols-3">
            {[{ icon: Upload, number: "01", title: "Upload the work", copy: "Add a clear image or PDF. Include a rubric when you want tighter marking guidance." }, { icon: ScanText, number: "02", title: "Review the transcript", copy: "Check the extracted question and student answer in a clean, paper-style reading view." }, { icon: Award, number: "03", title: "Understand the mark", copy: "See exactly why each mark was earned, plus strengths and the best next improvement." }].map((item, index) => <motion.article key={item.number} whileHover={{ y: -6 }} transition={{ duration: 0.2 }} className="group relative overflow-hidden rounded-2xl border border-[#dee4de] bg-white p-6 shadow-[0_8px_30px_rgba(40,51,43,0.04)] hover:border-[#bfcfc3] hover:shadow-[0_18px_42px_rgba(40,51,43,0.09)]" data-testid={`journey-card-${index + 1}`}><div className="flex items-center justify-between"><span className="flex size-11 items-center justify-center rounded-xl bg-[#edf3ee] text-[#35634b] transition-colors duration-200 group-hover:bg-[#1e3a2b] group-hover:text-white"><item.icon size={19} /></span><span className="font-mono text-xs font-bold text-[#b3bbb5]">{item.number}</span></div><h3 className="mt-6 font-heading text-lg font-semibold tracking-[-0.025em] text-[#1e3a2b]">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[#718077]">{item.copy}</p><div className="absolute bottom-0 left-0 h-0.5 w-0 bg-[#c86d51] transition-[width] duration-300 group-hover:w-full" /></motion.article>)}
          </div>
        </motion.section>

        <section className="mb-8 flex flex-col justify-between gap-5 border-t border-[#e5dfd5] pt-10 sm:flex-row sm:items-end" data-testid="workspace-intro">
          <div><div className="mb-3 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#52735e]" data-testid="workspace-status"><MousePointer2 size={13} /> Your grading workspace</div><h2 className="font-heading text-3xl font-semibold tracking-[-0.045em] text-[#1e3a2b] sm:text-4xl">Ready when you are.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#718077]">Upload the student work, set the maximum marks, and let the review begin.</p></div>
          <div className="flex gap-8" data-testid="workspace-stats"><div><p className="font-heading text-3xl font-semibold tracking-[-0.04em] text-[#1e3a2b]" data-testid="assessments-count">{recentAssessments.length}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#8a998f]">Assessed</p></div><div><p className="font-heading text-3xl font-semibold tracking-[-0.04em] text-[#1e3a2b]">{recentAssessments.length ? `${Math.round(recentAssessments.reduce((sum, item) => sum + item.percentage, 0) / recentAssessments.length)}%` : "—"}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#8a998f]">Avg. score</p></div></div>
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
          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="result-shell mt-9 overflow-hidden rounded-[28px] border border-[#d5dfd7] bg-white shadow-[0_24px_70px_rgba(40,51,43,0.10)]" data-testid="assessment-result">
            <div className="relative overflow-hidden bg-[#183426] px-5 py-7 text-white sm:px-8 lg:px-10">
              <div className="pointer-events-none absolute -right-20 -top-40 size-96 rounded-full border border-white/10 bg-white/[0.03]" />
              <div className="pointer-events-none absolute bottom-0 left-[42%] h-full w-px bg-white/10" />
              <div className="relative flex flex-col justify-between gap-7 sm:flex-row sm:items-center">
                <div className="max-w-2xl">
                  <div className="mb-4 flex flex-wrap items-center gap-2"><Badge className="border border-[#8ab29a]/40 bg-[#315c46] text-[#e3f4e8] hover:bg-[#315c46]" data-testid="result-status-badge"><Check size={13} /> Ready for teacher review</Badge><Badge variant="outline" className="border-white/15 bg-white/[0.06] text-white/75" data-testid="ai-source-badge"><BrainCircuit size={13} /> {activeAssessment.ai_source === "Live AI" ? "Live Gemini vision" : "MOCKED"}</Badge></div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50" data-testid="result-file-meta">{activeAssessment.subject} · {activeAssessment.file_name}</p>
                  <h2 className="mt-2 font-heading text-2xl font-bold tracking-[-0.04em] sm:text-3xl" data-testid="result-heading">Assessment for {activeAssessment.student_name}</h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/65" data-testid="result-quality-summary">{activeAssessment.quality_summary}</p>
                </div>
                <div className="flex items-center gap-6 sm:shrink-0"><div className="text-left sm:text-right"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Assessment quality</p><p className="mt-1 text-lg font-bold text-[#f1c5ad]" data-testid="answer-quality">{activeAssessment.quality}</p><p className="mt-2 text-xs text-white/55">Confidence <span className="font-bold text-white" data-testid="confidence-value">{activeAssessment.confidence}</span></p></div><ScoreRing score={activeAssessment.score} maxMarks={activeAssessment.max_marks} /></div>
              </div>
            </div>

            <Tabs defaultValue="overview" className="w-full" data-testid="result-tabs">
              <div className="border-b border-[#e8e4dd] bg-[#fcfbf9] px-5 sm:px-8 lg:px-10">
                <TabsList variant="line" className="h-14 w-full justify-start gap-6 bg-transparent p-0 sm:gap-9" data-testid="result-tabs-list">
                  <TabsTrigger value="overview" className="h-14 rounded-none px-0 text-sm font-bold text-[#738078] data-selected:text-[#1e3a2b]" data-testid="overview-tab"><Award size={16} /> Overview</TabsTrigger>
                  <TabsTrigger value="extraction" className="h-14 rounded-none px-0 text-sm font-bold text-[#738078] data-selected:text-[#1e3a2b]" data-testid="extraction-tab"><FileSearch size={16} /> Extracted work</TabsTrigger>
                  <TabsTrigger value="feedback" className="h-14 rounded-none px-0 text-sm font-bold text-[#738078] data-selected:text-[#1e3a2b]" data-testid="feedback-tab"><MessageSquareText size={16} /> Feedback</TabsTrigger>
                </TabsList>
              </div>

              <div className="bg-[#f6f4ef] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
                <TabsContent value="overview" className="m-0" data-testid="overview-tab-panel">
                  <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
                    <div className="space-y-5">
                      <article className="rounded-2xl border border-[#eadfd7] bg-[#fffaf7] p-5 sm:p-6" data-testid="score-justification"><div className="flex items-center gap-2 text-[#a7543b]"><BrainCircuit size={17} /><p className="section-kicker text-[#a7543b]">Why this score?</p></div><p className="mt-4 text-[15px] leading-7 text-[#3f4d44]" data-testid="score-justification-text">{activeAssessment.score_justification}</p></article>
                      <article className="rounded-2xl border border-[#dfe5df] bg-white p-5 sm:p-6" data-testid="answer-quality-panel"><div className="flex items-start justify-between gap-4"><div><p className="section-kicker">Response profile</p><p className="mt-2 font-heading text-xl font-bold text-[#1e3a2b]" data-testid="response-quality">{activeAssessment.quality}</p></div><span className="rounded-full bg-[#edf4ee] px-3 py-1.5 font-mono text-[11px] font-bold text-[#35634b]" data-testid="answer-word-count">{activeAssessment.word_count} words</span></div><p className="mt-4 text-sm leading-6 text-[#5e6b63]" data-testid="quality-summary">{activeAssessment.quality_summary}</p><div className="mt-5 border-t border-[#eeeae4] pt-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a998f]">Length & relevance</p><p className="mt-2 text-xs leading-5 text-[#65736a]" data-testid="answer-length-assessment">{activeAssessment.length_assessment}</p></div></article>
                    </div>
                    <div><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><ListChecks size={17} className="text-[#35634b]" /><p className="section-kicker text-[#526057]">Criterion breakdown</p></div><span className="rounded-full bg-[#e5eee8] px-3 py-1 font-mono text-xs font-bold text-[#35634b]" data-testid="breakdown-total">{activeAssessment.score}/{activeAssessment.max_marks} total</span></div><div className="space-y-3">{activeAssessment.criteria.map((criterion, index) => <article key={criterion.criterion} className="group rounded-2xl border border-[#dfe5df] bg-white p-5 shadow-[0_2px_10px_rgba(40,51,43,0.03)] hover:border-[#b8cbbd]" data-testid={`criterion-${criterion.criterion.toLowerCase().replaceAll(" ", "-")}`}><div className="flex items-start justify-between gap-4"><div className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#edf4ee] font-mono text-[11px] font-bold text-[#35634b]">0{index + 1}</span><div><p className="text-sm font-bold text-[#1e3a2b]">{criterion.criterion}</p><p className="mt-2 text-xs leading-5 text-[#718077]">{criterion.comment}</p></div></div><p className="shrink-0 font-serif text-xl font-bold text-[#1e3a2b]">{criterion.score}<span className="font-sans text-xs font-medium text-[#9aa69d]">/{criterion.max_score}</span></p></div><div className="mt-4 ml-10 h-1.5 overflow-hidden rounded-full bg-[#edf0ed]"><div className="h-full rounded-full bg-[#5b9a79]" style={{ width: `${(criterion.score / criterion.max_score) * 100}%` }} /></div></article>)}</div></div>
                  </div>
                </TabsContent>

                <TabsContent value="extraction" className="m-0" data-testid="extraction-tab-panel">
                  <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
                    <aside className="rounded-2xl border border-[#dce4dd] bg-[#eaf1ec] p-5 sm:p-6" data-testid="extraction-summary"><div className="flex size-10 items-center justify-center rounded-xl bg-[#1e3a2b] text-white"><ScanText size={18} /></div><p className="mt-5 section-kicker text-[#526057]">Extraction summary</p><h3 className="mt-2 font-heading text-xl font-bold text-[#1e3a2b]">Paper turned into editable text</h3><p className="mt-3 text-sm leading-6 text-[#65736a]">Review the transcription against the original document before publishing a final mark.</p><div className="mt-6 space-y-3 border-t border-[#cad8ce] pt-5 text-xs text-[#65736a]"><div className="flex justify-between"><span>Words detected</span><strong className="font-mono text-[#1e3a2b]">{activeAssessment.word_count}</strong></div><div className="flex justify-between"><span>Reading confidence</span><strong className="text-[#1e3a2b]">{activeAssessment.confidence}</strong></div><div className="flex justify-between"><span>Source</span><strong className="text-[#1e3a2b]">{activeAssessment.ai_source}</strong></div></div></aside>
                    <article className="document-paper relative overflow-hidden rounded-2xl border border-[#ddd7cd] bg-[#fffefa] px-6 py-7 shadow-[0_14px_40px_rgba(68,61,49,0.08)] sm:px-10 sm:py-9" data-testid="extracted-document"><div className="absolute left-0 top-0 h-full w-1 bg-[#c86d51]/70" /><div className="flex items-center justify-between border-b border-[#e9e3da] pb-5"><div><p className="font-serif text-lg font-bold text-[#1e3a2b]">Transcribed answer sheet</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a9185]">{activeAssessment.subject} · {activeAssessment.student_name}</p></div><FileText size={22} className="text-[#b5ada1]" /></div><div className="mt-7"><p className="section-kicker text-[#a7543b]">Question</p><p className="mt-3 font-serif text-lg leading-8 text-[#29342d]" data-testid="extracted-question">{activeAssessment.question_text}</p></div><div className="mt-8 border-t border-dashed border-[#dcd5cb] pt-7"><div className="flex items-center justify-between"><p className="section-kicker text-[#35634b]">Student response</p><span className="font-mono text-[10px] text-[#9a9185]">OCR TRANSCRIPT</span></div><p className="paper-lines mt-4 whitespace-pre-wrap pb-2 font-serif text-[17px] leading-8 text-[#36423a]" data-testid="extracted-answer">{activeAssessment.extracted_answer}</p></div></article>
                  </div>
                </TabsContent>

                <TabsContent value="feedback" className="m-0" data-testid="feedback-tab-panel">
                  <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
                    <article className="rounded-2xl border border-[#dfe5df] bg-white p-5 sm:p-7" data-testid="feedback-panel"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-[#edf4ee] text-[#35634b]"><MessageSquareText size={17} /></div><div><p className="section-kicker">Teacher-ready comment</p><p className="mt-1 text-sm font-bold text-[#1e3a2b]">Constructive feedback</p></div></div><blockquote className="mt-6 border-l-2 border-[#c86d51] pl-5 font-serif text-lg leading-8 text-[#3f4d44]" data-testid="teacher-feedback">{activeAssessment.feedback}</blockquote><div className="mt-6 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={async () => { await navigator.clipboard.writeText(activeAssessment.feedback); toast.success("Feedback copied to clipboard"); }} className="border-[#c9dacc] bg-white text-[#35634b] hover:bg-[#edf4ee]" data-testid="copy-feedback-button">Copy feedback</Button><Button type="button" variant="ghost" onClick={() => setActiveAssessment(null)} className="text-[#718077]" data-testid="close-result-button">Close result</Button></div></article>
                    <div className="space-y-4"><article className="rounded-2xl border border-[#cfe0d3] bg-[#eff7f1] p-5" data-testid="strengths-panel"><div className="flex items-center gap-2 text-[#35634b]"><Check size={16} /><p className="text-xs font-bold uppercase tracking-[0.14em]">What worked</p></div><ul className="mt-4 space-y-3 text-sm leading-6 text-[#526057]">{activeAssessment.strengths.map((item) => <li key={item} className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#5b9a79]" />{item}</li>)}</ul></article><article className="rounded-2xl border border-[#eaded6] bg-[#fff8f4] p-5" data-testid="improvement-panel"><div className="flex items-center gap-2 text-[#a7543b]"><Lightbulb size={16} /><p className="text-xs font-bold uppercase tracking-[0.14em]">Improve next</p></div><ul className="mt-4 space-y-3 text-sm leading-6 text-[#526057]">{[...activeAssessment.weaknesses, ...activeAssessment.improvements].map((item) => <li key={item} className="flex gap-3"><ArrowRight size={14} className="mt-1.5 shrink-0 text-[#c86d51]" />{item}</li>)}</ul></article><article className="rounded-2xl border border-[#dfe5df] bg-white p-5" data-testid="short-answer-assessment"><div className="flex items-center gap-2"><MessageSquareText size={15} className="text-[#35634b]" /><p className="section-kicker">Short-answer judgement</p></div><p className="mt-3 text-sm leading-6 text-[#65736a]">{activeAssessment.short_answer_assessment}</p></article></div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
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
      <footer className="mx-auto flex max-w-[1500px] items-center justify-between border-t border-[#e5dfd5] px-5 py-6 text-xs text-[#8a998f] sm:px-8 lg:px-12" data-testid="app-footer"><span className="font-medium"><strong className="text-[#1e3a2b]">Eval<span className="text-[#c86d51]">X</span></strong> · evaluation, explained</span><span className="hidden items-center gap-1 sm:flex">Built for teacher review <ChevronDown size={13} /></span></footer>
    </div>
  );
}