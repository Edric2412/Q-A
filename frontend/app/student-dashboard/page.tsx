"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { getMyEvaluations, Evaluation, getLearningLogs, LearningLog } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
    BookOpen, LayoutDashboard, GraduationCap,
    PieChart, Trophy, ArrowUpRight, Clock,
    ChevronRight, LogOut, Search, Settings
} from "lucide-react";
import "./student-dashboard.css";

// --- Components ---

const StatCard = ({ title, value, trend, icon, color, delay = 0 }: { title: string, value: string | number, trend?: string, icon: React.ReactNode, color: string, delay?: number }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.4 }}
        className="stat-card"
    >
        <div className="bg-icon">{icon}</div>

        <div className="stat-icon-wrapper">
            <div className={`stat-icon bg-${color}-500/10 text-${color}-500`}>
                {icon}
            </div>
            {trend && (
                <span className="stat-trend text-[var(--accent-success)] bg-[var(--accent-success)]/10">
                    <ArrowUpRight size={10} /> {trend}
                </span>
            )}
        </div>

        <div className="stat-value">{value}</div>
        <div className="stat-label">{title}</div>
    </motion.div>
);

const SidebarItem = ({ icon, label, active = false, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) => (
    <button
        onClick={onClick}
        className={`menu-item ${active ? "active" : ""}`}
    >
        <div className="icon">
            {icon}
        </div>
        <span>{label}</span>
    </button>
);

const RecentActivity = ({ evaluations, router }: { evaluations: Evaluation[], router: any }) => (
    <div className="section-container">
        <div className="section-title">
            <Clock size={18} className="text-[var(--accent-primary)]" /> Recent Activity
        </div>

        {evaluations.length === 0 ? (
            <div className="glass-panel text-center flex flex-col items-center justify-center min-h-[200px]">
                <div className="p-4 bg-[var(--bg-primary)] rounded-full mb-4 opacity-50"><BookOpen size={24} /></div>
                <h3 className="text-sm font-bold mb-1">No Tests Taken</h3>
                <p className="text-xs text-[var(--text-secondary)]">Complete a test to see results.</p>
            </div>
        ) : (
            <div>
                {evaluations.slice(0, 5).map((ev, i) => (
                    <motion.div
                        key={ev._id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => router.push(`/student-dashboard/test/${ev.exam_id}`)}
                        className="list-item group"
                    >
                        <div className="item-score-box group-hover:scale-105 transition-transform">
                            <span className="score-val text-[var(--accent-primary)]">{ev.total || 0}</span>
                            <span className="score-label">Marks</span>
                        </div>

                        <div className="flex-1 min-w-0 item-details">
                            <h3 className="group-hover:text-[var(--accent-primary)] transition-colors truncate">
                                {ev.subject}
                            </h3>
                            <div className="item-meta">
                                <span className="truncate">ID: {ev.exam_id.substring(0, 8)}...</span>
                                <span className="w-1 h-1 rounded-full bg-[var(--text-secondary)]"></span>
                                <span>{new Date(ev.timestamp).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div className="p-2 rounded-full text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] transition-colors">
                            <ChevronRight size={18} />
                        </div>
                    </motion.div>
                ))}
            </div>
        )}
    </div>
);

const SubjectMastery = ({ learningLogs }: { learningLogs: LearningLog[] }) => {
    // Calculate mastery per topic
    const topicMastery: Record<string, { total: number, count: number }> = {};
    learningLogs.forEach(log => {
        if (!topicMastery[log.topic]) topicMastery[log.topic] = { total: 0, count: 0 };
        topicMastery[log.topic].total += log.mastery_after;
        topicMastery[log.topic].count += 1;
    });

    const masteryData = Object.entries(topicMastery).map(([topic, data]) => ({
        topic,
        mastery: (data.total / data.count) * 100
    })).sort((a, b) => b.mastery - a.mastery).slice(0, 6);

    return (
        <div className="mac-card mb-6">
            <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-xs flex items-center gap-2 text-[var(--text-primary)]">
                    <Trophy size={14} className="text-[var(--accent-warning)]" /> Subject Mastery
                </h3>
            </div>

            {masteryData.length === 0 ? (
                <div className="text-center py-6 text-[var(--text-tertiary)] text-xs">
                    No progress data.
                </div>
            ) : (
                <div className="space-y-4">
                    {masteryData.map((item, i) => (
                        <div key={i} className="mastery-item">
                            <span className="text-[11px] font-medium text-[var(--text-secondary)]">{item.topic}</span>
                            <div className="mastery-progress-bar">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${item.mastery}%` }}
                                    transition={{ duration: 1.2, delay: 0.1 * i, ease: [0.16, 1, 0.3, 1] }}
                                    className="progress-fill bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]"
                                />
                            </div>
                            <span className="text-[10px] font-bold text-[var(--accent-primary)] text-right">{Math.round(item.mastery)}%</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const LearningLogsPanel = ({ learningLogs }: { learningLogs: LearningLog[] }) => (
    <div className="mac-card">
        <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-sm flex items-center gap-2 text-[var(--text-primary)]">
                <BookOpen size={16} className="text-[var(--accent-secondary)]" /> Recent Learning
            </h3>
            <div className="p-1.5 bg-[var(--bg-primary)] rounded-lg">
                <Clock size={12} className="text-[var(--text-tertiary)]" />
            </div>
        </div>

        <div className="space-y-2">
            {learningLogs.length === 0 ? (
                <div className="text-center py-6 text-[var(--text-tertiary)] text-xs">
                    No learning sessions yet.
                </div>
            ) : (
                learningLogs.slice(0, 5).map((log, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * i }}
                        className="mac-list-item"
                    >
                        <div className={`w-1.5 h-1.5 rounded-full ${log.score > 0.6 ? 'bg-[var(--accent-success)]' : 'bg-[var(--accent-warning)]'} shadow-[0_0_8px_rgba(16,185,129,0.4)]`} />
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-[var(--text-primary)] truncate">{log.topic}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] text-[var(--text-tertiary)] font-medium">{new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                <span className="w-0.5 h-0.5 rounded-full bg-[var(--text-tertiary)]" />
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-secondary)] font-bold">{log.difficulty}</span>
                            </div>
                        </div>
                        <div className="score-pill">
                            {Math.round(log.score * 100)}%
                        </div>
                    </motion.div>
                ))
            )}
        </div>
    </div>
);

// --- Main Page Component ---

export default function StudentDashboard() {
    const router = useRouter();
    const pathname = usePathname();
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [learningLogs, setLearningLogs] = useState<LearningLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [studentName, setStudentName] = useState("");

    // Stats
    const [stats, setStats] = useState({
        totalTests: 0,
        avgScore: 0,
        topSubject: "N/A",
        recentGrowth: "+0%",
        latestScore: 0
    });

    useEffect(() => {
        const role = localStorage.getItem("user_role");
        const storedUserId = localStorage.getItem("user_id");
        const storedEmail = localStorage.getItem("user_email");

        if (!storedUserId || role !== "student") {
            router.push("/");
            return;
        }

        if (storedUserId) {
            const email = storedEmail || "Student";
            const namePart = email.split('@')[0];
            const formattedName = namePart.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
            setStudentName(formattedName);
            const uid = parseInt(storedUserId);
            fetchData(uid, email);
            fetchLearningLogs(uid);
        }
    }, [router]);

    const fetchData = async (id: number, email: string) => {
        try {
            const data = await getMyEvaluations(id, email);

            // Sort by timestamp desc
            const sortedData = data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setEvaluations(sortedData);

            // Stats Logic
            const total = data.length;
            const avg = total > 0 ? data.reduce((acc, curr) => acc + (curr.total || 0), 0) / total : 0;
            const latest = sortedData.length > 0 ? sortedData[0].total : 0;

            // Determine top subject
            const subjectScores: Record<string, number[]> = {};
            data.forEach(d => {
                if (!subjectScores[d.subject]) subjectScores[d.subject] = [];
                subjectScores[d.subject].push(d.total || 0);
            });
            let topSub = "N/A";
            let maxAvg = -1;
            Object.entries(subjectScores).forEach(([sub, scores]) => {
                const subAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
                if (subAvg > maxAvg) { maxAvg = subAvg; topSub = sub; }
            });

            setStats({
                totalTests: total,
                avgScore: Math.round(avg * 10) / 10,
                topSubject: topSub,
                recentGrowth: total > 1 ? "+12%" : "N/A",
                latestScore: latest
            });

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchLearningLogs = async (id: number) => {
        try {
            const logs = await getLearningLogs(id);
            setLearningLogs(logs);
        } catch (e) {
            console.error("Failed to fetch learning logs", e);
        }
    }

    return (
        <div className="dashboard-container">

            {/* --- SIDEBAR --- */}
            <aside className="sidebar hidden md:flex">
                <div className="sidebar-header">
                    <div className="logo-box">
                        <GraduationCap size={20} />
                    </div>
                    <div className="app-title">
                        <h1>KCLAS<span className="text-[var(--accent-primary)]">AI</span></h1>
                    </div>
                </div>

                <div className="sidebar-menu custom-scrollbar">
                    <div className="menu-section-label">Menu</div>
                    <SidebarItem icon={<LayoutDashboard size={18} />} label="Overview" active />
                    <SidebarItem icon={<BookOpen size={18} />} label="My Courses" onClick={() => { }} />
                    <SidebarItem icon={<PieChart size={18} />} label="Analytics" onClick={() => { }} />

                    <div className="menu-section-label">System</div>
                    <SidebarItem icon={<Settings size={18} />} label="Settings" onClick={() => { }} />
                </div>

                <div className="sidebar-footer">
                    <button
                        onClick={() => { localStorage.clear(); router.push("/"); }}
                        className="btn-signout"
                    >
                        <LogOut size={18} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* --- MAIN CONTENT --- */}
            <main className="main-content scrollbar-hide">

                {/* Header */}
                <header className="page-header">
                    <div className="welcome-text">
                        <h1>
                            Welcome back, {studentName.split(' ')[0]}
                        </h1>
                        <p>Here's your academic overview.</p>
                    </div>

                    <div className="header-actions">
                        <div className="search-bar hidden md:block">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="search-input"
                            />
                        </div>

                        {/* Toggle replaces profile icons */}
                        <ThemeToggle className="w-auto px-3 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-full hover:bg-[var(--glass-highlight)] transition-colors" />
                    </div>
                </header>

                {/* Dashboard Grid */}
                <div className="stats-grid">
                    <StatCard title="Total Tests" value={stats.totalTests} icon={<BookOpen size={20} />} color="blue" delay={0.1} />
                    <StatCard title="Avg. Score" value={stats.avgScore} trend={stats.recentGrowth} icon={<PieChart size={20} />} color="emerald" delay={0.2} />
                    <StatCard title="Strongest Subject" value={stats.topSubject} icon={<Trophy size={20} />} color="amber" delay={0.3} />

                    {/* Latest Result Card (Replaces Generate Report) */}
                    <StatCard title="Latest Result" value={stats.latestScore} icon={<ArrowUpRight size={20} />} color="purple" delay={0.4} />
                </div>

                <div className="content-grid">

                    {/* Left Panel: Recent Tests */}
                    <RecentActivity evaluations={evaluations} router={router} />

                    {/* Right Panel: Replaced with Subject Mastery & Learning Logs */}
                    <div className="section-container">
                        <SubjectMastery learningLogs={learningLogs} />
                        <LearningLogsPanel learningLogs={learningLogs} />
                    </div>
                </div>
            </main>
        </div>
    );
}
