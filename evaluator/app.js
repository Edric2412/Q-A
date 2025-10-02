// Application data from the provided JSON
const appData = {
    college: {
        name: "Kumaraguru College of Liberal Arts & Science",
        shortName: "KCLAS",
        address: "Coimbatore, Tamil Nadu, India"
    },
    departments: [
        {
            name: "Computer Science",
            subjects: ["Data Structures", "Algorithms", "Database Systems", "Web Development", "Machine Learning", "Operating Systems", "Computer Networks", "Software Engineering"]
        },
        {
            name: "Mathematics", 
            subjects: ["Calculus", "Statistics", "Linear Algebra", "Discrete Mathematics", "Numerical Methods", "Probability Theory", "Complex Analysis", "Real Analysis"]
        },
        {
            name: "Physics",
            subjects: ["Mechanics", "Thermodynamics", "Electromagnetism", "Quantum Physics", "Optics", "Nuclear Physics", "Solid State Physics", "Astrophysics"]
        },
        {
            name: "Chemistry",
            subjects: ["Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry", "Analytical Chemistry", "Biochemistry", "Environmental Chemistry", "Polymer Chemistry", "Medicinal Chemistry"]
        },
        {
            name: "Biology",
            subjects: ["Cell Biology", "Genetics", "Ecology", "Microbiology", "Biochemistry", "Botany", "Zoology", "Molecular Biology"]
        },
        {
            name: "English",
            subjects: ["Literature", "Grammar", "Creative Writing", "Linguistics", "Communication Skills", "Poetry", "Drama", "Literary Criticism"]
        },
        {
            name: "History",
            subjects: ["Ancient History", "Medieval History", "Modern History", "World History", "Indian History", "Political History", "Social History", "Cultural History"]
        }
    ],
    batches: ["2021-2025", "2022-2026", "2023-2027", "2024-2028", "2025-2029"],
    semesters: ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"],
    examTypes: ["CIA-I", "CIA-II", "Model Exam", "End Semester"],
    sampleStudents: [
        {
            rollNumber: "21CS001",
            name: "Aadhya Sharma",
            marks: null
        },
        {
            rollNumber: "21CS002",
            name: "Arjun Patel",
            marks: null
        },
        {
            rollNumber: "21CS003",
            name: "Diya Singh",
            marks: null
        },
        {
            rollNumber: "21CS004",
            name: "Karthik Reddy",
            marks: null
        },
        {
            rollNumber: "21CS005",
            name: "Meera Nair",
            marks: null
        },
        {
            rollNumber: "21CS006",
            name: "Rohan Kumar",
            marks: null
        },
        {
            rollNumber: "21CS007",
            name: "Sanya Gupta",
            marks: null
        },
        {
            rollNumber: "21CS008",
            name: "Vikram Iyer",
            marks: null
        },
        {
            rollNumber: "21CS009",
            name: "Zara Khan",
            marks: null
        },
        {
            rollNumber: "21CS010",
            name: "Anirudh Joshi",
            marks: null
        }
    ],
    evaluationResults: [
        {
            rollNumber: "21CS001",
            name: "Aadhya Sharma",
            questionMarks: [8, 7, 9, 6, 8],
            totalMarks: 38,
            maxMarks: 50
        },
        {
            rollNumber: "21CS002",
            name: "Arjun Patel",
            questionMarks: [9, 8, 7, 8, 9],
            totalMarks: 41,
            maxMarks: 50
        },
        {
            rollNumber: "21CS003",
            name: "Diya Singh",
            questionMarks: [7, 6, 8, 7, 7],
            totalMarks: 35,
            maxMarks: 50
        },
        {
            rollNumber: "21CS004",
            name: "Karthik Reddy",
            questionMarks: [10, 9, 8, 9, 10],
            totalMarks: 46,
            maxMarks: 50
        },
        {
            rollNumber: "21CS005",
            name: "Meera Nair",
            questionMarks: [8, 7, 9, 8, 8],
            totalMarks: 40,
            maxMarks: 50
        }
    ]
};

// Global state
let currentStep = 1;
let studentsList = [];
let uploadedFiles = {
    questionPaper: null,
    answerKey: null,
    studentPapers: []
};
let evaluationResults = [];

