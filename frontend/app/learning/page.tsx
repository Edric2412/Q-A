"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GuidedLearning from "@/components/GuidedLearning";
import LearningSkeleton from "@/components/LearningSkeleton";
import { StartSessionResponse, startSession } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogOut } from "lucide-react";
import "./learning.css";

export default function LearningPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [sessionData, setSessionData] = useState<StartSessionResponse | null>(null);
    const [studentId, setStudentId] = useState<number | null>(null);
    const [initializing, setInitializing] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Use a ref to prevent double-firing strict mode
    const initRef = useRef(false);

    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        const init = async () => {
            const uid = localStorage.getItem("user_id");
            if (!uid) {
                router.push("/");
                return;
            }
            setStudentId(parseInt(uid));

            // Check if we have session data in storage
            const stored = sessionStorage.getItem("current_session");
            const examId = searchParams.get("examId");
            const subject = searchParams.get("subject");

            // Scenario 1: Returning to an active session
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    if (examId && subject) {
                        // Fall out to start new session
                    } else {
                        setSessionData(parsed);
                        setInitializing(false);
                        return;
                    }
                } catch (e) {
                    console.error("Invalid session data", e);
                    sessionStorage.removeItem("current_session");
                }
            }

            // Scenario 2: Starting new session via URL params
            if (examId && subject) {
                try {
                    const session = await startSession(parseInt(uid), decodeURIComponent(subject), decodeURIComponent(examId));
                    sessionStorage.setItem("current_session", JSON.stringify(session));
                    setSessionData(session);
                } catch (e: any) {
                    console.error("Failed to start session", e);
                    setError(e.message || "Failed to start learning session.");
                } finally {
                    setInitializing(false);
                }
            } else {
                // No session, no params -> Redirect back
                if (!stored) {
                    router.push("/student-dashboard");
                }
                setInitializing(false);
            }
        };

        init();
    }, [router, searchParams]);

    if (initializing) {
        return (
            <div className="learning-container">
                <div className="zen-orbs">
                    <div className="zen-orb zen-orb-1"></div>
                    <div className="zen-orb zen-orb-2"></div>
                </div>
                <LearningSkeleton />
            </div>
        );
    }

    if (error) {
        return (
            <div className="learning-container">
                <div className="glass-card p-8 max-w-md text-center bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl">
                    <h2 className="text-xl font-bold text-red-500 mb-2">Error</h2>
                    <p className="mb-6">{error}</p>
                    <button
                        onClick={() => router.push("/student-dashboard")}
                        className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        Return to Dashboard
                    </button>
                </div>
            </div>
        )
    }

    if (!sessionData || !studentId) return null;

    return (
        <div className="learning-container">
            {/* Zen Mode Background */}
            <div className="zen-orbs">
                <div className="zen-orb zen-orb-1"></div>
                <div className="zen-orb zen-orb-2"></div>
            </div>

            <div className="zen-noise"></div>

            {/* Navbar - Floating Pill */}
            <nav className="zen-nav">
                <div className="nav-pill">
                    <button
                        onClick={() => router.push("/student-dashboard")}
                        className="nav-btn"
                        title="Exit Session"
                    >
                        <LogOut size={18} />
                    </button>

                    <div className="nav-divider"></div>

                    <div className="px-3">
                        <span className="text-sm font-medium tracking-wide">
                            Adaptive Learning
                        </span>
                    </div>

                    <div className="nav-divider"></div>

                    <div className="pr-1">
                        <ThemeToggle />
                    </div>
                </div>
            </nav>

            <main className="app-window-container">
                <GuidedLearning initialState={sessionData} studentId={studentId} />
            </main>
        </div>
    );
}
