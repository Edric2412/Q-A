"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation"; // Correct hook for App Router
import { getSavedPaper, SavedPaper, downloadPaper, downloadKey, DownloadPayload } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import "../../dashboard/dashboard.css"; // Reuse dashboard styles
import { MathRenderer } from "@/components/MathRenderer";


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

    if (loading) return <div className="p-10 text-center text-white">Loading...</div>;
    if (!paper) return <div className="p-10 text-center text-white">Paper not found.</div>;

    const { MCQ, Short, Long } = paper.paper || { MCQ: [], Short: [], Long: [] };

    const getDownloadPayload = (): DownloadPayload => {
        // Construct payload from saved paper data
        // Add type, id, and ensure all required fields are present
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
            department: "Computer Science", // Placeholder or fetch if available
            batch: "2023 - 2026",           // Placeholder
            semester: "VI",                 // Placeholder
            subject: paper.subject,
            examType: paper.exam_type,
            duration: "3 Hours",            // Placeholder
            paperSetter: "Faculty",         // Placeholder
            hod: "HOD",                     // Placeholder
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
        <>
            <div className="paper-page-container">
                <div className="dashboard-container">
                    <header className="dashboard-header" style={{ position: 'relative', zIndex: 100 }}>
                        <div className="header-left">
                            <Link href="/dashboard" className="flex items-center gap-2 text-white/80 hover:text-white transition">
                                <i className="ri-arrow-left-line text-xl"></i>
                                <span>Back to Dashboard</span>
                            </Link>
                        </div>
                        <div className="header-right flex gap-3" style={{ position: 'relative', zIndex: 101 }}>
                            <button
                                onClick={() => handleDownload('paper')}
                                className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition flex items-center gap-2 font-medium cursor-pointer"
                                style={{ position: 'relative', zIndex: 102 }}
                            >
                                <i className="ri-file-download-line"></i> Download Paper
                            </button>
                            <button
                                onClick={() => handleDownload('key')}
                                className="px-4 py-2 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 transition flex items-center gap-2 font-medium cursor-pointer"
                                style={{ position: 'relative', zIndex: 102 }}
                            >
                                <i className="ri-key-2-line"></i> Download Key
                            </button>
                            <ThemeToggle />
                        </div>
                    </header>

                    <main className="dashboard-main !block px-8 py-10"> {/* Removed !items-start !justify-start, used !block for full width flow */}
                        <div className="w-full max-w-7xl mx-auto"> {/* Changed max-w-4xl to max-w-7xl for wider view */}
                            <div className="mb-8 text-center bg-white/5 p-8 rounded-2xl border border-white/10"> {/* Centered header */}
                                <h1 className="text-4xl font-bold text-white mb-4">{paper.subject}</h1>
                                <div className="flex gap-4 text-white/60">
                                    <span className="badge badge-blue">{paper.exam_type}</span>
                                    <span>{new Date(paper.created_at).toLocaleDateString()}</span>
                                    <span>{paper.difficulty}</span>
                                </div>
                            </div>

                            <div className="space-y-16">
                                {/* MCQs */}
                                {MCQ && MCQ.length > 0 && (
                                    <section className="paper-section">
                                        <div className="section-header">
                                            <h3>Multiple Choice Questions</h3>
                                        </div>
                                        <div className="flex flex-col gap-6">
                                            {MCQ.map((q, idx) => (
                                                <div key={idx} className="p-6 bg-white/5 dark:bg-white/5 bg-indigo-50/50 rounded-xl border border-white/10 dark:border-white/10 border-indigo-200/30 hover:bg-white/8 dark:hover:bg-white/8 hover:bg-indigo-100/40 transition-all">
                                                    <div className="flex justify-between mb-3">
                                                        <span className="font-bold text-blue-500 dark:text-blue-400 text-lg">Q{idx + 1}</span>
                                                        <span className="text-sm text-indigo-600/70 dark:text-white/50 font-medium">1 Mark</span>
                                                    </div>
                                                    <div className="text-indigo-900 dark:text-white/90 whitespace-pre-line mb-4 text-base leading-relaxed">
                                                        <MathRenderer content={q.text} />
                                                    </div>
                                                    <div className="mt-3 p-3 bg-green-500/10 dark:bg-green-500/10 bg-green-100/50 border border-green-500/30 dark:border-green-500/30 border-green-400/40 rounded-lg">
                                                        <span className="text-sm text-green-600 dark:text-green-400 font-semibold">
                                                            ✓ Answer: <MathRenderer content={q.answer} />
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Short Answer */}
                                {Short && Short.length > 0 && (
                                    <section className="paper-section">
                                        <div className="section-header">
                                            <h3>Short Answer Questions</h3>
                                        </div>
                                        <div className="flex flex-col gap-6">
                                            {Short.map((q, idx) => (
                                                <div key={idx} className="p-6 bg-white/5 dark:bg-white/5 bg-indigo-50/50 rounded-xl border border-white/10 dark:border-white/10 border-indigo-200/30 hover:bg-white/8 dark:hover:bg-white/8 hover:bg-indigo-100/40 transition-all">
                                                    <div className="flex justify-between mb-3">
                                                        <span className="font-bold text-blue-500 dark:text-blue-400 text-lg">Q{MCQ.length + idx + 1}</span>
                                                        <span className="text-sm text-indigo-600/70 dark:text-white/50 font-medium">{q.marks} Marks</span>
                                                    </div>
                                                    <div className="text-indigo-900 dark:text-white/90 mb-4 text-base leading-relaxed">
                                                        <MathRenderer content={q.text} />
                                                    </div>
                                                    {q.answer && (
                                                        <div className="mt-4 p-4 bg-purple-500/10 dark:bg-purple-500/10 bg-purple-100/50 border border-purple-500/30 dark:border-purple-500/30 border-purple-400/40 rounded-lg">
                                                            <p className="text-sm text-purple-700 dark:text-purple-300 font-semibold mb-2">✓ Answer:</p>
                                                            <div className="text-indigo-800 dark:text-white/80 text-sm leading-relaxed whitespace-pre-line">
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
                                    <section className="paper-section">
                                        <div className="section-header">
                                            <h3>Long Essay Questions</h3>
                                        </div>
                                        <div className="flex flex-col gap-6">
                                            {Long.map((q, idx) => (
                                                <div key={idx} className="p-6 bg-white/5 dark:bg-white/5 bg-indigo-50/50 rounded-xl border border-white/10 dark:border-white/10 border-indigo-200/30 hover:bg-white/8 dark:hover:bg-white/8 hover:bg-indigo-100/40 transition-all">
                                                    <div className="flex justify-between mb-3">
                                                        <span className="font-bold text-blue-500 dark:text-blue-400 text-lg">Q{MCQ.length + Short.length + idx + 1}</span>
                                                        <span className="text-sm text-indigo-600/70 dark:text-white/50 font-medium">{q.marks} Marks</span>
                                                    </div>
                                                    <div className="text-indigo-900 dark:text-white/90 mb-4 text-base leading-relaxed">
                                                        <MathRenderer content={q.text} />
                                                    </div>
                                                    {q.answer && (
                                                        <div className="mt-4 p-4 bg-indigo-500/10 dark:bg-indigo-500/10 bg-indigo-100/50 border border-indigo-500/30 dark:border-indigo-500/30 border-indigo-400/40 rounded-lg">
                                                            <p className="text-sm text-indigo-700 dark:text-indigo-300 font-semibold mb-2">✓ Answer:</p>
                                                            <div className="text-indigo-800 dark:text-white/80 text-sm leading-relaxed whitespace-pre-line">
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
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}

