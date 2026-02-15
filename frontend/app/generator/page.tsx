"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import {
    getDepartments,
    getDetails,
    uploadSyllabus,
    generateQuestions,
    regenerateQuestion,
    downloadPaper,
    downloadKey,
    Department,
    DepartmentDetails,
    Question,
} from "@/lib/api";
import { RibbonBackground } from "@/components/RibbonBackground";
import { MathRenderer } from "@/components/MathRenderer";
import "./generator.css";

interface SyllabusUnit {
    unit: string;
    text: string;
    topics?: string[];
}

interface GeneratedQuestion extends Question {
    id: number;
}

export default function GeneratorPage() {
    // Form state
    const [departments, setDepartments] = useState<Department[]>([]);
    const [details, setDetails] = useState<DepartmentDetails | null>(null);

    const [department, setDepartment] = useState("");
    const [batch, setBatch] = useState("");
    const [semester, setSemester] = useState("");
    const [subject, setSubject] = useState("");
    const [examType, setExamType] = useState("");
    const [difficulty, setDifficulty] = useState("Medium");
    const [selectedYear, setSelectedYear] = useState("");
    const [selectedMonth, setSelectedMonth] = useState("");
    const [paperSetter, setPaperSetter] = useState("");
    const [hod, setHod] = useState("");

    // File & Units & Topics
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [syllabusUnits, setSyllabusUnits] = useState<SyllabusUnit[]>([]);
    const [selectedUnits, setSelectedUnits] = useState<number[]>([]);
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

    // Questions
    const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
    const [currentQuestionId, setCurrentQuestionId] = useState(0);

    // Edit Modal State
    const [editingQuestion, setEditingQuestion] = useState<GeneratedQuestion | null>(null);
    const [editText, setEditText] = useState("");
    const [editAnswer, setEditAnswer] = useState("");

    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [toastMessage, setToastMessage] = useState("");
    const [toastType, setToastType] = useState<"success" | "error">("success");
    const [previewType, setPreviewType] = useState<"paper" | "key" | null>(null);

    // Year/Month options
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 6 }, (_, i) => currentYear + i);
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const duration = selectedMonth && selectedYear ? `${selectedMonth} ${selectedYear}` : "";

    // Load departments on mount
    useEffect(() => {
        const loadDepartments = async () => {
            try {
                const depts = await getDepartments();
                setDepartments(depts);
            } catch (error) {
                showToast("Failed to load departments", "error");
            }
        };
        loadDepartments();
    }, []);

    // Load details when department changes
    useEffect(() => {
        if (department) {
            const loadDetails = async () => {
                try {
                    const detailsList = await getDetails(department);
                    if (detailsList.length > 0) {
                        setDetails(detailsList[0]);
                    }
                } catch (error) {
                    showToast("Failed to load department details", "error");
                }
            };
            loadDetails();
            // Reset dependent fields
            setBatch("");
            setSemester("");
            setSubject("");
            setExamType("");
        } else {
            setDetails(null);
        }
    }, [department]);

    // Get subjects for selected semester
    const subjectsForSemester = details?.subjects?.[semester] || [];

    const showToast = (message: string, type: "success" | "error") => {
        setToastMessage(message);
        setToastType(type);
        setTimeout(() => setToastMessage(""), 4000);
    };

    const showLoading = (message: string) => {
        setLoadingMessage(message);
        setIsLoading(true);
    };

    const hideLoading = () => {
        setIsLoading(false);
        setLoadingMessage("");
    };

    // File upload handler
    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== "application/pdf") {
            showToast("Please select a valid PDF file", "error");
            return;
        }

        setUploadedFile(file);
        showLoading("Processing syllabus...");

        try {
            const result = await uploadSyllabus(file);
            setSyllabusUnits(result.units);

            // Auto-select all topics initially
            const allTopics = result.units.flatMap(u => u.topics || []);
            setSelectedTopics(allTopics);

            showToast("Syllabus processed successfully!", "success");
        } catch (error) {
            showToast("Failed to process syllabus", "error");
            setUploadedFile(null);
        } finally {
            hideLoading();
        }
    };

    const removeFile = () => {
        setUploadedFile(null);
        setSyllabusUnits([]);
        setSelectedUnits([]);
        setSelectedTopics([]);
    };

    const toggleUnit = (index: number) => {
        setSelectedUnits((prev) =>
            prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
        );
    };

    const selectAllUnits = () => {
        if (selectedUnits.length === syllabusUnits.length) {
            setSelectedUnits([]);
        } else {
            setSelectedUnits(syllabusUnits.map((_, i) => i));
        }
    };

    const toggleTopic = (topic: string) => {
        setSelectedTopics(prev =>
            prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
        );
    };

    // Check if form is valid
    const isFormValid =
        department &&
        batch &&
        semester &&
        subject &&
        examType &&
        difficulty &&
        duration &&
        uploadedFile &&
        selectedUnits.length > 0;

    // Generate questions
    const handleGenerate = async () => {
        if (!isFormValid) return;

        showLoading("Generating question paper... This may take a moment.");

        try {
            const selectedUnitData = selectedUnits.map((i) => syllabusUnits[i]);
            const result = await generateQuestions({
                selected_units: selectedUnitData,
                subject,
                exam_type: examType,
                difficulty,
                selected_topics: selectedTopics.length > 0 ? selectedTopics : undefined
            });

            // Process and assign IDs to questions
            const paper = result.question_paper;
            const allQuestions: GeneratedQuestion[] = [];
            let id = 0;

            paper.MCQ.forEach((q) => {
                allQuestions.push({ ...q, id: ++id, type: "MCQ" } as GeneratedQuestion);
            });
            paper.Short.forEach((q) => {
                allQuestions.push({
                    ...q,
                    id: ++id,
                    type: "Short Answer",
                } as GeneratedQuestion);
            });
            paper.Long.forEach((q) => {
                allQuestions.push({
                    ...q,
                    id: ++id,
                    type: "Long Essay",
                } as GeneratedQuestion);
            });

            setQuestions(allQuestions);
            setCurrentQuestionId(id);
            showToast("Questions generated successfully!", "success");
        } catch (error) {
            showToast("Failed to generate questions", "error");
        } finally {
            hideLoading();
        }
    };

    // Regenerate a single question
    const handleRegenerate = async (question: GeneratedQuestion) => {
        showLoading("Regenerating question...");
        try {
            const newQuestion = await regenerateQuestion({
                current_question: question,
                subject,
                difficulty,
                topics: selectedTopics.length > 0 ? selectedTopics : undefined
            });

            setQuestions(prev => prev.map(q =>
                q.id === question.id
                    ? { ...newQuestion, id: question.id, type: question.type } // Keep ID and Type
                    : q
            ));

            showToast("Question regenerated!", "success");
        } catch (error) {
            showToast("Failed to regenerate question", "error");
        } finally {
            hideLoading();
        }
    };

    // Delete question
    const deleteQuestion = (id: number) => {
        if (confirm("Are you sure you want to delete this question?")) {
            setQuestions((prev) => prev.filter((q) => q.id !== id));
        }
    };

    // Edit question handlers
    const openEditModal = (question: GeneratedQuestion) => {
        setEditingQuestion(question);
        setEditText(question.text);
        setEditAnswer(question.answer);
    };

    const closeEditModal = () => {
        setEditingQuestion(null);
        setEditText("");
        setEditAnswer("");
    };

    const saveEdit = () => {
        if (!editingQuestion) return;
        setQuestions((prev) =>
            prev.map((q) =>
                q.id === editingQuestion.id
                    ? { ...q, text: editText, answer: editAnswer }
                    : q
            )
        );
        closeEditModal();
        showToast("Question updated!", "success");
    };

    // Download handlers
    const handleDownloadPaper = async () => {
        showLoading("Generating Question Paper DOCX...");
        try {
            const blob = await downloadPaper({
                department,
                batch,
                semester,
                subject,
                examType,
                duration,
                paperSetter,
                hod,
                questions,
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${subject}_Question_Paper.docx`;
            a.click();
            URL.revokeObjectURL(url);
            showToast("Question Paper downloaded!", "success");
        } catch (error) {
            showToast("Failed to download paper", "error");
        } finally {
            hideLoading();
        }
    };

    const handleDownloadKey = async () => {
        showLoading("Generating Answer Key DOCX...");
        try {
            const blob = await downloadKey({
                department,
                batch,
                semester,
                subject,
                examType,
                duration,
                paperSetter,
                hod,
                questions,
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${subject}_Answer_Key.docx`;
            a.click();
            URL.revokeObjectURL(url);
            showToast("Answer Key downloaded!", "success");
        } catch (error) {
            showToast("Failed to download answer key", "error");
        } finally {
            hideLoading();
        }
    };

    // Group questions by type for display
    const mcqQuestions = questions.filter((q) => q.type === "MCQ");
    const shortQuestions = questions.filter((q) => q.type === "Short Answer");
    const longQuestions = questions.filter((q) => q.type === "Long Essay");

    return (
        <>
            {/* Loading Overlay */}
            {isLoading && (
                <div className="loading-overlay">
                    <div className="loading-content">
                        <div className="loading-spinner"></div>
                        <p>{loadingMessage}</p>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toastMessage && (
                <div className={`toast ${toastType} show`}>
                    <i
                        className={
                            toastType === "success"
                                ? "ri-check-line"
                                : "ri-error-warning-line"
                        }
                    ></i>
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Ribbon Background */}
            <RibbonBackground variant="blue" />

            <div className="generator-container">
                {/* Header */}
                <header className="generator-header">
                    <Link href="/dashboard" className="back-btn">
                        <i className="ri-arrow-left-line"></i>
                    </Link>
                    <div className="header-title">
                        <h1>Question Paper Generator</h1>
                        <p>Create AI-powered question papers</p>
                    </div>
                </header>

                {/* Configuration Section */}
                <section className="section config-section">
                    <h2 className="section-title">
                        <i className="ri-settings-3-line"></i>
                        Exam Configuration
                    </h2>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Department</label>
                            <select
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                            >
                                <option value="">Select Department</option>
                                {departments.map((dept) => (
                                    <option key={dept.value} value={dept.label}>
                                        {dept.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Batch</label>
                            <select
                                value={batch}
                                onChange={(e) => setBatch(e.target.value)}
                                disabled={!details}
                            >
                                <option value="">Select Batch</option>
                                {details?.batches?.map((b) => (
                                    <option key={b} value={b}>
                                        {b}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Semester</label>
                            <select
                                value={semester}
                                onChange={(e) => {
                                    setSemester(e.target.value);
                                    setSubject("");
                                }}
                                disabled={!details}
                            >
                                <option value="">Select Semester</option>
                                {details?.semesters?.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Subject</label>
                            <select
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                disabled={!semester}
                            >
                                <option value="">Select Subject</option>
                                {subjectsForSemester.map((sub) => (
                                    <option key={sub} value={sub}>
                                        {sub}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Exam Type</label>
                            <select
                                value={examType}
                                onChange={(e) => setExamType(e.target.value)}
                                disabled={!details}
                            >
                                <option value="">Select Exam Type</option>
                                {details?.exams?.map((exam) => (
                                    <option key={exam} value={exam}>
                                        {exam}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Difficulty</label>
                            <select
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value)}
                            >
                                <option value="Easy">Easy</option>
                                <option value="Medium">Medium</option>
                                <option value="Hard">Hard</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Year</label>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                            >
                                <option value="">Select Year</option>
                                {years.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Month</label>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                disabled={!selectedYear}
                            >
                                <option value="">Select Month</option>
                                {months.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Paper Setter</label>
                            <input
                                type="text"
                                placeholder="Enter name"
                                value={paperSetter}
                                onChange={(e) => setPaperSetter(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>HOD</label>
                            <input
                                type="text"
                                placeholder="Enter HOD name"
                                value={hod}
                                onChange={(e) => setHod(e.target.value)}
                            />
                        </div>
                    </div>
                </section>

                {/* Upload Section */}
                <section className="section upload-section">
                    <h2 className="section-title">
                        <i className="ri-upload-cloud-2-line"></i>
                        Syllabus Upload
                    </h2>

                    {!uploadedFile ? (
                        <label className="upload-area">
                            <input
                                type="file"
                                accept=".pdf"
                                onChange={handleFileChange}
                                hidden
                            />
                            <div className="upload-content">
                                <i className="ri-file-pdf-2-line"></i>
                                <p>
                                    <strong>Click to upload</strong> or drag and drop
                                </p>
                                <span>PDF files only</span>
                            </div>
                        </label>
                    ) : (
                        <div className="file-preview">
                            <div className="file-info">
                                <i className="ri-file-pdf-2-line"></i>
                                <span>{uploadedFile.name}</span>
                            </div>
                            <button className="remove-btn" onClick={removeFile}>
                                <i className="ri-close-line"></i>
                            </button>
                        </div>
                    )}

                    {/* Units Selection */}
                    {syllabusUnits.length > 0 && (
                        <div className="units-section">
                            <div className="units-header">
                                <h3>Select Units</h3>
                                <label className="select-all">
                                    <input
                                        type="checkbox"
                                        checked={selectedUnits.length === syllabusUnits.length}
                                        onChange={selectAllUnits}
                                    />
                                    Select All
                                </label>
                            </div>
                            <div className="units-list">
                                {syllabusUnits.map((unit, index) => (
                                    <label key={index} className="unit-item">
                                        <input
                                            type="checkbox"
                                            checked={selectedUnits.includes(index)}
                                            onChange={() => toggleUnit(index)}
                                        />
                                        <span>{unit.unit}</span>
                                    </label>
                                ))}
                            </div>

                            {/* Topics Selection */}
                            <div className="topics-container" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                <h3 style={{ marginBottom: '16px' }}>Select Topics by Unit</h3>

                                <div className="units-topics-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {selectedUnits.map((unitIndex) => {
                                        const unit = syllabusUnits[unitIndex];
                                        const unitTopics = unit.topics || [];

                                        // Check if all topics in this unit are selected
                                        const isAllSelected = unitTopics.every(t => selectedTopics.includes(t));
                                        const isIndeterminate = unitTopics.some(t => selectedTopics.includes(t)) && !isAllSelected;

                                        const handleUnitSelectAll = () => {
                                            if (isAllSelected) {
                                                // Deselect all
                                                setSelectedTopics(prev => prev.filter(t => !unitTopics.includes(t)));
                                            } else {
                                                // Select all (merge unique)
                                                setSelectedTopics(prev => [...new Set([...prev, ...unitTopics])]);
                                            }
                                        };

                                        return (
                                            <div key={unitIndex} className="unit-topic-group" style={{
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '5px',
                                                padding: '20px',
                                                background: 'rgba(255,255,255,0.02)'
                                            }}>
                                                <div className="unit-topic-header" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <h4 style={{ margin: 0, fontSize: '1rem', color: '#e2e8f0' }}>{unit.unit}</h4>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#94a3b8' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isAllSelected}
                                                            ref={el => { if (el) el.indeterminate = isIndeterminate; }}
                                                            onChange={handleUnitSelectAll}
                                                        />
                                                        Select All Topics
                                                    </label>
                                                </div>

                                                <div className="topics-grid" style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                                    gap: '10px'
                                                }}>
                                                    {unitTopics.map((topic, tIdx) => (
                                                        <label key={tIdx} className="unit-item" style={{ fontSize: '0.9em' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedTopics.includes(topic)}
                                                                onChange={() => toggleTopic(topic)}
                                                            />
                                                            <span title={topic}>{topic}</span>
                                                        </label>
                                                    ))}
                                                    {unitTopics.length === 0 && <span style={{ opacity: 0.5, fontStyle: 'italic' }}>No topics found for this unit.</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {selectedUnits.length === 0 && <p style={{ opacity: 0.5 }}>Select units above to configure topics.</p>}
                            </div>
                        </div>
                    )}
                </section>

                {/* Generate Button */}
                <div className="generate-section">
                    <button
                        className="generate-btn"
                        disabled={!isFormValid}
                        onClick={handleGenerate}
                    >
                        <i className="ri-magic-line"></i>
                        Generate Question Paper
                    </button>
                </div>

                {/* Questions Builder */}
                {
                    questions.length > 0 && (
                        <section className="section questions-section">
                            <h2 className="section-title">
                                <i className="ri-draft-line"></i>
                                Generated Questions
                            </h2>

                            {/* Section A - MCQ */}
                            {mcqQuestions.length > 0 && (
                                <div className="question-section">
                                    <h3 className="section-header">Section A - MCQ</h3>
                                    {mcqQuestions.map((q, idx) => (
                                        <div key={q.id} className="question-card">
                                            <div className="question-header">
                                                <span className="question-number">{idx + 1}</span>
                                                <span className="question-badge mcq">{q.type}</span>
                                                <span className="question-marks">{q.marks} mark</span>
                                                <button
                                                    className="edit-btn"
                                                    onClick={() => handleRegenerate(q)}
                                                    title="Regenerate Question"
                                                >
                                                    <i className="ri-refresh-line"></i>
                                                </button>
                                                <button
                                                    className="edit-btn"
                                                    onClick={() => openEditModal(q)}
                                                >
                                                    <i className="ri-edit-line"></i>
                                                </button>
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => deleteQuestion(q.id)}
                                                >
                                                    <i className="ri-delete-bin-line"></i>
                                                </button>
                                            </div>
                                            <div className="question-text">
                                                <MathRenderer content={q.text} />
                                            </div>
                                            {q.answer && (
                                                <div className="question-answer">
                                                    <strong>Answer:</strong>
                                                    <MathRenderer content={q.answer} />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Section B - Short Answer */}
                            {shortQuestions.length > 0 && (
                                <div className="question-section">
                                    <h3 className="section-header">Section B - Short Answer</h3>
                                    {shortQuestions.map((q, idx) => (
                                        <div key={q.id} className="question-card">
                                            <div className="question-header">
                                                <span className="question-number">
                                                    {Math.floor(idx / 2) + 11}
                                                    {idx % 2 === 0 ? ".a" : ".b"}
                                                </span>
                                                <span className="question-badge short">{q.type}</span>
                                                <span className="question-marks">{q.marks} marks</span>
                                                <button
                                                    className="edit-btn"
                                                    onClick={() => handleRegenerate(q)}
                                                    title="Regenerate Question"
                                                >
                                                    <i className="ri-refresh-line"></i>
                                                </button>
                                                <button
                                                    className="edit-btn"
                                                    onClick={() => openEditModal(q)}
                                                >
                                                    <i className="ri-edit-line"></i>
                                                </button>
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => deleteQuestion(q.id)}
                                                >
                                                    <i className="ri-delete-bin-line"></i>
                                                </button>
                                            </div>
                                            <div className="question-text">
                                                <MathRenderer content={q.text} />
                                            </div>
                                            {q.answer && (
                                                <div className="question-answer">
                                                    <strong>Answer:</strong>
                                                    <MathRenderer content={q.answer} />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Section C - Long Essay */}
                            {longQuestions.length > 0 && (
                                <div className="question-section">
                                    <h3 className="section-header">Section C - Long Essay</h3>
                                    {longQuestions.map((q, idx) => (
                                        <div key={q.id} className="question-card">
                                            <div className="question-header">
                                                <span className="question-number">
                                                    {Math.floor(idx / 2) + 16}
                                                    {idx % 2 === 0 ? ".a" : ".b"}
                                                </span>
                                                <span className="question-badge long">{q.type}</span>
                                                <span className="question-marks">{q.marks} marks</span>
                                                <button
                                                    className="edit-btn"
                                                    onClick={() => handleRegenerate(q)}
                                                    title="Regenerate Question"
                                                >
                                                    <i className="ri-refresh-line"></i>
                                                </button>
                                                <button
                                                    className="edit-btn"
                                                    onClick={() => openEditModal(q)}
                                                >
                                                    <i className="ri-edit-line"></i>
                                                </button>
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => deleteQuestion(q.id)}
                                                >
                                                    <i className="ri-delete-bin-line"></i>
                                                </button>
                                            </div>
                                            <div className="question-text">
                                                <MathRenderer content={q.text} />
                                            </div>
                                            {q.answer && (
                                                <div className="question-answer">
                                                    <strong>Answer:</strong>
                                                    <MathRenderer content={q.answer} />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    )
                }

                {/* Export Section */}
                {
                    questions.length > 0 && (
                        <section className="section export-section">
                            <h2 className="section-title">
                                <i className="ri-download-2-line"></i>
                                Preview & Export
                            </h2>
                            <div className="export-buttons">
                                <button className="export-btn preview" onClick={() => setPreviewType("paper")}>
                                    <i className="ri-eye-line"></i>
                                    Preview Question Paper
                                </button>
                                <button className="export-btn paper" onClick={handleDownloadPaper}>
                                    <i className="ri-file-word-line"></i>
                                    Download Question Paper
                                </button>
                            </div>
                            <div className="export-buttons" style={{ marginTop: "12px" }}>
                                <button className="export-btn preview" onClick={() => setPreviewType("key")}>
                                    <i className="ri-eye-line"></i>
                                    Preview Answer Key
                                </button>
                                <button className="export-btn key" onClick={handleDownloadKey}>
                                    <i className="ri-file-text-line"></i>
                                    Download Answer Key
                                </button>
                            </div>
                        </section>
                    )
                }
            </div >

            {/* Edit Modal */}
            {
                editingQuestion && (
                    <div className="modal-overlay" onClick={closeEditModal}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>Edit Question</h3>
                                <button className="modal-close" onClick={closeEditModal}>
                                    <i className="ri-close-line"></i>
                                </button>
                            </div>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Question Text</label>
                                    <textarea
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        rows={6}
                                        placeholder="Enter question text..."
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Answer</label>
                                    <textarea
                                        value={editAnswer}
                                        onChange={(e) => setEditAnswer(e.target.value)}
                                        rows={4}
                                        placeholder="Enter answer..."
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn-secondary" onClick={closeEditModal}>
                                    Cancel
                                </button>
                                <button className="btn-primary" onClick={saveEdit}>
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Preview Modal */}
            {
                previewType && (
                    <div className="modal-overlay" onClick={() => setPreviewType(null)}>
                        <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>{previewType === "paper" ? "Question Paper Preview" : "Answer Key Preview"}</h3>
                                <button className="modal-close" onClick={() => setPreviewType(null)}>
                                    <i className="ri-close-line"></i>
                                </button>
                            </div>
                            <div className="preview-body">
                                {/* Header */}
                                <div className="preview-header">
                                    <h2>{department}</h2>
                                    <p><strong>Batch:</strong> {batch} | <strong>Semester:</strong> {semester}</p>
                                    <p><strong>Subject:</strong> {subject} | <strong>Exam:</strong> {examType}</p>
                                    <p><strong>Duration:</strong> {duration}</p>
                                </div>

                                {/* MCQ Section */}
                                {mcqQuestions.length > 0 && (
                                    <div className="preview-section">
                                        <h4>Section A - Multiple Choice Questions (1 mark each)</h4>
                                        {mcqQuestions.map((q, idx) => (
                                            <div key={q.id} className="preview-question">
                                                <p><strong>{idx + 1}.</strong> {q.text}</p>
                                                {previewType === "key" && q.answer && (
                                                    <p className="preview-answer"><strong>Answer:</strong> {q.answer}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Short Answer Section */}
                                {shortQuestions.length > 0 && (
                                    <div className="preview-section">
                                        <h4>Section B - Short Answer Questions ({shortQuestions[0]?.marks || 4} marks each)</h4>
                                        {shortQuestions.map((q, idx) => (
                                            <div key={q.id} className="preview-question">
                                                <p><strong>{Math.floor(idx / 2) + 11}{idx % 2 === 0 ? "a" : "b"}.</strong> {q.text}</p>
                                                {previewType === "key" && q.answer && (
                                                    <p className="preview-answer"><strong>Answer:</strong> {q.answer}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Long Answer Section */}
                                {longQuestions.length > 0 && (
                                    <div className="preview-section">
                                        <h4>Section C - Long Answer Questions ({longQuestions[0]?.marks || 10} marks each)</h4>
                                        {longQuestions.map((q, idx) => (
                                            <div key={q.id} className="preview-question">
                                                <p><strong>{Math.floor(idx / 2) + 16}{idx % 2 === 0 ? "a" : "b"}.</strong> {q.text}</p>
                                                {previewType === "key" && q.answer && (
                                                    <p className="preview-answer"><strong>Answer:</strong> {q.answer}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Footer */}
                                <div className="preview-footer">
                                    <p><strong>Paper Setter:</strong> {paperSetter || "N/A"}</p>
                                    <p><strong>HOD:</strong> {hod || "N/A"}</p>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn-secondary" onClick={() => setPreviewType(null)}>
                                    Close
                                </button>
                                <button className="btn-primary" onClick={previewType === "paper" ? handleDownloadPaper : handleDownloadKey}>
                                    <i className="ri-download-line"></i>
                                    Download DOCX
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
}
