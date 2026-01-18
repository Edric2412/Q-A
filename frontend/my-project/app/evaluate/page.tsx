"use client";

import { useState, useEffect, ChangeEvent } from "react";
import Link from "next/link";
import {
    getEvaluatorMetadata,
    getStudents,
    uploadEvaluationFiles,
    evaluate,
    getExcelExportUrl,
    updateMark,
    Department,
    DepartmentDetails,
    Student,
    EvaluationResult,
} from "@/lib/api";
import "./evaluate.css";

export default function EvaluatePage() {
    // Metadata state
    const [departments, setDepartments] = useState<Department[]>([]);
    const [allDetails, setAllDetails] = useState<DepartmentDetails[]>([]);
    const [selectedDetails, setSelectedDetails] = useState<DepartmentDetails | null>(null);

    // Form state
    const [department, setDepartment] = useState("");
    const [batch, setBatch] = useState("");
    const [semester, setSemester] = useState("");
    const [subject, setSubject] = useState("");
    const [examType, setExamType] = useState("");

    // Students
    const [students, setStudents] = useState<Student[]>([]);
    const [examId, setExamId] = useState("");

    // Files
    const [questionPaper, setQuestionPaper] = useState<File | null>(null);
    const [answerKey, setAnswerKey] = useState<File | null>(null);
    const [studentPapers, setStudentPapers] = useState<File[]>([]);

    // Uploaded paths (from server)
    const [uploadedPaths, setUploadedPaths] = useState<{
        question_paper: string;
        answer_key: string;
        student_papers: string[];
    } | null>(null);

    // Evaluation state
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState("");
    const [results, setResults] = useState<EvaluationResult[]>([]);

    // UI state
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastType, setToastType] = useState<"success" | "error">("success");
    const [feedbackModal, setFeedbackModal] = useState<EvaluationResult | null>(null);

    // Load metadata on mount
    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const metadata = await getEvaluatorMetadata();
                setDepartments(metadata.departments);
                setAllDetails(metadata.details);
            } catch (error) {
                showToast("Failed to load metadata", "error");
            }
        };
        loadMetadata();
    }, []);

    // Handle department change
    useEffect(() => {
        if (department) {
            const details = allDetails.find((d) => d.department === department);
            setSelectedDetails(details || null);
            setBatch("");
            setSemester("");
            setSubject("");
            setExamType("");
        }
    }, [department, allDetails]);

    // Subjects for semester
    const subjectsForSemester = selectedDetails?.subjects?.[semester] || [];

    const showToast = (message: string, type: "success" | "error") => {
        setToastMessage(message);
        setToastType(type);
        setTimeout(() => setToastMessage(""), 4000);
    };

    // Form validation
    const isFormValid = department && batch && semester && subject && examType;
    const areFilesReady = questionPaper && answerKey && studentPapers.length > 0;

    // Fetch students
    const handleFetchStudents = async () => {
        if (!isFormValid) return;

        setIsLoading(true);
        try {
            const newExamId = crypto.randomUUID();
            const result = await getStudents({
                department,
                batch,
                semester,
                subject,
                exam_type: examType,
                exam_id: newExamId,
            });

            if (!result.students || result.students.length === 0) {
                showToast("No students found for this configuration", "error");
                return;
            }

            setStudents(result.students);
            setExamId(result.exam_id);
            setStep(2);
            showToast(`Found ${result.students.length} students!`, "success");
        } catch (error) {
            showToast("Failed to fetch students", "error");
        } finally {
            setIsLoading(false);
        }
    };

    // File handlers
    const handleFileChange = (
        e: ChangeEvent<HTMLInputElement>,
        type: "qp" | "key" | "papers"
    ) => {
        const files = e.target.files;
        if (!files) return;

        if (type === "qp") setQuestionPaper(files[0]);
        else if (type === "key") setAnswerKey(files[0]);
        else setStudentPapers(Array.from(files));
    };

    // Upload files and start evaluation
    const handleStartEvaluation = async () => {
        if (!areFilesReady || !examId) return;

        setIsEvaluating(true);
        setProgress(0);
        setProgressMessage("Uploading files...");

        try {
            // Upload files
            const formData = new FormData();
            formData.append("exam_id", examId);
            formData.append("question_paper", questionPaper!);
            formData.append("answer_key", answerKey!);
            studentPapers.forEach((file) => formData.append("student_papers", file));

            const uploadResult = await uploadEvaluationFiles(formData);
            setUploadedPaths(uploadResult.files);
            setProgressMessage("Starting AI evaluation...");

            // Start evaluation with streaming
            await evaluate(
                {
                    exam_id: examId,
                    question_paper_path: uploadResult.files.question_paper,
                    answer_key_path: uploadResult.files.answer_key,
                    student_papers_paths: uploadResult.files.student_papers,
                    exam_type: examType,
                },
                (event) => {
                    if (event.type === "progress") {
                        setProgress(event.value);
                        setProgressMessage(event.message);
                    } else if (event.type === "complete") {
                        setResults(event.results);
                        setStep(4);
                        showToast("Evaluation complete!", "success");
                    } else if (event.type === "error") {
                        showToast(event.message, "error");
                    }
                }
            );
        } catch (error) {
            showToast("Evaluation failed", "error");
        } finally {
            setIsEvaluating(false);
        }
    };

    // Export Excel
    const handleExportExcel = () => {
        if (!examId) return;
        window.open(getExcelExportUrl(examId), "_blank");
    };

    return (
        <>
            {/* Toast */}
            {toastMessage && (
                <div className={`toast ${toastType} show`}>
                    <i className={toastType === "success" ? "ri-check-line" : "ri-error-warning-line"}></i>
                    <span>{toastMessage}</span>
                </div>
            )}

            <div className="evaluate-container">
                {/* Header */}
                <header className="evaluate-header">
                    <Link href="/dashboard" className="back-btn">
                        <i className="ri-arrow-left-line"></i>
                    </Link>
                    <div className="header-title">
                        <h1>Answer Evaluator</h1>
                        <p>AI-powered answer sheet grading</p>
                    </div>
                </header>

                {/* Step Indicator */}
                <div className="step-indicator">
                    <div className={`step ${step >= 1 ? "active" : ""}`}>
                        <span className="step-num">1</span>
                        <span className="step-label">Configuration</span>
                    </div>
                    <div className="step-line"></div>
                    <div className={`step ${step >= 2 ? "active" : ""}`}>
                        <span className="step-num">2</span>
                        <span className="step-label">Students</span>
                    </div>
                    <div className="step-line"></div>
                    <div className={`step ${step >= 3 ? "active" : ""}`}>
                        <span className="step-num">3</span>
                        <span className="step-label">Upload</span>
                    </div>
                    <div className="step-line"></div>
                    <div className={`step ${step >= 4 ? "active" : ""}`}>
                        <span className="step-num">4</span>
                        <span className="step-label">Results</span>
                    </div>
                </div>

                {/* Step 1: Configuration */}
                <section className="section">
                    <h2 className="section-title">
                        <i className="ri-settings-3-line"></i>
                        Exam Configuration
                    </h2>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Department</label>
                            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                                <option value="">Select Department</option>
                                {departments.map((d) => (
                                    <option key={d.value} value={d.label}>{d.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Batch</label>
                            <select value={batch} onChange={(e) => setBatch(e.target.value)} disabled={!selectedDetails}>
                                <option value="">Select Batch</option>
                                {selectedDetails?.batches?.map((b) => (
                                    <option key={b} value={b}>{b}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Semester</label>
                            <select value={semester} onChange={(e) => { setSemester(e.target.value); setSubject(""); }} disabled={!selectedDetails}>
                                <option value="">Select Semester</option>
                                {selectedDetails?.semesters?.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Subject</label>
                            <select value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!semester}>
                                <option value="">Select Subject</option>
                                {subjectsForSemester.map((sub) => (
                                    <option key={sub} value={sub}>{sub}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Exam Type</label>
                            <select value={examType} onChange={(e) => setExamType(e.target.value)} disabled={!selectedDetails}>
                                <option value="">Select Exam Type</option>
                                {selectedDetails?.exams?.map((exam) => (
                                    <option key={exam} value={exam}>{exam}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="action-row">
                        <button className="primary-btn" onClick={handleFetchStudents} disabled={!isFormValid || isLoading}>
                            {isLoading ? "Loading..." : "Fetch Students"}
                            <i className="ri-arrow-right-line"></i>
                        </button>
                    </div>
                </section>

                {/* Step 2: Student List */}
                {step >= 2 && (
                    <section className="section">
                        <h2 className="section-title">
                            <i className="ri-team-line"></i>
                            Student List ({students.length})
                        </h2>
                        <div className="student-table-wrapper">
                            <table className="student-table">
                                <thead>
                                    <tr>
                                        <th>Roll No</th>
                                        <th>Name</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map((s, idx) => (
                                        <tr key={idx}>
                                            <td>{s.roll_no}</td>
                                            <td>{s.name}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="action-row">
                            <button className="primary-btn" onClick={() => setStep(3)}>
                                Proceed to Upload
                                <i className="ri-arrow-right-line"></i>
                            </button>
                        </div>
                    </section>
                )}

                {/* Step 3: File Upload */}
                {step >= 3 && (
                    <section className="section">
                        <h2 className="section-title">
                            <i className="ri-upload-cloud-2-line"></i>
                            Upload Files
                        </h2>
                        <div className="upload-grid">
                            <div className="upload-card">
                                <label className="upload-label">
                                    <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleFileChange(e, "qp")} hidden />
                                    <i className="ri-file-text-line"></i>
                                    <span>{questionPaper ? questionPaper.name : "Question Paper"}</span>
                                </label>
                            </div>
                            <div className="upload-card">
                                <label className="upload-label">
                                    <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleFileChange(e, "key")} hidden />
                                    <i className="ri-key-line"></i>
                                    <span>{answerKey ? answerKey.name : "Answer Key"}</span>
                                </label>
                            </div>
                            <div className="upload-card wide">
                                <label className="upload-label">
                                    <input type="file" accept=".pdf,.doc,.docx" multiple onChange={(e) => handleFileChange(e, "papers")} hidden />
                                    <i className="ri-file-copy-2-line"></i>
                                    <span>{studentPapers.length > 0 ? `${studentPapers.length} student papers` : "Student Papers (Multiple)"}</span>
                                </label>
                            </div>
                        </div>

                        {/* Progress Display */}
                        {isEvaluating && (
                            <div className="progress-section">
                                <div className="progress-ring-container">
                                    <svg className="progress-ring" viewBox="0 0 120 120">
                                        <circle className="progress-ring-bg" cx="60" cy="60" r="52" />
                                        <circle
                                            className="progress-ring-fill"
                                            cx="60"
                                            cy="60"
                                            r="52"
                                            style={{ strokeDashoffset: 326.7 - (326.7 * progress) / 100 }}
                                        />
                                    </svg>
                                    <div className="progress-text">{Math.round(progress)}%</div>
                                </div>
                                <p className="progress-message">{progressMessage}</p>
                            </div>
                        )}

                        <div className="action-row">
                            <button
                                className="primary-btn"
                                onClick={handleStartEvaluation}
                                disabled={!areFilesReady || isEvaluating}
                            >
                                {isEvaluating ? "Evaluating..." : "Start Evaluation"}
                                <i className="ri-play-line"></i>
                            </button>
                        </div>
                    </section>
                )}

                {/* Step 4: Results */}
                {step >= 4 && results.length > 0 && (
                    <section className="section">
                        <h2 className="section-title">
                            <i className="ri-bar-chart-box-line"></i>
                            Evaluation Results
                        </h2>
                        <div className="results-table-wrapper">
                            <table className="results-table">
                                <thead>
                                    <tr>
                                        <th>Roll No</th>
                                        {Object.keys(results[0]?.marks || {}).map((key) => (
                                            <th key={key}>{key}</th>
                                        ))}
                                        <th>Total</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((r, idx) => (
                                        <tr key={idx}>
                                            <td>{r.roll_no}</td>
                                            {Object.values(r.marks).map((mark, mIdx) => (
                                                <td key={mIdx}>{mark}</td>
                                            ))}
                                            <td className="total-cell">{r.total}</td>
                                            <td>
                                                <button
                                                    className="view-feedback-btn"
                                                    onClick={() => setFeedbackModal(r)}
                                                >
                                                    <i className="ri-message-2-line"></i>
                                                    Feedback
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="action-row">
                            <button className="export-btn" onClick={handleExportExcel}>
                                <i className="ri-file-excel-2-line"></i>
                                Export to Excel
                            </button>
                        </div>
                    </section>
                )}

                {/* Feedback Modal */}
                {feedbackModal && (
                    <div className="modal-overlay" onClick={() => setFeedbackModal(null)}>
                        <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>
                                    <i className="ri-message-2-line"></i>
                                    Feedback for {feedbackModal.roll_no}
                                </h3>
                                <button className="modal-close" onClick={() => setFeedbackModal(null)}>
                                    <i className="ri-close-line"></i>
                                </button>
                            </div>
                            <div className="modal-body">
                                <div className="feedback-summary">
                                    <span className="summary-label">Total Score:</span>
                                    <span className="summary-value">{feedbackModal.total}</span>
                                </div>
                                <div className="feedback-list">
                                    {Object.entries(feedbackModal.marks).map(([qKey, mark]) => (
                                        <div key={qKey} className="feedback-item">
                                            <div className="feedback-question-header">
                                                <span className="question-label">{qKey}</span>
                                                <span className={`question-mark ${mark > 0 ? 'positive' : 'zero'}`}>
                                                    {mark} marks
                                                </span>
                                            </div>
                                            <p className="feedback-text">
                                                {feedbackModal.feedback?.[qKey] || "No feedback available"}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