// DOM elements
const elements = {
    // Navigation
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),
    mobileMenu: document.getElementById('mobileMenu'),
    
    // Form elements
    departmentSelect: document.getElementById('department'),
    batchSelect: document.getElementById('batch'),
    semesterSelect: document.getElementById('semester'),
    subjectSelect: document.getElementById('subject'),
    examTypeSelect: document.getElementById('examType'),
    
    // Buttons
    fetchStudentsBtn: document.getElementById('fetchStudentsBtn'),
    uploadAnswerFilesBtn: document.getElementById('uploadAnswerFilesBtn'),
    startEvaluationBtn: document.getElementById('startEvaluationBtn'),
    saveResultsBtn: document.getElementById('saveResultsBtn'),
    downloadExcelBtn: document.getElementById('downloadExcelBtn'),
    
    // Sections
    studentListSection: document.getElementById('studentListSection'),
    fileUploadSection: document.getElementById('fileUploadSection'),
    evaluationSection: document.getElementById('evaluationSection'),
    
    // Tables
    studentTableBody: document.getElementById('studentTableBody'),
    resultsTableBody: document.getElementById('resultsTableBody'),
    
    // Upload areas
    questionPaperUpload: document.getElementById('questionPaperUpload'),
    answerKeyUpload: document.getElementById('answerKeyUpload'),
    studentPapersUpload: document.getElementById('studentPapersUpload'),
    
    // File inputs
    questionPaperInput: document.getElementById('questionPaperInput'),
    answerKeyInput: document.getElementById('answerKeyInput'),
    studentPapersInput: document.getElementById('studentPapersInput'),
    
    // File previews
    questionPaperPreview: document.getElementById('questionPaperPreview'),
    answerKeyPreview: document.getElementById('answerKeyPreview'),
    studentPapersPreview: document.getElementById('studentPapersPreview'),
    
    // Modals
    resultsModal: document.getElementById('resultsModal'),
    
    // Toast notifications
    successToast: document.getElementById('successToast'),
    errorToast: document.getElementById('errorToast'),
    successMessage: document.getElementById('successMessage'),
    errorMessage: document.getElementById('errorMessage'),
    
    // Loading
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingMessage: document.getElementById('loadingMessage'),
    
    // Progress
    progressBar: document.querySelector('.progress-bar'),
    progressText: document.querySelector('.progress-text')
};

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    populateDropdowns();
});

function initializeApp() {
    // Add smooth scrolling
    document.documentElement.style.scrollBehavior = 'smooth';
    
    // Initialize step indicator
    updateStepIndicator(1);
    
    // Initialize form validation
    validateExamDetailsForm();
}

function setupEventListeners() {
    // Mobile menu
    if (elements.mobileMenuBtn) {
        elements.mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }
    
    // Department change
    if (elements.departmentSelect) {
        elements.departmentSelect.addEventListener('change', onDepartmentChange);
    }
    
    // Form validation - add event listeners to all form elements
    const formInputs = [
        elements.departmentSelect, 
        elements.batchSelect, 
        elements.semesterSelect, 
        elements.subjectSelect, 
        elements.examTypeSelect
    ];
    
    formInputs.forEach(input => {
        if (input) {
            input.addEventListener('change', validateExamDetailsForm);
            input.addEventListener('input', validateExamDetailsForm);
        }
    });
    
    // Fetch students button
    if (elements.fetchStudentsBtn) {
        elements.fetchStudentsBtn.addEventListener('click', fetchStudents);
    }
    
    // Upload answer files button
    if (elements.uploadAnswerFilesBtn) {
        elements.uploadAnswerFilesBtn.addEventListener('click', showFileUploadSection);
    }
    
    // File upload event listeners
    setupFileUpload('questionPaper');
    setupFileUpload('answerKey');
    setupFileUpload('studentPapers');
    
    // Start evaluation button
    if (elements.startEvaluationBtn) {
        elements.startEvaluationBtn.addEventListener('click', startEvaluation);
    }
    
    // Results modal buttons
    if (elements.saveResultsBtn) {
        elements.saveResultsBtn.addEventListener('click', saveResults);
    }
    
    if (elements.downloadExcelBtn) {
        elements.downloadExcelBtn.addEventListener('click', downloadExcel);
    }
    
    // Close modal when clicking outside
    if (elements.resultsModal) {
        elements.resultsModal.addEventListener('click', function(e) {
            if (e.target === elements.resultsModal) {
                closeModal('resultsModal');
            }
        });
    }
}

