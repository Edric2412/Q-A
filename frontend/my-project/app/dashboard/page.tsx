"use client";

import Link from "next/link";
import "./dashboard.css";

export default function DashboardPage() {
    return (
        <>
            {/* Background */}
            <div className="dashboard-bg">
                <div className="bg-gradient"></div>
            </div>

            <div className="dashboard-container">
                {/* Header */}
                <header className="dashboard-header">
                    <div className="logo">
                        <div className="logo-icon">K</div>
                        <div className="logo-text">
                            <h1>KCLAS</h1>
                            <span>Question Paper System</span>
                        </div>
                    </div>
                    <Link href="/" className="logout-btn">
                        <i className="ri-logout-box-r-line"></i>
                        <span>Logout</span>
                    </Link>
                </header>

                {/* Main Content */}
                <main className="dashboard-main">
                    <div className="welcome-section">
                        <h2>Welcome back!</h2>
                        <p>Choose a module to get started</p>
                    </div>

                    <div className="modules-grid">
                        {/* Question Paper Generator Card */}
                        <Link href="/generator" className="module-card generator-card">
                            <div className="card-icon">
                                <i className="ri-file-list-3-line"></i>
                            </div>
                            <div className="card-content">
                                <h3>Question Paper Generator</h3>
                                <p>
                                    Upload syllabus, generate AI-powered MCQs, short answers, and
                                    long essay questions. Export to DOCX format.
                                </p>
                            </div>
                            <div className="card-arrow">
                                <i className="ri-arrow-right-line"></i>
                            </div>
                        </Link>

                        {/* Answer Evaluator Card */}
                        <Link href="/evaluate" className="module-card evaluator-card">
                            <div className="card-icon">
                                <i className="ri-check-double-line"></i>
                            </div>
                            <div className="card-content">
                                <h3>Answer Evaluator</h3>
                                <p>
                                    Upload student answers, run AI grading with real-time progress
                                    tracking, and export results to Excel.
                                </p>
                            </div>
                            <div className="card-arrow">
                                <i className="ri-arrow-right-line"></i>
                            </div>
                        </Link>
                    </div>
                </main>

                {/* Footer */}
                <footer className="dashboard-footer">
                    <p>
                        &copy; {new Date().getFullYear()} Kumaraguru College of Liberal Arts
                        & Science. All rights reserved.
                    </p>
                </footer>
            </div>
        </>
    );
}
