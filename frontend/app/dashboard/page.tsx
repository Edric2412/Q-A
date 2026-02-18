"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ThemeToggle } from "@/components/ThemeToggle";
import { getSavedPapers, getEvaluationHistory, deletePaper, deleteEvaluation } from "@/lib/api";
import type { SavedPaper, EvaluationHistoryItem } from "@/lib/api";
import "./dashboard.css";

export default function DashboardPage() {
    const router = useRouter();
    const [recentPapers, setRecentPapers] = useState<SavedPaper[]>([]);
    const [recentEvaluations, setRecentEvaluations] = useState<EvaluationHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // RBAC Check
        const role = localStorage.getItem("user_role");
        const userId = localStorage.getItem("user_id");

        if (!userId) {
            router.push("/");
            return;
        }

        if (role === "student") {
            router.push("/student-dashboard");
            return;
        }

        fetchData();
    }, [router]);

    const fetchData = async () => {
        try {
            const [papers, evaluations] = await Promise.all([
                getSavedPapers(),
                getEvaluationHistory(),
            ]);
            setRecentPapers(papers.slice(0, 5));
            setRecentEvaluations(evaluations.slice(0, 5));
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePaperClick = (paperId: string) => {
        router.push(`/paper/${paperId}`);
    };

    const handleEvaluationClick = (examId: string) => {
        router.push(`/results/${examId}`);
    };

    const handleDeletePaper = async (e: React.MouseEvent, paperId: string) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this question paper?")) return;

        try {
            await deletePaper(paperId);
            fetchData(); // Refresh list
        } catch (error) {
            alert("Failed to delete paper");
            console.error(error);
        }
    };

    const handleDeleteEvaluation = async (e: React.MouseEvent, examId: string) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this evaluation history?")) return;

        try {
            await deleteEvaluation(examId);
            fetchData(); // Refresh list
        } catch (error) {
            alert("Failed to delete evaluation");
            console.error(error);
        }
    };

    return (
        <div className="dashboard-container">

            <header className="dashboard-header">
                <div className="header-content">
                    <div className="dashboard-logo">
                        <div className="logo-icon">K</div>
                        <div>
                            <h1>KCLAS</h1>
                            <p>Question Paper System</p>
                        </div>
                    </div>
                    <ThemeToggle />
                </div>
            </header>

            <main className="dashboard-main">
                {/* Hero Section */}
                <div className="hero-section">
                    <h2>What would you like to do today?</h2>
                    <p>Generate new papers or evaluate existing submissions</p>
                </div>

                {/* Action Cards */}
                <div className="action-cards">
                    <a href="/generator" className="module-card">
                        <div className="module-icon">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-primary)', opacity: 0.85 }}>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <polyline points="10 9 9 9 8 9" />
                            </svg>
                        </div>
                        <h3>Generate New Paper</h3>
                        <p>Create custom papers with AI</p>
                    </a>

                    <a href="/evaluate" className="module-card">
                        <div className="module-icon">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-primary)', opacity: 0.85 }}>
                                <path d="M9 11l3 3L22 4" />
                                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                            </svg>
                        </div>
                        <h3>Evaluate Answers</h3>
                        <p>Auto-grade student submissions</p>
                    </a>
                </div>

                {/* Tables Section */}
                <div className="tables-section">
                    {/* Recent Question Papers */}
                    <div className="dashboard-section">
                        <div className="section-header">
                            <h3>Recent Question Papers</h3>
                        </div>
                        <div className="table-container">
                            {isLoading ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon">
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10" />
                                            <polyline points="12 6 12 12 16 14" />
                                        </svg>
                                    </div>
                                    <p>Loading...</p>
                                </div>
                            ) : recentPapers.length > 0 ? (
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Subject</th>
                                            <th>Type</th>
                                            <th>Date</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentPapers.map((paper) => (
                                            <tr
                                                key={paper._id}
                                                onClick={() => handlePaperClick(paper._id || '')}
                                            >
                                                <td>{paper.subject}</td>
                                                <td>
                                                    <span className="badge">
                                                        {paper.exam_type}
                                                    </span>
                                                </td>
                                                <td>{new Date(paper.created_at).toLocaleDateString()}</td>
                                                <td>
                                                    <button
                                                        className="delete-btn"
                                                        onClick={(e) => handleDeletePaper(e, paper._id || '')}
                                                        title="Delete Paper"
                                                    >
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        </svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon">
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                        </svg>
                                    </div>
                                    <p>No question papers yet</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Evaluations */}
                    <div className="dashboard-section">
                        <div className="section-header">
                            <h3>Recent Evaluations</h3>
                        </div>
                        <div className="table-container">
                            {isLoading ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon">
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10" />
                                            <polyline points="12 6 12 12 16 14" />
                                        </svg>
                                    </div>
                                    <p>Loading...</p>
                                </div>
                            ) : recentEvaluations.length > 0 ? (
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Subject / Exam</th>
                                            <th>Batch</th>
                                            <th>Students</th>
                                            <th>Avg Score</th>
                                            <th>Date</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentEvaluations.map((evaluation) => (
                                            <tr
                                                key={evaluation._id}
                                                onClick={() => handleEvaluationClick(evaluation._id)}
                                            >
                                                <td>
                                                    <div className="cell-primary">
                                                        {evaluation.subject || "Unknown Subject"}
                                                    </div>
                                                    <div className="cell-secondary">
                                                        ID: {evaluation._id.substring(0, 8)}
                                                    </div>
                                                </td>
                                                <td>
                                                    {evaluation.batch ? (
                                                        <span className="cell-batch">{evaluation.batch}</span>
                                                    ) : (
                                                        <span className="cell-na">N/A</span>
                                                    )}
                                                </td>
                                                <td>{evaluation.student_count}</td>
                                                <td>
                                                    <span className="score-badge">
                                                        {evaluation.avg_score.toFixed(1)}
                                                    </span>
                                                </td>
                                                <td>
                                                    {new Date(evaluation.latest_date).toLocaleDateString()}
                                                </td>
                                                <td>
                                                    <button
                                                        className="delete-btn"
                                                        onClick={(e) => handleDeleteEvaluation(e, evaluation._id)}
                                                        title="Delete Evaluation"
                                                    >
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        </svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon">
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M9 11l3 3L22 4" />
                                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                                        </svg>
                                    </div>
                                    <p>No evaluations yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