function populateDropdowns() {
    // Populate departments
    if (elements.departmentSelect) {
        appData.departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.name;
            option.textContent = dept.name;
            elements.departmentSelect.appendChild(option);
        });
    }
    
    // Populate batches
    if (elements.batchSelect) {
        appData.batches.forEach(batch => {
            const option = document.createElement('option');
            option.value = batch;
            option.textContent = batch;
            elements.batchSelect.appendChild(option);
        });
    }
    
    // Populate semesters
    if (elements.semesterSelect) {
        appData.semesters.forEach(semester => {
            const option = document.createElement('option');
            option.value = semester;
            option.textContent = `Semester ${semester}`;
            elements.semesterSelect.appendChild(option);
        });
    }
    
    // Populate exam types
    if (elements.examTypeSelect) {
        appData.examTypes.forEach(examType => {
            const option = document.createElement('option');
            option.value = examType;
            option.textContent = examType;
            elements.examTypeSelect.appendChild(option);
        });
    }
}

function onDepartmentChange() {
    const selectedDepartment = elements.departmentSelect?.value;
    const subjectSelect = elements.subjectSelect;
    
    if (!subjectSelect) return;
    
    // Clear existing options
    subjectSelect.innerHTML = '<option value="">Select Subject</option>';
    
    if (selectedDepartment) {
        const department = appData.departments.find(dept => dept.name === selectedDepartment);
        if (department) {
            subjectSelect.disabled = false;
            department.subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject;
                option.textContent = subject;
                subjectSelect.appendChild(option);
            });
        }
    } else {
        subjectSelect.disabled = true;
        subjectSelect.innerHTML = '<option value="">Select Department First</option>';
    }
    
    // Trigger validation after updating subjects
    setTimeout(() => {
        validateExamDetailsForm();
    }, 100);
}

function validateExamDetailsForm() {
    const requiredFields = [
        elements.departmentSelect,
        elements.batchSelect,
        elements.semesterSelect,
        elements.subjectSelect,
        elements.examTypeSelect
    ];
    
    const isValid = requiredFields.every(field => field && field.value && field.value.trim() !== '');
    
    if (elements.fetchStudentsBtn) {
        elements.fetchStudentsBtn.disabled = !isValid;
        
        if (isValid) {
            elements.fetchStudentsBtn.classList.add('pulse');
        } else {
            elements.fetchStudentsBtn.classList.remove('pulse');
        }
    }
}

function fetchStudents() {
    showLoadingOverlay('Fetching student list...');
    
    setTimeout(() => {
        hideLoadingOverlay();
        
        // Use sample students data
        studentsList = [...appData.sampleStudents];
        
        // Update step indicator
        updateStepIndicator(2);
        
        // Show student list section
        if (elements.studentListSection) {
            elements.studentListSection.classList.remove('hidden');
            elements.studentListSection.classList.add('animate-slide-in');
        }
        
        // Populate student table
        populateStudentTable();
        
        // Enable upload button
        if (elements.uploadAnswerFilesBtn) {
            elements.uploadAnswerFilesBtn.disabled = false;
        }
        
        // Scroll to student list
        if (elements.studentListSection) {
            elements.studentListSection.scrollIntoView({ behavior: 'smooth' });
        }
        
        showSuccessToast('Student list fetched successfully!');
    }, 1500);
}

