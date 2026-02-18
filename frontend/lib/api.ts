/**
 * API Client for KCLAS Question Paper System
 * Connects to the FastAPI backend (main.py)
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// --- Type Definitions ---
export interface Department {
    value: string;
    label: string;
}

export interface DepartmentDetails {
    department: string;
    batches: string[];
    semesters: string[];
    exams: string[];
    subjects: Record<string, string[]>;
}

export interface Student {
    roll_no: string;
    name: string;
}

export interface Question {
    id: number;
    type: "MCQ" | "Short Answer" | "Long Essay";
    text: string;
    answer: string;
    marks: number;
}

export interface GeneratedPaper {
    MCQ: Question[];
    Short: Question[];
    Long: Question[];
}

export interface EvaluationResult {
    roll_no: string;
    exam_id: string;
    marks: Record<string, number>;
    feedback: Record<string, string>;  // NEW: Q1 -> "Correct", Q11 -> "Rubric feedback..."
    total: number;
    timestamp: string;
}


export interface SavedPaper {
    _id?: string;
    subject: string;
    exam_type: string;
    difficulty: string;
    created_at: string;
    paper?: GeneratedPaper;
}

export interface EvaluationHistoryItem {
    _id: string;
    student_count: number;
    avg_score: number;
    latest_date: string;
    // New metadata fields
    subject?: string;
    batch?: string;
    department?: string;
}

// --- Helper Functions ---
async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    return response.json();
}

// --- Auth API ---
// --- Auth API ---
export async function login(email: string, password: string): Promise<{ message: string; role: string; redirect: string; user_id: string; email: string }> {
    const formData = new URLSearchParams();
    formData.append("email", email);
    formData.append("password", password);

    const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
    });
    return handleResponse(response);
}

export async function getSavedPapers(): Promise<SavedPaper[]> {
    const response = await fetch(`${API_BASE}/saved-papers`);
    return handleResponse<SavedPaper[]>(response);
}

export async function getSavedPaper(paper_id: string): Promise<SavedPaper> {
    const response = await fetch(`${API_BASE}/saved-paper/${paper_id}`);
    return handleResponse<SavedPaper>(response);
}

// ... (existing code)

export async function deletePaper(paperId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/delete-paper/${paperId}`, {
        method: "DELETE",
    });
    return handleResponse(response);
}

export async function deleteEvaluation(examId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/evaluator/delete-evaluation/${examId}`, {
        method: "DELETE",
    });
    return handleResponse(response);
}

// ... (existing code)

// --- Generator API ---
export async function getDepartments(): Promise<Department[]> {
    const response = await fetch(`${API_BASE}/departments`);
    return handleResponse<Department[]>(response);
}

export async function getDetails(department: string): Promise<DepartmentDetails[]> {
    const response = await fetch(`${API_BASE}/details/${encodeURIComponent(department)}`);
    return handleResponse<DepartmentDetails[]>(response);
}

export async function uploadSyllabus(file: File): Promise<{ units: { unit: string; text: string; topics: string[] }[] }> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/upload-syllabus`, {
        method: "POST",
        body: formData,
    });
    return handleResponse(response);
}

export interface GenerateQuestionsPayload {
    selected_units: { unit: string; text: string }[];
    subject: string;
    exam_type: string;
    difficulty: string;
    selected_topics?: string[];
}

export async function generateQuestions(payload: GenerateQuestionsPayload): Promise<{ question_paper: GeneratedPaper }> {
    const response = await fetch(`${API_BASE}/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
}

export interface RegeneratePayload {
    current_question: Question;
    subject: string;
    difficulty: string;
    topics?: string[];
}

export async function regenerateQuestion(payload: RegeneratePayload): Promise<Question> {
    const response = await fetch(`${API_BASE}/regenerate-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
}

export interface DownloadPayload {
    department: string;
    batch: string;
    semester: string;
    subject: string;
    examType: string;
    duration: string;
    paperSetter: string;
    hod: string;
    questions: Question[];
}

export async function downloadPaper(payload: DownloadPayload): Promise<Blob> {
    const response = await fetch(`${API_BASE}/download-paper`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Failed to download paper");
    return response.blob();
}

export async function downloadKey(payload: DownloadPayload): Promise<Blob> {
    const response = await fetch(`${API_BASE}/download-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Failed to download answer key");
    return response.blob();
}

// --- Evaluator API ---
export interface EvaluatorMetadata {
    departments: Department[];
    details: DepartmentDetails[];
}

export async function getEvaluatorMetadata(): Promise<EvaluatorMetadata> {
    const response = await fetch(`${API_BASE}/evaluator/get-metadata`);
    return handleResponse<EvaluatorMetadata>(response);
}

export async function getEvaluationHistory(): Promise<EvaluationHistoryItem[]> {
    const response = await fetch(`${API_BASE}/evaluator/history`);
    return handleResponse<EvaluationHistoryItem[]>(response);
}

export async function getEvaluationResults(examId: string): Promise<EvaluationResult[]> {
    const response = await fetch(`${API_BASE}/evaluator/results/${examId}`);
    return handleResponse<EvaluationResult[]>(response);
}

export interface GetStudentsPayload {
    department: string;
    batch: string;
    semester?: string;
    subject?: string;
    exam_type?: string;
    exam_id?: string;
}

export async function getStudents(payload: GetStudentsPayload): Promise<{ students: Student[]; exam_id: string }> {
    const response = await fetch(`${API_BASE}/evaluator/get-students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
}

export async function uploadEvaluationFiles(formData: FormData): Promise<{ files: { question_paper: string; answer_key: string; student_papers: string[] } }> {
    const response = await fetch(`${API_BASE}/evaluator/upload-files`, {
        method: "POST",
        body: formData,
    });
    return handleResponse(response);
}

export interface EvaluatePayload {
    exam_id: string;
    question_paper_path: string;
    answer_key_path: string;
    student_papers_paths: string[];
    exam_type?: string;
    // New optional metadata
    subject?: string;
    batch?: string;
    department?: string;
    semester?: string;
}

export type StreamEventHandler = (event: { type: "progress"; value: number; message: string } | { type: "complete"; results: EvaluationResult[] } | { type: "error"; message: string }) => void;

export async function evaluate(payload: EvaluatePayload, onEvent: StreamEventHandler): Promise<void> {
    const formData = new FormData();
    formData.append("exam_id", payload.exam_id);
    formData.append("question_paper_path", payload.question_paper_path);
    formData.append("answer_key_path", payload.answer_key_path);
    formData.append("student_papers_paths", JSON.stringify(payload.student_papers_paths));
    if (payload.exam_type) formData.append("exam_type", payload.exam_type);
    if (payload.subject) formData.append("subject", payload.subject);
    if (payload.batch) formData.append("batch", payload.batch);
    if (payload.department) formData.append("department", payload.department);
    if (payload.semester) formData.append("semester", payload.semester);

    const response = await fetch(`${API_BASE}/evaluator/evaluate`, {
        method: "POST",
        body: formData,
    });

    if (!response.body) throw new Error("Streaming not supported");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const data = JSON.parse(line);
                onEvent(data);
            } catch (e) {
                console.warn("Failed to parse stream event:", line);
            }
        }
    }
}

export async function updateMark(examId: string, rollNo: string, questionNum: string, newMark: number): Promise<{ status: string }> {
    const response = await fetch(`${API_BASE}/evaluator/update-marks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exam_id: examId, roll_no: rollNo, question_num: questionNum, new_mark: newMark }),
    });
    return handleResponse(response);
}

export function getExcelExportUrl(examId: string): string {
    return `${API_BASE}/evaluator/export-excel?exam_id=${encodeURIComponent(examId)}`;
}

// --- Learning API ---
export interface StartSessionResponse {
    session_id: string;
    question: any; // Using any for Question type flexibility
    topic_index: number;
    topic_name: string;
    difficulty: string;
    mastery: number[];
    available_topics: string[];
}

export async function startSession(student_id: number, subject: string, exam_id: string): Promise<StartSessionResponse> {
    const response = await fetch(`${API_BASE}/learning/start-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id, subject, exam_id }),
    });
    return handleResponse(response);
}

export interface SubmitAnswerPayload {
    session_id: string;
    student_id: number;
    question: string;
    answer: string;
    topic_index: number;
    topic_name?: string;
    difficulty: string;
}

export interface SubmitAnswerResponse {
    score: number;
    feedback: string;
    mastery_update: number;
    current_mastery_vector: number[];
    next_question: any;
    next_topic_index: number;
    next_topic_name: string;
    next_difficulty: string;
    available_topics?: string[];
}

export async function submitAnswer(payload: SubmitAnswerPayload): Promise<SubmitAnswerResponse> {
    const response = await fetch(`${API_BASE}/learning/submit-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
}

export interface Evaluation {
    _id: string;
    exam_id: string;
    subject: string;
    total: number;
    timestamp: string;
    marks: Record<string, number>;
    feedback: Record<string, string>;
    topics: string[];
    exam_type?: string;
}

export async function getMyEvaluations(student_id: number, email: string): Promise<Evaluation[]> {
    const response = await fetch(`${API_BASE}/learning/my-evaluations/${student_id}?email=${encodeURIComponent(email)}`);
    return handleResponse(response);
}

export async function getEvaluationDetails(exam_id: string, email: string): Promise<Evaluation> {
    const response = await fetch(`${API_BASE}/learning/evaluation-details/${exam_id}?email=${encodeURIComponent(email)}`);
    return handleResponse(response);
}

export interface LearningLog {
    session_id: string;
    topic: string;
    difficulty: string;
    score: number;
    mastery_before: number;
    mastery_after: number;
    timestamp: string;
}

export async function getLearningLogs(student_id: number): Promise<LearningLog[]> {
    const response = await fetch(`${API_BASE}/learning/learning-logs/${student_id}`);
    return handleResponse(response);
}

