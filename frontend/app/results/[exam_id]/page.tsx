"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getEvaluationResults, EvaluationResult, getExcelExportUrl } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import "./results.css";

export default function ViewResultsPage() {
    const params = useParams();
    const exam_id = params?.exam_id as string;
    const [results, setResults] = useState<EvaluationResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [feedbackModal, setFeedbackModal] = useState<EvaluationResult | null>(null);

    useEffect(() => {
        if (!exam_id) return;
        getEvaluationResults(exam_id)
            .then(setResults)
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, [exam_id]);

    if (loading) {
        return (
            <div className="results-page">
                <div className="results-loading">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <p>Loading results...</p>
                </div>
            </div>
        );
    }

    if (results.length === 0) {
        return (
            <div className="results-page">
                <div className="results-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <p>No results found for this exam.</p>
                </div>
            </div>
        );
    }

    const questionKeys = Object.keys(results[0].marks || {}).sort((a, b) => {
        const numA = parseInt(a.replace('Q', ''));
        const numB = parseInt(b.replace('Q', ''));
        return numA - numB;
    });

    const averageScore = results.reduce((acc, curr) => acc + curr.total, 0) / results.length;

    return (
        <div className="results-page">
            {/* Feedback Modal */}
            {feedbackModal && (
                <div className="modal-overlay" onClick={() => setFeedbackModal(null)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-header-info">
                                <h3>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                    Feedback for {feedbackModal.roll_no}
                                </h3>
                                <p>Detailed evaluation report</p>
                            </div>
                            <button className="modal-close-btn" onClick={() => setFeedbackModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="modal-total-banner">
                                <span className="label">Total Score</span>
                                <span className="value">{feedbackModal.total}</span>
                            </div>
                            <div className="feedback-list">
                                {Object.entries(feedbackModal.marks).map(([qKey, mark]) => (
                                    <div key={qKey} className="feedback-item">
                                        <div className="feedback-item-header">
                                            <span className="feedback-q-label">{qKey}</span>
                                            <span className={`feedback-mark ${mark > 0 ? 'positive' : 'zero'}`}>
                                                {mark} marks
                                            </span>
                                        </div>
                                        <p className="feedback-text">
                                            {feedbackModal.feedback?.[qKey] || <span className="no-feedback">No specific feedback provided.</span>}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="results-header">
                <div className="results-header-left">
                    <Link href="/dashboard" className="back-link">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Back to Dashboard
                    </Link>
                </div>
                <div className="results-header-right">
                    <Link href={`/visualizations/${exam_id}`} className="export-excel-btn" style={{ color: "#818cf8", background: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.2)" }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                        Analytics
                    </Link>
                    <a href={getExcelExportUrl(exam_id)} className="export-excel-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                        Export Excel
                    </a>
                    <ThemeToggle />
                </div>
            </header>

            {/* Main Content */}
            <main className="results-main">
                {/* Stats Banner */}
                <div className="results-stats-banner">
                    <div className="results-title">
                        <h1>Evaluation Results</h1>
                    </div>
                    <div className="results-meta">
                        <span className="meta-chip exam-id">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="4" y1="9" x2="20" y2="9" />
                                <line x1="4" y1="15" x2="20" y2="15" />
                                <line x1="10" y1="3" x2="8" y2="21" />
                                <line x1="16" y1="3" x2="14" y2="21" />
                            </svg>
                            Exam ID: {exam_id.substring(0, 8)}...
                        </span>
                        <span className="meta-chip students">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            {results.length} Students
                        </span>
                        <span className="meta-chip avg-score">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="20" x2="18" y2="10" />
                                <line x1="12" y1="20" x2="12" y2="4" />
                                <line x1="6" y1="20" x2="6" y2="14" />
                            </svg>
                            Avg Score: {averageScore.toFixed(1)}
                        </span>
                        <span className="meta-chip date">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            {new Date(results[0].timestamp).toLocaleDateString()}
                        </span>
                    </div>
                </div>

                {/* Table Card */}
                <div className="results-table-card">
                    <div className="results-table-scroll">
                        <table className="results-table">
                            <thead>
                                <tr>
                                    <th>Roll No</th>
                                    {questionKeys.map(key => (
                                        <th key={key} className="text-center">{key}</th>
                                    ))}
                                    <th className="text-right">Total</th>
                                    <th className="text-center sticky-col">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((res, idx) => (
                                    <tr key={idx}>
                                        <td className="roll-cell">{res.roll_no}</td>
                                        {questionKeys.map(key => (
                                            <td key={key} className="text-center">
                                                <span className={`mark-cell ${res.marks[key] === 0 ? 'zero' : ''}`}>
                                                    {res.marks[key]}
                                                </span>
                                            </td>
                                        ))}
                                        <td className="text-right total-cell">{res.total}</td>
                                        <td className="text-center sticky-col">
                                            <button
                                                onClick={() => setFeedbackModal(res)}
                                                className="feedback-btn"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                                </svg>
                                                Feedback
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
