"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { getEvaluationResults, EvaluationResult } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell,
} from "recharts";
import "./visualizations.css";

const PASS_THRESHOLD = 20; // Pass mark is 20

// ==================== HELPER FUNCTIONS ====================

function computeStats(results: EvaluationResult[]) {
    const totals = results.map(r => r.total);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    const high = Math.max(...totals);
    const low = Math.min(...totals);

    // Compute max possible marks from the first student's marks keys
    const maxPossible = high > 0 ? high : 100; // fallback
    const passCount = totals.filter(t => t >= PASS_THRESHOLD).length;
    const passRate = (passCount / totals.length) * 100;

    return { avg, high, low, passRate, studentCount: results.length, maxPossible };
}

function computeHistogram(results: EvaluationResult[], maxPossible: number) {
    const binSize = Math.max(Math.ceil(maxPossible / 10), 5);
    const bins: { range: string; count: number }[] = [];

    for (let i = 0; i < maxPossible; i += binSize) {
        const upper = Math.min(i + binSize, maxPossible);
        bins.push({ range: `${i}-${upper}`, count: 0 });
    }

    results.forEach(r => {
        const idx = Math.min(Math.floor(r.total / binSize), bins.length - 1);
        if (idx >= 0 && idx < bins.length) bins[idx].count++;
    });

    return bins;
}

function computePerQuestionAvg(results: EvaluationResult[]) {
    if (results.length === 0) return [];

    const questionKeys = Object.keys(results[0].marks || {}).sort((a, b) => {
        const numA = parseInt(a.replace('Q', ''));
        const numB = parseInt(b.replace('Q', ''));
        return numA - numB;
    });

    return questionKeys.map(qKey => {
        const scores = results.map(r => r.marks[qKey] || 0);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const maxScore = Math.max(...scores);
        return { question: qKey, avgScore: parseFloat(avgScore.toFixed(2)), maxScore };
    });
}

function computeRankings(results: EvaluationResult[]) {
    return [...results]
        .sort((a, b) => b.total - a.total)
        .map((r, idx) => ({ ...r, rank: idx + 1 }));
}

// ==================== CUSTOM TOOLTIP ====================

interface TooltipPayload {
    name?: string;
    value?: number;
    color?: string;
    payload?: Record<string, unknown>;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="viz-tooltip">
            <div className="tooltip-label">{label}</div>
            {payload.map((p, i) => (
                <div key={i} className="tooltip-value" style={{ color: p.color }}>
                    {p.name}: {p.value}
                </div>
            ))}
        </div>
    );
}

// ==================== HEATMAP COLOR ====================

function getHeatColor(value: number, max: number): string {
    if (max === 0) return "rgba(99, 102, 241, 0.1)";
    const ratio = value / max;
    if (ratio >= 0.8) return "rgba(16, 185, 129, 0.35)";
    if (ratio >= 0.6) return "rgba(16, 185, 129, 0.2)";
    if (ratio >= 0.4) return "rgba(245, 158, 11, 0.2)";
    if (ratio >= 0.2) return "rgba(239, 68, 68, 0.15)";
    return "rgba(239, 68, 68, 0.3)";
}

function getHeatTextColor(value: number, max: number): string {
    if (max === 0) return "var(--text-muted)";
    const ratio = value / max;
    if (ratio >= 0.6) return "#10b981";
    if (ratio >= 0.4) return "#f59e0b";
    return "#ef4444";
}

// ==================== MAIN COMPONENT ====================

