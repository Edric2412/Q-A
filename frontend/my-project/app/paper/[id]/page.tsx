"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSavedPaper, SavedPaper, downloadPaper, downloadKey, DownloadPayload } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import { MathRenderer } from "@/components/MathRenderer";
import "./paper.css";

export default function ViewPaperPage() {
    const params = useParams();
    const id = params?.id as string;
    const [paper, setPaper] = useState<SavedPaper | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        getSavedPaper(id)
            .then(setPaper)
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="paper-view-page">
                <div className="paper-loading">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <p>Loading paper...</p>
                </div>
            </div>
        );
    }

    if (!paper) {
        return (
            <div className="paper-view-page">
                <div className="paper-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <p>Paper not found.</p>
                </div>
            </div>
        );
    }

    const { MCQ, Short, Long } = paper.paper || { MCQ: [], Short: [], Long: [] };

    const getDownloadPayload = (): DownloadPayload => {
        const mcqQuestions = (MCQ || []).map((q, idx) => ({
            id: idx + 1,
            type: "MCQ" as const,
            text: q.text || "",
            answer: q.answer || "",
            marks: q.marks || 1
        }));

        const shortQuestions = (Short || []).map((q, idx) => ({
            id: mcqQuestions.length + idx + 1,
            type: "Short Answer" as const,
            text: q.text || "",
            answer: q.answer || "",
            marks: q.marks || 4
        }));

        const longQuestions = (Long || []).map((q, idx) => ({
            id: mcqQuestions.length + shortQuestions.length + idx + 1,
            type: "Long Essay" as const,
            text: q.text || "",
            answer: q.answer || "",
            marks: q.marks || 10
        }));

        const allQuestions = [...mcqQuestions, ...shortQuestions, ...longQuestions];

        return {
            department: "Computer Science",
            batch: "2023 - 2026",
            semester: "VI",
            subject: paper.subject,
            examType: paper.exam_type,
            duration: "3 Hours",
            paperSetter: "Faculty",
            hod: "HOD",
            questions: allQuestions
        };
    };

    const handleDownload = async (type: 'paper' | 'key') => {
        try {
            const payload = getDownloadPayload();
            const blob = type === 'paper' ? await downloadPaper(payload) : await downloadKey(payload);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${paper.subject}_${type === 'paper' ? 'Question_Paper' : 'Answer_Key'}.docx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (error) {
            console.error("Download failed", error);
            alert("Failed to download. Please try again.");
        }
    };

    return (
        <div className="paper-view-page">
            {/* Header */}
            <header className="paper-view-header">
                <div className="paper-header-left">
                    <Link href="/dashboard" className="paper-back-link">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Back to Dashboard
                    </Link>
                </div>
                <div className="paper-header-right">
                    <button onClick={() => handleDownload('paper')} className="download-btn paper-dl">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span>Download Paper</span>
                    </button>
                    <button onClick={() => handleDownload('key')} className="download-btn key-dl">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                        </svg>
                        <span>Download Key</span>
                    </button>
                    <ThemeToggle />
                </div>
            </header>

            {/* Main Content */}
            <main className="paper-view-main">
                {/* Title Banner */}
                <div className="paper-title-banner">
                    <h1>{paper.subject}</h1>
                    <div className="paper-meta-chips">
                        <span className="paper-chip type-chip">{paper.exam_type}</span>
                        <span className="paper-chip">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            {new Date(paper.created_at).toLocaleDateString()}
                        </span>
                        {paper.difficulty && (
                            <span className="paper-chip">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                                {paper.difficulty}
                            </span>
                        )}
                    </div>
                </div>

                {/* Question Sections */}
                <div className="paper-sections-list">
                    {/* MCQs */}
                    {MCQ && MCQ.length > 0 && (
                        <section className="paper-section-card mcq-section">
                            <h3 className="paper-section-title">Multiple Choice Questions</h3>
                            <div className="question-list">
                                {MCQ.map((q, idx) => (
                                    <div key={idx} className="question-item">
                                        <div className="question-item-header">
                                            <span className="question-number">Q{idx + 1}</span>
                                            <span className="question-marks-label">1 Mark</span>
                                        </div>
                                        <div className="question-text">
                                            <MathRenderer content={q.text} />
                                        </div>
                                        <div className="answer-box mcq-answer">
                                            <div className="answer-label">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                                Answer
                                            </div>
                                            <div className="answer-content">
                                                <MathRenderer content={q.answer} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Short Answer */}
                    {Short && Short.length > 0 && (
                        <section className="paper-section-card short-section">
                            <h3 className="paper-section-title">Short Answer Questions</h3>
                            <div className="question-list">
                                {Short.map((q, idx) => (
                                    <div key={idx} className="question-item">
                                        <div className="question-item-header">
                                            <span className="question-number">Q{MCQ.length + idx + 1}</span>
                                            <span className="question-marks-label">{q.marks} Marks</span>
                                        </div>
                                        <div className="question-text">
                                            <MathRenderer content={q.text} />
                                        </div>
                                        {q.answer && (
                                            <div className="answer-box short-answer">
                                                <div className="answer-label">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                    Answer
                                                </div>
                                                <div className="answer-content">
                                                    <MathRenderer content={q.answer} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Long Essay */}
                    {Long && Long.length > 0 && (
                        <section className="paper-section-card long-section">
                            <h3 className="paper-section-title">Long Essay Questions</h3>
                            <div className="question-list">
                                {Long.map((q, idx) => (
                                    <div key={idx} className="question-item">
                                        <div className="question-item-header">
                                            <span className="question-number">Q{MCQ.length + Short.length + idx + 1}</span>
                                            <span className="question-marks-label">{q.marks} Marks</span>
                                        </div>
                                        <div className="question-text">
                                            <MathRenderer content={q.text} />
                                        </div>
                                        {q.answer && (
                                            <div className="answer-box long-answer">
                                                <div className="answer-label">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                    Answer
                                                </div>
                                                <div className="answer-content">
                                                    <MathRenderer content={q.answer} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </main>
        </div>
    );
}