function populateStudentTable() {
    if (!elements.studentTableBody) return;
    
    elements.studentTableBody.innerHTML = '';
    
    studentsList.forEach((student, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 font-medium text-gray-900">${student.rollNumber}</td>
            <td class="px-6 py-4 text-gray-700">${student.name}</td>
            <td class="px-6 py-4">
                <input 
                    type="number" 
                    class="marks-input" 
                    placeholder="--" 
                    min="0" 
                    max="100"
                    data-student-index="${index}"
                    onchange="updateStudentMarks(${index}, this.value)"
                >
            </td>
        `;
        elements.studentTableBody.appendChild(row);
    });
}

function updateStudentMarks(index, marks) {
    if (studentsList[index]) {
        studentsList[index].marks = marks ? parseInt(marks) : null;
    }
}

function showFileUploadSection() {
    // Update step indicator
    updateStepIndicator(3);
    
    // Show file upload section
    if (elements.fileUploadSection) {
        elements.fileUploadSection.classList.remove('hidden');
        elements.fileUploadSection.classList.add('animate-slide-in');
        
        // Scroll to file upload section
        elements.fileUploadSection.scrollIntoView({ behavior: 'smooth' });
    }
}

function setupFileUpload(fileType) {
    const uploadArea = elements[`${fileType}Upload`];
    const fileInput = elements[`${fileType}Input`];
    const preview = elements[`${fileType}Preview`];
    
    if (!uploadArea || !fileInput || !preview) return;
    
    // Click to upload
    uploadArea.addEventListener('click', () => fileInput.click());
    
    // File input change
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            processUploadedFiles(fileType, files);
        }
    });
    
    // Drag and drop
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('drop', (e) => handleFileDrop(e, fileType));
    uploadArea.addEventListener('dragleave', handleDragLeave);
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleFileDrop(e, fileType) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
        processUploadedFiles(fileType, files);
    }
}

function handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
}

function processUploadedFiles(fileType, files) {
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    // Validate file types
    const invalidFiles = files.filter(file => !allowedTypes.includes(file.type));
    if (invalidFiles.length > 0) {
        showErrorToast('Please select valid file types (PDF, DOC, DOCX)');
        return;
    }
    
    // Store files
    if (fileType === 'studentPapers') {
        uploadedFiles[fileType] = files;
    } else {
        uploadedFiles[fileType] = files[0];
    }
    
    // Show file preview
    showFilePreview(fileType, files);
    
    // Validate upload completion
    validateUploadCompletion();
}

function showFilePreview(fileType, files) {
    const uploadArea = elements[`${fileType}Upload`];
    const preview = elements[`${fileType}Preview`];
    
    if (!uploadArea || !preview) return;
    
    // Hide upload content
    const uploadContent = uploadArea.querySelector('.upload-content');
    if (uploadContent) {
        uploadContent.style.display = 'none';
    }
    
    // Show preview
    preview.classList.remove('hidden');
    preview.innerHTML = '';
    
    if (fileType === 'studentPapers') {
        // Show multiple files
        const header = document.createElement('div');
        header.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <span class="font-medium text-gray-900">${files.length} files uploaded</span>
                <button class="remove-file" onclick="removeUploadedFiles('${fileType}')">
                    <i class="ri-close-line"></i>
                </button>
            </div>
        `;
        preview.appendChild(header);
        
        files.forEach(file => {
            const fileItem = createFileItem(file);
            preview.appendChild(fileItem);
        });
    } else {
        // Show single file
        const file = files[0];
        const fileItem = document.createElement('div');
        fileItem.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="file-info">
                    <i class="ri-file-text-line text-2xl text-blue-600"></i>
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">${formatFileSize(file.size)}</span>
                </div>
                <button class="remove-file" onclick="removeUploadedFiles('${fileType}')">
                    <i class="ri-close-line"></i>
                </button>
            </div>
        `;
        preview.appendChild(fileItem);
    }
}

function createFileItem(file) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
        <div class="file-info">
            <i class="ri-file-text-line text-xl text-blue-600"></i>
            <span class="file-name">${file.name}</span>
            <span class="file-size">${formatFileSize(file.size)}</span>
        </div>
    `;
    return fileItem;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function removeUploadedFiles(fileType) {
    const uploadArea = elements[`${fileType}Upload`];
    const preview = elements[`${fileType}Preview`];
    const fileInput = elements[`${fileType}Input`];
    
    if (!uploadArea || !preview || !fileInput) return;
    
    // Clear uploaded files
    uploadedFiles[fileType] = fileType === 'studentPapers' ? [] : null;
    
    // Reset file input
    fileInput.value = '';
    
    // Hide preview and show upload content
    preview.classList.add('hidden');
    const uploadContent = uploadArea.querySelector('.upload-content');
    if (uploadContent) {
        uploadContent.style.display = 'block';
    }
    
    // Validate upload completion
    validateUploadCompletion();
}

function validateUploadCompletion() {
    const hasQuestionPaper = uploadedFiles.questionPaper !== null;
    const hasAnswerKey = uploadedFiles.answerKey !== null;
    const hasStudentPapers = uploadedFiles.studentPapers.length > 0;
    
    const isComplete = hasQuestionPaper && hasAnswerKey && hasStudentPapers;
    
    if (elements.startEvaluationBtn) {
        elements.startEvaluationBtn.disabled = !isComplete;
        
        if (isComplete) {
            elements.startEvaluationBtn.classList.add('pulse');
        } else {
            elements.startEvaluationBtn.classList.remove('pulse');
        }
    }
}

function startEvaluation() {
    // Show evaluation section
    if (elements.evaluationSection) {
        elements.evaluationSection.classList.remove('hidden');
        elements.evaluationSection.classList.add('animate-slide-in');
        
        // Scroll to evaluation section
        elements.evaluationSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Start progress animation
    simulateEvaluation();
}

function simulateEvaluation() {
    let progress = 0;
    const totalSteps = 100;
    const interval = 50;
    
    const progressInterval = setInterval(() => {
        progress += Math.random() * 5;
        
        if (progress >= 100) {
            progress = 100;
            clearInterval(progressInterval);
            
            // Complete evaluation
            setTimeout(() => {
                completeEvaluation();
            }, 1000);
        }
        
        // Update progress
        updateProgress(progress);
        
    }, interval);
}

function updateProgress(progress) {
    const progressDegrees = (progress / 100) * 360;
    if (elements.progressBar) {
        elements.progressBar.style.background = `conic-gradient(#3b82f6 ${progressDegrees}deg, #e5e7eb ${progressDegrees}deg)`;
    }
    if (elements.progressText) {
        elements.progressText.textContent = `${Math.round(progress)}%`;
    }
}

function completeEvaluation() {
    // Hide evaluation section
    if (elements.evaluationSection) {
        elements.evaluationSection.classList.add('hidden');
    }
    
    // Generate evaluation results
    generateEvaluationResults();
    
    // Show results modal
    showResultsModal();
    
    showSuccessToast('Evaluation completed successfully!');
}

function generateEvaluationResults() {
    evaluationResults = studentsList.map(student => {
        // Use sample data or generate random marks
        const sampleResult = appData.evaluationResults.find(r => r.rollNumber === student.rollNumber);
        
        if (sampleResult) {
            return { ...sampleResult };
        } else {
            // Generate random marks for questions
            const questionMarks = Array.from({length: 5}, () => Math.floor(Math.random() * 10) + 1);
            const totalMarks = questionMarks.reduce((sum, mark) => sum + mark, 0);
            
            return {
                rollNumber: student.rollNumber,
                name: student.name,
                questionMarks: questionMarks,
                totalMarks: totalMarks,
                maxMarks: 50
            };
        }
    });
}

function showResultsModal() {
    // Populate results table
    populateResultsTable();
    
    // Show modal
    openModal('resultsModal');
}

function populateResultsTable() {
    if (!elements.resultsTableBody) return;
    
    elements.resultsTableBody.innerHTML = '';
    
    evaluationResults.forEach(result => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-4 py-3 font-medium text-gray-900">${result.rollNumber}</td>
            <td class="px-4 py-3 text-gray-700">${result.name}</td>
            ${result.questionMarks.map((mark, index) => `
                <td class="px-4 py-3 text-center">
                    <input 
                        type="number" 
                        class="question-mark-input" 
                        value="${mark}" 
                        min="0" 
                        max="10"
                        data-student="${result.rollNumber}" 
                        data-question="${index}"
                        onchange="updateQuestionMark('${result.rollNumber}', ${index}, this.value)"
                    >
                </td>
            `).join('')}
            <td class="px-4 py-3 text-center font-semibold text-blue-600" data-total="${result.rollNumber}">
                ${result.totalMarks}
            </td>
        `;
        elements.resultsTableBody.appendChild(row);
    });
}

function updateQuestionMark(rollNumber, questionIndex, newMark) {
    const result = evaluationResults.find(r => r.rollNumber === rollNumber);
    if (result) {
        result.questionMarks[questionIndex] = parseInt(newMark) || 0;
        result.totalMarks = result.questionMarks.reduce((sum, mark) => sum + mark, 0);
        
        // Update total display
        const totalCell = document.querySelector(`[data-total="${rollNumber}"]`);
        if (totalCell) {
            totalCell.textContent = result.totalMarks;
        }
    }
}

function saveResults() {
    showLoadingOverlay('Saving results...');
    
    setTimeout(() => {
        hideLoadingOverlay();
        showSuccessToast('Results saved successfully to database!');
        closeModal('resultsModal');
    }, 2000);
}

function downloadExcel() {
    showLoadingOverlay('Preparing Excel download...');
    
    setTimeout(() => {
        hideLoadingOverlay();
        
        // Create CSV content
        const csvContent = generateCSVContent();
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${elements.subjectSelect?.value || 'Results'}_Results_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        showSuccessToast('Excel file downloaded successfully!');
    }, 1500);
}

function generateCSVContent() {
    const headers = ['Roll Number', 'Student Name', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Total', 'Max Marks', 'Percentage'];
    
    const rows = evaluationResults.map(result => {
        const percentage = ((result.totalMarks / result.maxMarks) * 100).toFixed(2);
        return [
            result.rollNumber,
            result.name,
            ...result.questionMarks,
            result.totalMarks,
            result.maxMarks,
            percentage + '%'
        ];
    });
    
    const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');
    
    return csvContent;
}

function updateStepIndicator(activeStep) {
    currentStep = activeStep;
    
    // Update step items
    for (let i = 1; i <= 3; i++) {
        const stepItem = document.querySelector(`[data-step="${i}"]`);
        const connector = stepItem?.nextElementSibling;
        
        if (stepItem) {
            if (i <= activeStep) {
                stepItem.classList.add('step-active');
            } else {
                stepItem.classList.remove('step-active');
            }
        }
        
        if (connector && connector.classList.contains('step-connector')) {
            if (i < activeStep) {
                connector.classList.add('step-connector-active');
            } else {
                connector.classList.remove('step-connector-active');
            }
        }
    }
}

function toggleMobileMenu() {
    if (!elements.mobileMenu || !elements.mobileMenuBtn) return;
    
    elements.mobileMenu.classList.toggle('hidden');
    const icon = elements.mobileMenuBtn.querySelector('i');
    if (icon) {
        icon.classList.toggle('ri-menu-line');
        icon.classList.toggle('ri-close-line');
    }
}

// Modal functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('show'), 10);
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.style.overflow = 'auto';
        }, 300);
    }
}

// Toast notifications
function showSuccessToast(message) {
    if (!elements.successToast || !elements.successMessage) return;
    
    elements.successMessage.textContent = message;
    elements.successToast.classList.remove('hidden');
    elements.successToast.classList.add('show');
    
    setTimeout(() => {
        elements.successToast.classList.remove('show');
        setTimeout(() => {
            elements.successToast.classList.add('hidden');
        }, 300);
    }, 3000);
}

function showErrorToast(message) {
    if (!elements.errorToast || !elements.errorMessage) return;
    
    elements.errorMessage.textContent = message;
    elements.errorToast.classList.remove('hidden');
    elements.errorToast.classList.add('show');
    
    setTimeout(() => {
        elements.errorToast.classList.remove('show');
        setTimeout(() => {
            elements.errorToast.classList.add('hidden');
        }, 300);
    }, 3000);
}

// Loading overlay
function showLoadingOverlay(message = 'Loading...') {
    if (!elements.loadingOverlay || !elements.loadingMessage) return;
    
    elements.loadingMessage.textContent = message;
    elements.loadingOverlay.classList.add('show');
}

function hideLoadingOverlay() {
    if (!elements.loadingOverlay) return;
    
    elements.loadingOverlay.classList.remove('show');
}

// Global functions for onclick handlers
window.openModal = openModal;
window.closeModal = closeModal;
window.updateStudentMarks = updateStudentMarks;
window.updateQuestionMark = updateQuestionMark;
window.removeUploadedFiles = removeUploadedFiles;