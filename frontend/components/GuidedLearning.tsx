"use client";

import { useState, useRef } from "react";
import {
    Question,
    submitAnswer,
    StartSessionResponse
} from "@/lib/api";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Send, CheckCircle, AlertTriangle, BookOpen, Clock, BarChart2, RefreshCw } from "lucide-react";

interface GuidedLearningProps {
    initialState: StartSessionResponse;
    studentId: number;
}

export default function GuidedLearning({ initialState, studentId }: GuidedLearningProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // State
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(initialState.question || null);
    const [topicName, setTopicName] = useState(initialState.topic_name);
    const [difficulty, setDifficulty] = useState(initialState.difficulty);
    const [sessionId, setSessionId] = useState(initialState.session_id);
    const [topicIndex, setTopicIndex] = useState(initialState.topic_index);
    const [mastery, setMastery] = useState<number[]>(initialState.mastery);
    const [availableTopics, setAvailableTopics] = useState<string[]>(initialState.available_topics || []);

    // User Input
    const [answer, setAnswer] = useState("");
    const [feedback, setFeedback] = useState<string | null>(null);
    const [score, setScore] = useState<number | null>(null);
    const [nextData, setNextData] = useState<any>(null); // Store next question data

    // UI State
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = async () => {
        if (!answer.trim()) return;
        setSubmitting(true);
        setFeedback(null);
        setScore(null);

        try {
            const response = await submitAnswer({
                session_id: sessionId,
                student_id: studentId,
                question: currentQuestion?.text || "",
                answer: answer,
                topic_index: topicIndex,
                topic_name: topicName,
                difficulty: difficulty,
                rubric: currentQuestion?.answer
            });

            setScore(response.score);
            setFeedback(response.feedback);
            setMastery(response.current_mastery_vector);
            if (response.available_topics && response.available_topics.length > 0) {
                setAvailableTopics(response.available_topics);
            }
            // Store the next question data to be used when the user clicks 'Next'
            setNextData(response);
            setSubmitting(false);

        } catch (error) {
            console.error(error);
            setSubmitting(false);
        }
    };

    const handleNext = () => {
        if (!nextData) return;

        setAnswer("");
        setFeedback(null);
        setScore(null);
        setCurrentQuestion(nextData.next_question);
        setTopicIndex(nextData.next_topic_index);
        setTopicName(nextData.next_topic_name);
        setDifficulty(nextData.next_difficulty);
        setNextData(null);

        setTimeout(() => {
            textareaRef.current?.focus();
        }, 100);
    };

    return (
        <div className="app-window">

            {/* --- SIDEBAR (LEFT) --- */}
            <div className="app-sidebar">
                <div className="sidebar-content custom-scrollbar">
                    <div className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2 opacity-60">
                        <BarChart2 size={12} /> Mastery Zones
                    </div>
                    <div className="space-y-4 mb-8">
                        {["Foundational", "Core Concepts", "Advanced"].map((zone, idx) => {
                            const m = mastery[idx] || 0.5;
                            return (
                                <div key={idx} className="topic-item inactive">
                                    <div className="topic-label">
                                        <span className="text-[11px] font-medium opacity-80 uppercase tracking-tight">
                                            {zone}
                                        </span>
                                    </div>
                                    <div className="progress-track">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${m * 100}%` }}
                                            className={`progress-bar ${m < 0.4 ? "progress-low" :
                                                m < 0.7 ? "progress-med" : "progress-high"
                                                }`}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2 opacity-60">
                        <BookOpen size={12} /> Current Focus
                    </div>
                    <div className="topic-item active">
                        <div className="topic-label">
                            <span className="font-semibold text-sm truncate">
                                {topicName}
                            </span>
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                        </div>
                        <div className="text-[10px] opacity-50 mt-1">
                            Topic {topicIndex + 1} of {availableTopics.length}
                        </div>
                    </div>
                </div>

                <div className="sidebar-status-bar">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-lg">
                            <BookOpen size={18} />
                        </div>
                        <div>
                            <div className="text-xs font-bold uppercase">Session Active</div>
                            <div className="text-[10px] opacity-60">AI Tutor Connected</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- MAIN CONTENT (RIGHT) --- */}
            <div className="app-content">

                {/* Header Bar */}
                <div className="content-header">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium opacity-60">Topic:</span>
                        <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sm font-semibold shadow-sm backdrop-blur-md">
                            {topicName}
                        </span>
                    </div>
                    <div className={`difficulty-badge ${difficulty.toLowerCase()}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {difficulty}
                    </div>
                </div>

                {/* Scrollable Question Area */}
                <div className="question-area custom-scrollbar">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentQuestion?.text}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4 }}
                            className="max-w-3xl mx-auto space-y-8"
                        >
                            <div className="prose prose-lg dark:prose-invert max-w-none font-serif md:font-sans leading-loose tracking-wide">
                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {currentQuestion?.text || ""}
                                </ReactMarkdown>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Floating Input Area */}
                <div className="input-dock">
                    <div className="input-container">
                        <textarea
                            ref={textareaRef}
                            className="chat-textarea"
                            placeholder="Type your answer explanation..."
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            disabled={submitting || !!feedback}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                            }}
                        />
                        <div className="flex justify-between items-center px-4 pb-2">
                            <span className="text-[10px] font-medium opacity-40 uppercase tracking-wider">Markdown supported</span>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || !answer.trim() || !!feedback}
                                className="send-btn"
                            >
                                {submitting ? (
                                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Send size={20} />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Feedback Modal / Overlay (Apple Sheet Style) */}
                <AnimatePresence>
                    {feedback && (
                        <div className="feedback-overlay">
                            <motion.div
                                initial={{ y: "100%", opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: "100%", opacity: 0 }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className="feedback-sheet"
                            >
                                <div className={`feedback-glow ${score && score >= 0.6 ? "bg-emerald-500/30" : "bg-amber-500/30"}`} />

                                <div className="feedback-content">
                                    <div className="status-icon-circle">
                                        {score && score >= 0.6 ? (
                                            <CheckCircle size={40} className="text-emerald-500" />
                                        ) : (
                                            <AlertTriangle size={40} className="text-amber-500" />
                                        )}
                                    </div>

                                    <h3 className="text-3xl font-bold mb-2 tracking-tight">
                                        {score && score >= 0.9 ? "Outstanding!" :
                                            score && score >= 0.6 ? "Good Job!" : "Keep Practicing"}
                                    </h3>

                                    {score !== null && (
                                        <div className="score-badge-container">
                                            <div className="score-badge">
                                                <span className="score-label">Final Evaluation</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="score-value-large">{Math.round(score * 10)}</span>
                                                    <span className="score-total-label">/ 10</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="markdown-content feedback-mark custom-scrollbar">
                                        <div className="prose prose-invert max-w-none text-left">
                                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                {feedback || ""}
                                            </ReactMarkdown>
                                        </div>
                                    </div>

                                    <div className="mt-10 flex flex-col items-center gap-5">
                                        <button
                                            onClick={handleNext}
                                            className="reload-btn"
                                        >
                                            <RefreshCw size={18} />
                                            <span>Start Next Challenge</span>
                                        </button>

                                        <div className="flex flex-col items-center gap-1.5 opacity-60">
                                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                                                <Clock size={12} />
                                                <span>Adaptive Engine Active</span>
                                            </div>
                                            <p className="text-[10px] font-medium italic">Analyzing performance to generate your next personalized question.</p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
}
