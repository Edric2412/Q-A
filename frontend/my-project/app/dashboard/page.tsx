"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RibbonBackground } from "@/components/RibbonBackground";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getSavedPapers, getEvaluationHistory } from "@/lib/api";
import type { SavedPaper, EvaluationHistoryItem } from "@/lib/api";
import "./dashboard.css";

export default function DashboardPage() {
    const router = useRouter();
    const [recentPapers, setRecentPapers] = useState<SavedPaper[]>([]);
    const [recentEvaluations, setRecentEvaluations] = useState<EvaluationHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
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

        fetchData();
    }, []);

    const handlePaperClick = (paperId: string) => {
        router.push(`/paper/${paperId}`);
    };

    const handleEvaluationClick = (examId: string) => {
        router.push(`/results/${examId}`);
    };

    return (
        <div className="dashboard-container">
            <RibbonBackground variant="combined" />

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
                        <div className="module-icon">📝</div>
                        <h3>Generate New Paper</h3>
                        <p>Create custom papers with AI</p>
                    </a>

                    <a href="/evaluate" className="module-card">
                        <div className="module-icon">✅</div>
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
                                    <div className="empty-state-icon">⏳</div>
                                    <p>Loading...</p>
                                </div>
                            ) : recentPapers.length > 0 ? (
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Subject</th>
                                            <th>Type</th>
                                            <th>Date</th>
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
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon">📄</div>
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
                                    <div className="empty-state-icon">⏳</div>
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
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentEvaluations.map((evaluation) => (
                                            <tr
                                                key={evaluation._id}
                                                onClick={() => handleEvaluationClick(evaluation._id)}
                                            >
                                                <td>
                                                    <div className="font-medium text-white">
                                                        {evaluation.subject || "Unknown Subject"}
                                                    </div>
                                                    <div className="text-xs text-white/50">
                                                        ID: {evaluation._id.substring(0, 8)}
                                                    </div>
                                                </td>
                                                <td>
                                                    {evaluation.batch ? (
                                                        <span className="text-sm text-white/80">{evaluation.batch}</span>
                                                    ) : (
                                                        <span className="text-sm text-white/40 italic">N/A</span>
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
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon">✅</div>
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