export default function VisualizationsPage() {
    const params = useParams();
    const exam_id = params?.exam_id as string;
    const [results, setResults] = useState<EvaluationResult[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!exam_id) return;
        getEvaluationResults(exam_id)
            .then(setResults)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [exam_id]);

    const stats = useMemo(() => results.length > 0 ? computeStats(results) : null, [results]);
    const histogram = useMemo(() => stats ? computeHistogram(results, stats.maxPossible) : [], [results, stats]);
    const perQuestion = useMemo(() => computePerQuestionAvg(results), [results]);
    const rankings = useMemo(() => computeRankings(results), [results]);

    const donutData = useMemo(() => {
        if (!stats) return [];
        const passCount = results.filter(r => r.total >= PASS_THRESHOLD).length;
        return [
            { name: "Pass", value: passCount },
            { name: "Fail", value: results.length - passCount },
        ];
    }, [results, stats]);

    const DONUT_COLORS = ["#10b981", "#ef4444"];

    if (loading) {
        return (
            <div className="viz-page">
                <div className="viz-loading">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <p>Loading analytics...</p>
                </div>
            </div>
        );
    }

    if (!stats || results.length === 0) {
        return (
            <div className="viz-page">
                <div className="viz-loading">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    <p>No data available for analytics.</p>
                </div>
            </div>
        );
    }

    // Question keys for heatmap
    const questionKeys = Object.keys(results[0].marks || {}).sort((a, b) => {
        const numA = parseInt(a.replace('Q', ''));
        const numB = parseInt(b.replace('Q', ''));
        return numA - numB;
    });

    // Max marks per question for heatmap coloring
    const maxPerQ: Record<string, number> = {};
    questionKeys.forEach(qk => {
        maxPerQ[qk] = Math.max(...results.map(r => r.marks[qk] || 0));
    });

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="viz-page">
            {/* Header */}
            <header className="viz-header">
                <div className="viz-header-left">
                    <Link href={`/dashboard`} className="viz-back-link">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Back to Dashboard
                    </Link>
                </div>
                <div className="viz-header-right">
                    <button className="viz-print-btn" onClick={handlePrint}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9" />
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                            <rect x="6" y="14" width="12" height="8" />
                        </svg>
                        Print Report
                    </button>
                    <ThemeToggle />
                </div>
            </header>

            <main className="viz-main">
                {/* Title Banner */}
                <div className="viz-title-banner">
                    <h1>Performance Analytics</h1>
                    <div className="viz-title-meta">
                        <span className="viz-chip">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />
                                <line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
                            </svg>
                            Exam: {exam_id.substring(0, 8)}...
                        </span>
                        <span className="viz-chip">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                            </svg>
                            {results.length} Students
                        </span>
                        <span className="viz-chip">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            {new Date(results[0].timestamp).toLocaleDateString()}
                        </span>
                    </div>
                </div>

                {/* ===== 1. SUMMARY STATS ===== */}
                <div className="stats-row">
                    <div className="stat-card avg">
                        <div className="stat-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                            </svg>
                        </div>
                        <div className="stat-value">{stats.avg.toFixed(1)}</div>
                        <div className="stat-label">Class Average</div>
                    </div>
                    <div className="stat-card high">
                        <div className="stat-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
                            </svg>
                        </div>
                        <div className="stat-value">{stats.high}</div>
                        <div className="stat-label">Highest Score</div>
                    </div>
                    <div className="stat-card low">
                        <div className="stat-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
                            </svg>
                        </div>
                        <div className="stat-value">{stats.low}</div>
                        <div className="stat-label">Lowest Score</div>
                    </div>
                    <div className="stat-card pass">
                        <div className="stat-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        </div>
                        <div className="stat-value">{stats.passRate.toFixed(0)}%</div>
                        <div className="stat-label">Pass Rate</div>
                    </div>
                    <div className="stat-card total">
                        <div className="stat-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </div>
                        <div className="stat-value">{stats.studentCount}</div>
                        <div className="stat-label">Students</div>
                    </div>
                </div>

                {/* ===== CHARTS GRID ===== */}
                <div className="viz-grid">
                    {/* 2. SCORE DISTRIBUTION */}
                    <div className="viz-panel">
                        <h3 className="viz-panel-title">Score Distribution</h3>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={histogram} margin={{ top: 5, right: 30, left: 0, bottom: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="range" tick={{ fill: 'black', fontSize: 11 }} />
                                    <YAxis allowDecimals={false} tick={{ fill: 'black', fontSize: 11 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="count" name="Students" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={50} isAnimationActive={false} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 6. PASS/FAIL DONUT */}
                    <div className="viz-panel">
                        <h3 className="viz-panel-title">Pass / Fail Breakdown</h3>
                        <div className="chart-container donut-container" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={donutData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={70}
                                        outerRadius={110}
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="none"
                                        isAnimationActive={false}
                                    >
                                        {donutData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={DONUT_COLORS[index]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ position: "absolute", textAlign: "center" }}>
                                <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>
                                    {donutData[0]?.value || 0}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    Passed
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. PER-QUESTION PERFORMANCE (full width) */}
                    <div className="viz-panel full-width">
                        <h3 className="viz-panel-title">Per-Question Performance</h3>
                        <div className="chart-container" style={{ height: 350 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={perQuestion} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="question" tick={{ fill: 'black', fontSize: 11 }} />
                                    <YAxis tick={{ fill: 'black', fontSize: 11 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="avgScore" name="Avg Score" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={40} isAnimationActive={false} />
                                    <Bar dataKey="maxScore" name="Max Scored" fill="rgba(99, 102, 241, 0.2)" radius={[6, 6, 0, 0]} maxBarSize={40} isAnimationActive={false} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 4. STUDENT RANKING TABLE */}
                    <div className="viz-panel">
                        <h3 className="viz-panel-title">Student Rankings</h3>
                        <div style={{ maxHeight: 400, overflowY: "auto" }}>
                            <table className="ranking-table">
                                <thead>
                                    <tr>
                                        <th className="text-center">#</th>
                                        <th>Roll No</th>
                                        <th className="text-right">Total</th>
                                        <th style={{ width: "30%" }}>Performance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rankings.map((r) => (
                                        <tr key={r.rank}>
                                            <td className="text-center">
                                                <span className={`rank-badge ${r.rank === 1 ? 'gold' : r.rank === 2 ? 'silver' : r.rank === 3 ? 'bronze' : 'default'}`}>
                                                    {r.rank}
                                                </span>
                                            </td>
                                            <td>{r.roll_no}</td>
                                            <td className="text-right ranking-total">{r.total}</td>
                                            <td>
                                                <div className="spark-bar-bg">
                                                    <div
                                                        className="spark-bar-fill"
                                                        style={{ width: `${(r.total / stats.maxPossible) * 100}%` }}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 5. SCORE HEATMAP */}
                    <div className="viz-panel">
                        <h3 className="viz-panel-title">Score Heatmap</h3>
                        <div className="heatmap-container" style={{ maxHeight: 400, overflowY: "auto" }}>
                            <table className="heatmap-table">
                                <thead>
                                    <tr>
                                        <th>Student</th>
                                        {questionKeys.map(qk => <th key={qk}>{qk}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rankings.map((r) => (
                                        <tr key={r.roll_no}>
                                            <td className="heatmap-student">{r.roll_no}</td>
                                            {questionKeys.map(qk => {
                                                const val = r.marks[qk] || 0;
                                                const max = maxPerQ[qk] || 1;
                                                return (
                                                    <td
                                                        key={qk}
                                                        className="heatmap-cell"
                                                        style={{
                                                            background: getHeatColor(val, max),
                                                            color: getHeatTextColor(val, max),
                                                        }}
                                                        title={`${r.roll_no} — ${qk}: ${val}/${max}`}
                                                    >
                                                        {val}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
