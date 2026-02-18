"use client";

import { BarChart2, BookOpen } from "lucide-react";

export default function LearningSkeleton() {
    return (
        <div className="app-window-container">
            <div className="app-window">
                {/* --- SIDEBAR SKELETON --- */}
                <div className="app-sidebar">
                    <div className="sidebar-content">
                        <div className="text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2 opacity-30">
                            <BarChart2 size={12} /> Mastery Levels
                        </div>
                        <div className="space-y-6">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="space-y-2">
                                    <div className="h-3 w-24 skeleton opacity-50"></div>
                                    <div className="h-1.5 w-full skeleton opacity-30"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="sidebar-status-bar">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl skeleton opacity-40"></div>
                            <div className="space-y-2">
                                <div className="h-2.5 w-20 skeleton opacity-40"></div>
                                <div className="h-2 w-16 skeleton opacity-20"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- MAIN CONTENT SKELETON --- */}
                <div className="app-content">
                    <div className="content-header">
                        <div className="flex items-center gap-3">
                            <div className="h-3 w-12 skeleton opacity-30"></div>
                            <div className="h-7 w-32 rounded-full skeleton opacity-40"></div>
                        </div>
                        <div className="h-7 w-20 rounded-full skeleton opacity-30"></div>
                    </div>

                    <div className="question-area flex flex-col items-center pt-24">
                        <div className="max-w-3xl w-full space-y-4">
                            <div className="h-4 w-3/4 skeleton opacity-40"></div>
                            <div className="h-4 w-full skeleton opacity-40"></div>
                            <div className="h-4 w-5/6 skeleton opacity-40"></div>
                            <div className="h-4 w-1/2 skeleton opacity-40 mt-8"></div>
                        </div>
                    </div>

                    <div className="input-dock">
                        <div className="input-container h-24 w-full max-w-2xl skeleton opacity-20"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
