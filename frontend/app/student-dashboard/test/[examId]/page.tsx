"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getEvaluationDetails, Evaluation } from "@/lib/api";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
    ArrowLeft, BrainCircuit, CheckCircle,
    AlertCircle, Sparkles
} from "lucide-react";
import "./exam-details.css";

export default function TestDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const examId = params.examId as string;

    const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const storedEmail = localStorage.getItem("user_email");
        const storedUserId = localStorage.getItem("user_id");

        if (!storedUserId || !storedEmail) {
            router.push("/");
            return;
        }

        fetchDetails(examId, storedEmail);
    }, [examId, router]);

    const fetchDetails = async (id: string, email: string) => {
        try {
            const data = await getEvaluationDetails(id, email);
            setEvaluation(data);
        } catch (e: any) {
            setError(e.message || "Failed to load test details");
        } finally {
            setLoading(false);
        }
    };

    const handleStartLearning = () => {
        if (!evaluation) return;
        const subject = encodeURIComponent(evaluation.subject);
        const id = encodeURIComponent(evaluation.exam_id);
        router.push(`/learning?examId=${id}&subject=${subject}`);
    };

    if (loading) {
        return (
            <div className="exam-details-container flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-[var(--ed-primary)] rounded-full border-t-transparent animate-spin"></div>
            </div>
        );
    }

    if (error || !evaluation) {
        return (
            <div className="exam-details-container flex items-center justify-center">
                <div className="glass-card p-12 max-w-md text-center bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl">
                    <div className="text-red-500 mb-4 flex justify-center">
                        <AlertCircle size={48} />
                    </div>
                    <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
                    <p className="text-[var(--ed-text-muted)] mb-6">{error || "Test not found"}</p>
                    <button
                        onClick={() => router.back()}
                        className="px-6 py-2 rounded-xl bg-[var(--ed-glass-bg)] hover:bg-[var(--ed-glass-border)] transition-colors font-medium border border-[var(--ed-glass-border)]"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="exam-details-container">

            {/* Dynamic Background */}
            <div className="ed-orbs">
                <div className="ed-orb ed-orb-1"></div>
                <div className="ed-orb ed-orb-2"></div>
            </div>

            {/* Navbar */}
            <nav className="ed-navbar">
                <div className="ed-nav-content">
                    <button
                        onClick={() => router.push("/student-dashboard")}
                        className="nav-back-btn group"
                    >
                        <div className="back-icon-box">
                            <ArrowLeft size={18} />
                        </div>
                        <span className="hidden sm:block">Back to Dashboard</span>
                    </button>

                    <ThemeToggle />
                </div>
            </nav>

            <main className="ed-main">

                {/* Header Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="header-card"
                >
                    <div className="header-glow"></div>

                    <div className="header-content">
                        <div>
                            <span className="exam-tag">
                                Exam Results
                            </span>
                            <h1 className="exam-title">
                                {evaluation.subject}
                            </h1>
                            <div className="exam-meta">
                                <span>Exam ID: <span className="font-mono">{evaluation.exam_id.substring(0, 8)}...</span></span>
                                <span className="meta-divider"></span>
                                <span>{new Date(evaluation.timestamp).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div className="score-display">
                            <div className="score-val">
                                {evaluation.total}
                            </div>
                            <div className="score-label">
                                Total Marks
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Adaptive Practice Call-to-Action */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="ai-recommendation"
                >
                    <div className="ai-card-content">
                        <div className="ai-icon-bg">
                            <BrainCircuit />
                        </div>

                        <div className="ai-text">
                            <h3>
                                <Sparkles className="text-yellow-400 fill-yellow-400" size={20} />
                                <span>Boost Your Scores!</span>
                            </h3>
                            <p>
                                Our AI has analyzed your performance in this test. Start an adaptive practice session to reinforce weak topics and master the concepts.
                            </p>
                        </div>

                        <button onClick={handleStartLearning} className="ai-btn">
                            <span>Start Adaptive AI</span>
                            <ArrowLeft className="rotate-180" size={16} />
                        </button>
                    </div>
                </motion.div>

                {/* Detailed Breakdown */}
                <div className="results-section">
                    <h3>Question Breakdown</h3>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="results-table-container"
                    >
                        <div className="overflow-x-auto">
                            <table className="results-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '80px' }}>Q. No</th>
                                        <th style={{ width: '120px' }}>Mark Scored</th>
                                        <th style={{ width: '120px' }}>Max Marks</th>
                                        <th>Feedback</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(evaluation.marks).map(([qKey, mark], index) => {
                                        const qNum = parseInt(qKey.replace(/\D/g, ''));

                                        // Max Marks Logic based on Exam Type
                                        let maxMarks = "--";
                                        const type = evaluation.exam_type || (evaluation.subject.toUpperCase().includes("CIA") ? "CIA" : (evaluation.subject.toUpperCase().includes("MODEL") ? "Model" : ""));

                                        if (type === "CIA") {
                                            if (qNum >= 1 && qNum <= 10) maxMarks = "1";
                                            else if (qNum >= 11 && qNum <= 15) maxMarks = "4";
                                            else if (qNum >= 16 && qNum <= 17) maxMarks = "10";
                                        } else if (type === "Model") {
                                            if (qNum >= 1 && qNum <= 10) maxMarks = "1";
                                            else if (qNum >= 11 && qNum <= 15) maxMarks = "5";
                                            else if (qNum >= 16 && qNum <= 20) maxMarks = "8";
                                        }

                                        return (
                                            <tr key={qKey}>
                                                <td>
                                                    <div className="q-badge">
                                                        {qNum}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="score-text">{mark}</span>
                                                </td>
                                                <td>
                                                    <span className="text-[var(--ed-text-muted)]">{maxMarks}</span>
                                                </td>
                                                <td>
                                                    {evaluation.feedback && evaluation.feedback[qKey] ? (
                                                        <div className="feedback-text">
                                                            "{evaluation.feedback[qKey]}"
                                                        </div>
                                                    ) : (
                                                        <span className="no-feedback">No feedback provided</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                </div>

            </main>
        </div>
    );
}
