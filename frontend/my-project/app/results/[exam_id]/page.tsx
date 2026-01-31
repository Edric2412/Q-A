"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getEvaluationResults, EvaluationResult, getExcelExportUrl } from "@/lib/api";
import { RibbonBackground } from "@/components/RibbonBackground";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import "../../dashboard/dashboard.css";

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

    if (loading) return <div className="p-10 text-center text-white">Loading...</div>;
    if (results.length === 0) return <div className="p-10 text-center text-white">No results found for this exam.</div>;

    // Extract questions dynamically from the marks of the first student
    const questionKeys = Object.keys(results[0].marks || {}).sort((a, b) => {
        const numA = parseInt(a.replace('Q', ''));
        const numB = parseInt(b.replace('Q', ''));
        return numA - numB;
    });

    const averageScore = results.reduce((acc, curr) => acc + curr.total, 0) / results.length;

    return (
        <>
            <RibbonBackground variant="combined" />

            {/* Feedback Modal Overlay */}
            {feedbackModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setFeedbackModal(null)}>
                    <div
                        className="bg-gray-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div>
                                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                                    <i className="ri-message-2-line text-blue-400"></i>
                                    Feedback for {feedbackModal.roll_no}
                                </h3>
                                <p className="text-sm text-white/50 mt-1">Detailed evaluation report</p>
                            </div>
                            <button
                                onClick={() => setFeedbackModal(null)}
                                className="text-white/40 hover:text-white transition p-2 rounded-lg hover:bg-white/10"
                            >
                                <i className="ri-close-line text-xl"></i>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <div className="flex justify-between items-center mb-6 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                <span className="text-blue-200 font-medium">Total Score</span>
                                <span className="text-2xl font-bold text-blue-400">{feedbackModal.total}</span>
                            </div>

                            <div className="space-y-4">
                                {Object.entries(feedbackModal.marks).map(([qKey, mark]) => (
                                    <div key={qKey} className="bg-white/5 rounded-lg p-4 border border-white/5 hover:border-white/10 transition">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-semibold text-white/90 bg-white/10 px-2 py-0.5 rounded text-sm">{qKey}</span>
                                            <span className={`text-sm font-bold px-2 py-0.5 rounded ${mark > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {mark} marks
                                            </span>
                                        </div>
                                        <p className="text-white/70 text-sm leading-relaxed">
                                            {feedbackModal.feedback?.[qKey] || <span className="italic opacity-50">No specific feedback provided.</span>}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="dashboard-container">
                <header className="dashboard-header">
                    <div className="header-left">
                        <Link href="/dashboard" className="flex items-center gap-2 text-white/80 hover:text-white transition">
                            <i className="ri-arrow-left-line text-xl"></i>
                            <span>Back to Dashboard</span>
                        </Link>
                    </div>
                    <div className="header-right">
                        <a href={getExcelExportUrl(exam_id)} className="logout-btn !bg-green-500/10 !text-green-400 !border-green-500/20 hover:!bg-green-500/20">
                            <i className="ri-file-excel-2-line"></i>
                            <span>Export Excel</span>
                        </a>
                        <ThemeToggle />
                    </div>
                </header>

                <main className="dashboard-main !block px-8 py-10">
                    <div className="w-full max-w-[95%] mx-auto">
                        <div className="mb-8 flex justify-between items-end bg-white/5 p-6 rounded-2xl border border-white/10">
                            <div>
                                <h1 className="text-3xl font-bold text-white mb-2">Evaluation Results</h1>
                                <div className="flex gap-6 text-white/60 text-sm">
                                    <div className="flex items-center gap-2">
                                        <i className="ri-hashtag text-blue-400"></i>
                                        <span>Exam ID: {exam_id.substring(0, 8)}...</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <i className="ri-group-line text-purple-400"></i>
                                        <span>{results.length} Students</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <i className="ri-bar-chart-line text-emerald-400"></i>
                                        <span>Avg Score: {averageScore.toFixed(1)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <i className="ri-calendar-line text-orange-400"></i>
                                        <span>{new Date(results[0].timestamp).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <section className="dashboard-section overflow-hidden border border-white/10 rounded-xl bg-gray-900/50 backdrop-blur-sm">
                            <div className="table-container max-h-[70vh] overflow-y-auto custom-scrollbar">
                                <table className="activity-table w-full">
                                    <thead className="sticky top-0 bg-gray-900/95 backdrop-blur z-20 shadow-lg">
                                        <tr>
                                            <th className="py-4 px-6 text-left text-xs font-semibold text-white/50 uppercase tracking-wider">Roll No</th>
                                            {questionKeys.map(key => (
                                                <th key={key} className="py-4 px-2 text-center text-xs font-semibold text-white/50 uppercase tracking-wider w-16">{key}</th>
                                            ))}
                                            <th className="py-4 px-6 text-right text-xs font-semibold text-white/50 uppercase tracking-wider">Total</th>
                                            <th className="py-4 px-6 text-center text-xs font-semibold text-white/50 uppercase tracking-wider sticky right-0 bg-gray-900/95 z-20 shadow-[-10px_0_20px_-10px_rgba(0,0,0,0.5)]">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {results.map((res, idx) => (
                                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                <td className="py-4 px-6 font-medium text-white/90 sticky left-0 bg-gray-900/95 md:bg-transparent z-10 border-r border-white/5 md:border-none">
                                                    {res.roll_no}
                                                </td>
                                                {questionKeys.map(key => (
                                                    <td key={key} className="py-4 px-2 text-center text-white/70">
                                                        <span className={`inline-block px-2 py-1 rounded text-xs ${res.marks[key] > 0 ? 'bg-white/5' : 'text-white/30'}`}>
                                                            {res.marks[key]}
                                                        </span>
                                                    </td>
                                                ))}
                                                <td className="py-4 px-6 text-right font-bold text-blue-400">{res.total}</td>
                                                <td className="py-4 px-6 text-center sticky right-0 bg-gray-900/95 md:bg-transparent z-10 border-l border-white/5 md:border-none shadow-[-10px_0_20px_-10px_rgba(0,0,0,0.5)] md:shadow-none">
                                                    <button
                                                        onClick={() => setFeedbackModal(res)}
                                                        className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-medium rounded-lg transition border border-blue-500/20 flex items-center gap-1.5 mx-auto"
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
                        </section>
                    </div>
                </main>
            </div>
        </>
    );
}
