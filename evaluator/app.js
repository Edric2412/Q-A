let appData = {};

// Global state
let currentStep = 1;
let studentsList = [];
// FIX: Ensure this variable is defined and accessible
let uploadedFiles = {
    questionPaper: null,
    answerKey: null,
    studentPapers: []
};
let evaluationResults = [];
let uploadedFile = null; // Also check this if it's used globally
// ...
let syllabusUnits = [];

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
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
    setupEventListeners();
    //populateDropdowns();
});

function populateDropdown(elementId, items) {
    const select = document.getElementById(elementId);
    if (!select) return;

    // Clear existing options except the first one
    while (select.options.length > 1) {
        select.remove(1);
    }

    if (items && Array.isArray(items)) {
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item;
            option.textContent = item;
            select.appendChild(option);
        });
    }
    select.disabled = items.length === 0;
}

async function fetchMetadata() {
    try {
        // Use the /evaluator prefix
        const API_URL = '/evaluator/get-metadata';

        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const metadata = await response.json();

        // STORE THE FULL DATA FOR LATER USE
        appData.allDetails = metadata.details; // Store the list of all departments' details
        appData.departments = metadata.departments;

        console.log('Fetched metadata:', appData);

        // 1. Populate ONLY the Department dropdown initially
        if (appData.departments) {
            populateDropdown('department', appData.departments.map(d => d.label));
        }

    } catch (error) {
        console.error('Error fetching metadata:', error);
        showErrorToast('Failed to load metadata.');
    }
}

function initializeApp() {
    // Add smooth scrolling
    document.documentElement.style.scrollBehavior = 'smooth';

    // Initialize step indicator
    updateStepIndicator(1);

    // Initialize form validation
    validateExamDetailsForm();

    // Fetch metadata on app initialization
    fetchMetadata();
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

    // Fix: Attach onSemesterChange to enabling subjects loading
    if (elements.semesterSelect) {
        elements.semesterSelect.addEventListener('change', onSemesterChange);
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
        elements.resultsModal.addEventListener('click', function (e) {
            if (e.target === elements.resultsModal) {
                closeModal('resultsModal');
            }
        });
    }
}

function onDepartmentChange() {
    const selectedDept = elements.departmentSelect.value;

    // 1. Reset dependent dropdowns to prevent mixing data
    ['batch', 'semester', 'subject', 'examType'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = `<option value="">Select ${id.charAt(0).toUpperCase() + id.slice(1)}</option>`;
            el.disabled = true;
        }
    });

    // 2. Find the details for the selected department
    if (selectedDept && appData.allDetails) {
        // Find the object where department name matches selection
        const deptDetails = appData.allDetails.find(d => d.department === selectedDept);

        if (deptDetails) {
            // Save this specific department's details for later (e.g., for onSemesterChange)
            appData.selectedDetails = deptDetails;

            // Populate the dependent dropdowns
            if (deptDetails.batches) populateDropdown('batch', deptDetails.batches);
            if (deptDetails.semesters) populateDropdown('semester', deptDetails.semesters);
            if (deptDetails.exams) populateDropdown('examType', deptDetails.exams);
        } else {
            console.warn(`No details found in DB for department: ${selectedDept}`);
        }
    }

    // 3. Run validation to update button states
    validateExamDetailsForm();
}

function onSemesterChange() {
    const semesterSelect = document.getElementById('semester');
    const subjectSelect = document.getElementById('subject');
    const selectedSemester = semesterSelect.value;

    // Reset subject dropdown
    subjectSelect.innerHTML = '<option value="">Select Subject</option>';
    subjectSelect.disabled = true;

    // Use the details we found in onDepartmentChange
    if (selectedSemester && appData.selectedDetails && appData.selectedDetails.subjects) {
        const subjects = appData.selectedDetails.subjects[selectedSemester];

        if (subjects && Array.isArray(subjects)) {
            subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject;
                option.textContent = subject;
                subjectSelect.appendChild(option);
            });
            subjectSelect.disabled = false;
        }
    }

    validateExamDetailsForm();
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

async function fetchStudents() {
    // Basic validation
    if (!elements.departmentSelect.value || !elements.batchSelect.value) {
        showErrorToast('Please select Department and Batch');
        return;
    }

    showLoadingOverlay('Fetching student list...');

    // Prepare data matches your Pydantic model in main2.py
    const requestData = {
        department: elements.departmentSelect.value,
        batch: elements.batchSelect.value,
        semester: elements.semesterSelect?.value || "",
        subject: elements.subjectSelect?.value || "",
        exam_type: elements.examTypeSelect?.value || "",
        exam_id: crypto.randomUUID() // Generate a unique ID for this exam session
    };

    try {
        // Point to the correct Python backend URL
        const response = await fetch('/evaluator/get-students', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Handle logic if no students returned
        if (!data.students || data.students.length === 0) {
            hideLoadingOverlay();
            showErrorToast('No students found. Check if Batch format matches DB (e.g. "2023 - 2026" vs "2023-2026")');
            return;
        }

        // Store data in global state
        appData.selectedExamId = data.exam_id;
        studentsList = data.students || [];

        hideLoadingOverlay();
        updateStepIndicator(2);

        // Show the student list section
        if (elements.studentListSection) {
            elements.studentListSection.classList.remove('hidden');
            elements.studentListSection.classList.add('animate-slide-in');
        }

        // Populate the table
        populateStudentTable();

        // Enable next steps
        if (elements.uploadAnswerFilesBtn) elements.uploadAnswerFilesBtn.disabled = false;

        // Scroll to the section
        elements.studentListSection.scrollIntoView({ behavior: 'smooth' });

        showSuccessToast(`Successfully fetched ${studentsList.length} students!`);

    } catch (error) {
        hideLoadingOverlay();
        console.error('Error fetching student list:', error);
        showErrorToast('Error fetching student list. Is the backend running?');
    }
}

function populateStudentTable() {
    if (!elements.studentTableBody) return;

    elements.studentTableBody.innerHTML = '';

    // Check if list is empty
    if (!studentsList || studentsList.length === 0) {
        elements.studentTableBody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-gray-500">No students found for this configuration.</td></tr>';
        return;
    }

    studentsList.forEach((student, index) => {
        const row = document.createElement('tr');
        // KEY FIX: Ensure we use student.roll_no and student.name exactly as per MongoDB schema
        row.innerHTML = `
            <td class="px-6 py-4 font-medium text-gray-900">${student.roll_no || 'N/A'}</td>
            <td class="px-6 py-4 text-gray-700">${student.name || 'Unknown'}</td>
            <td class="px-6 py-4">
                <input 
                    type="number" 
                    class="marks-input" 
                    placeholder="--" 
                    min="0" 
                    max="100"
                    data-student-index="${index}"
                    data-question-num="1" 
                    onchange="updateStudentMarks(${index}, this.value, 1)"
                >
            </td>
        `;
        elements.studentTableBody.appendChild(row);
    });
}

async function updateStudentMarks(index, marks, questionNum) {
    if (studentsList[index]) {
        studentsList[index].marks = marks ? parseInt(marks) : null;
        const examId = appData.selectedExamId;
        const rollNo = studentsList[index].roll_no;
        try {
            await fetch('/evaluator/update-marks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exam_id: examId,
                    roll_no: rollNo,
                    question_num: questionNum,
                    new_mark: marks
                })
            });
        } catch (error) {
            console.error('Error updating marks:', error);
            showErrorToast('Failed to update marks');
        }
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

    // Directly call completeEvaluation to start the actual evaluation process
    completeEvaluation();
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

function updateProgress(percent, message) {
    const progressBar = document.querySelector('.progress-bar');
    const progressText = document.querySelector('.progress-text');
    
    // Update the circular progress bar (conic gradient)
    if (progressBar) {
        const degrees = (percent / 100) * 360;
        progressBar.style.background = `conic-gradient(#3b82f6 ${degrees}deg, #e5e7eb ${degrees}deg)`;
    }
    
    // Update text
    if (progressText) {
        progressText.textContent = `${percent}%`;
    }
    
    // Optional: Update loading overlay text if it exists
    if (elements.loadingMessage && message) {
        elements.loadingMessage.textContent = message;
    }
}

let uploadedQuestionPaperPath = null;
let uploadedAnswerKeyPath = null;
let uploadedStudentPapersPaths = [];

async function handleFileUploads(examId) {
    const questionPaperFile = elements.questionPaperInput.files[0];
    const answerKeyFile = elements.answerKeyInput.files[0];
    const studentPaperFiles = Array.from(elements.studentPapersInput.files);

    if (!questionPaperFile || !answerKeyFile || studentPaperFiles.length === 0) {
        showErrorToast('Please upload all required files.');
        return false;
    }

    const formData = new FormData();
    formData.append('question_paper', questionPaperFile);
    formData.append('answer_key', answerKeyFile);
    studentPaperFiles.forEach(file => {
        formData.append('student_papers', file);
    });
    formData.append('exam_id', examId);

    try {
        // FIX: Update URL to include /evaluator prefix
        const response = await fetch('/evaluator/upload-files', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (response.ok && data.files) {
            uploadedQuestionPaperPath = data.files.question_paper;
            uploadedAnswerKeyPath = data.files.answer_key;
            uploadedStudentPapersPaths = data.files.student_papers;
            showSuccessToast('Files uploaded successfully!');
            return true;
        } else {
            showErrorToast('File upload failed: ' + (data.message || 'Unknown error'));
            return false;
        }
    } catch (error) {
        console.error('Error uploading files:', error);
        showErrorToast('Error uploading files. Please try again.');
        return false;
    }
}

async function completeEvaluation() {
    // Hide evaluation section if it was shown previously
    if (elements.evaluationSection) {
        elements.evaluationSection.classList.remove('hidden');
    }

    const examId = appData.selectedExamId; 

    // Step 1: Ensure files are uploaded
    const filesUploaded = await handleFileUploads(examId);
    if (!filesUploaded) {
        return;
    }

    try {
        // Show the evaluation UI section
        if (elements.evaluationSection) {
            elements.evaluationSection.scrollIntoView({ behavior: 'smooth' });
        }
        
        // Reset Progress
        updateProgress(0, "Starting evaluation...");

        const formData = new FormData();
        formData.append('exam_id', examId);
        formData.append('question_paper_path', uploadedQuestionPaperPath);
        formData.append('answer_key_path', uploadedAnswerKeyPath);
        formData.append('student_papers_paths', JSON.stringify(uploadedStudentPapersPaths));
        formData.append('students_list', JSON.stringify(studentsList));

        // Start the Request
        const response = await fetch('/evaluator/evaluate', {
            method: 'POST',
            body: formData,
        });

        // Set up Stream Reader
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            
            // Process all complete JSON objects in the buffer
            buffer = lines.pop(); // Keep the last incomplete chunk in buffer

            for (const line of lines) {
                if (!line.trim()) continue;
                
                try {
                    const data = JSON.parse(line);
                    
                    if (data.type === 'progress') {
                        // UPDATE UI HERE
                        updateProgress(data.value, data.message);
                    } 
                    else if (data.type === 'complete') {
                        // FINISHED
                        if (data.status === 'success') {
                            appData.evaluationResults = data.results; 
                            
                            // Map for table display
                            evaluationResults = data.results.map(r => ({
                                rollNumber: r.roll_no,
                                name: r.name,
                                questionMarks: Object.values(r.marks),
                                totalMarks: r.total,
                                maxMarks: Object.keys(r.marks).length * 10
                            }));

                            showSuccessToast('Evaluation completed successfully!');
                            showResultsModal();
                        }
                    } 
                    else if (data.type === 'error') {
                        showErrorToast('Error: ' + data.message);
                    }
                } catch (e) {
                    console.error("JSON Parse error", e);
                }
            }
        }

    } catch (error) {
        console.error('Error during evaluation:', error);
        showErrorToast('Network error during evaluation.');
    }
}

function generateEvaluationResults() {
    evaluationResults = studentsList.map(student => {
        return {
            rollNumber: student.rollNumber,
            name: student.name,
            marks: {},
            total: 0,
            percentage: 0
        };
    });
}

function showResultsModal() {
    // Populate results table
    populateResultsTable();

    // Show modal
    openModal('resultsModal');
}

function populateResultsTable() {
    // 1. Select the table elements
    const tableHeadRow = document.querySelector('#resultsModal thead tr');
    const tableBody = document.getElementById('resultsTableBody');

    if (!tableHeadRow || !tableBody) return;
    
    // Clear previous content
    tableBody.innerHTML = '';
    
    // Safety check: if no results, just return
    if (!evaluationResults || evaluationResults.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No results to display</td></tr>';
        return;
    }

    // --- DYNAMIC HEADER GENERATION ---
    // Get the number of questions from the first student's result
    const firstStudent = evaluationResults[0];
    const numberOfQuestions = firstStudent.questionMarks.length;

    // Rebuild the Header Row completely
    let headerHtml = `
        <th class="px-4 py-3 text-left font-semibold bg-gray-50 sticky left-0 z-10">Roll Number</th>
        <th class="px-4 py-3 text-left font-semibold bg-gray-50 sticky left-24 z-10">Student Name</th>
    `;

    // Loop to create headers Q1, Q2, Q3... based on actual data
    for (let i = 1; i <= numberOfQuestions; i++) {
        headerHtml += `<th class="px-4 py-3 text-center font-semibold min-w-[60px]">Q${i}</th>`;
    }

    // Add Total column at the end
    headerHtml += `<th class="px-4 py-3 text-center font-semibold bg-gray-50 sticky right-0 z-10">Total</th>`;
    
    tableHeadRow.innerHTML = headerHtml;


    // --- DYNAMIC BODY GENERATION ---
    evaluationResults.forEach(result => {
        const row = document.createElement('tr');
        
        // 1. Student Info (Sticky Columns)
        let rowHtml = `
            <td class="px-4 py-3 font-medium text-gray-900 sticky left-0 bg-white border-r">${result.rollNumber}</td>
            <td class="px-4 py-3 text-gray-700 sticky left-24 bg-white border-r">${result.name}</td>
        `;

        // 2. Question Marks
        result.questionMarks.forEach((mark, index) => {
            rowHtml += `
                <td class="px-2 py-3 text-center">
                    <input 
                        type="number" 
                        class="question-mark-input w-16 text-center border rounded p-1" 
                        value="${mark}" 
                        min="0" 
                        step="0.5"
                        data-student="${result.rollNumber}" 
                        data-question="${index}"
                        onchange="updateQuestionMark('${result.rollNumber}', ${index}, this.value)"
                    >
                </td>
            `;
        });

        // 3. Total (Sticky Column)
        rowHtml += `
            <td class="px-4 py-3 text-center font-bold text-blue-600 sticky right-0 bg-white border-l" data-total="${result.rollNumber}">
                ${result.totalMarks}
            </td>
        `;

        row.innerHTML = rowHtml;
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

async function downloadExcel() {
    // 1. Safety Check
    if (!appData.selectedExamId) {
        showErrorToast("No exam data found to export.");
        return;
    }

    showLoadingOverlay('Generating Excel Report...');

    try {
        // 2. Call the backend API
        // Note: We use the '/evaluator' prefix since you run via main.py
        const response = await fetch(`/evaluator/export-excel?exam_id=${appData.selectedExamId}`, {
            method: 'GET',
        });

        // 3. Check for Server Errors (Crucial!)
        if (!response.ok) {
            const errorText = await response.text(); // Read the error message
            console.error("Server Error:", errorText);
            throw new Error(`Server returned status ${response.status}`);
        }

        // 4. Get the filename from the server (or default to a clean name)
        let filename = `Evaluation_Results_${appData.selectedExamId}.xlsx`;
        const disposition = response.headers.get('Content-Disposition');
        if (disposition && disposition.includes('filename=')) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) { 
                filename = matches[1].replace(/['"]/g, '');
            }
        }

        // 5. Create the Download Link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename; // <-- This fixes the weird "uuid" filename
        document.body.appendChild(link);
        
        // 6. Trigger Download
        link.click();
        
        // 7. Cleanup
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        hideLoadingOverlay();
        showSuccessToast('Excel downloaded successfully!');

    } catch (error) {
        console.error('Download logic failed:', error);
        hideLoadingOverlay();
        showErrorToast('Failed to download Excel. Check console for details.');
    }
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
    
    // FIX: Remove 'hidden' so the element actually displays
    elements.loadingOverlay.classList.remove('hidden');
    
    // Small timeout ensures the CSS transition for opacity works
    setTimeout(() => {
        elements.loadingOverlay.classList.add('show');
    }, 10);
}

function hideLoadingOverlay() {
    if (!elements.loadingOverlay) return;

    elements.loadingOverlay.classList.remove('show');
    
    // Wait for fade-out animation to finish before adding display:none
    setTimeout(() => {
        elements.loadingOverlay.classList.add('hidden');
    }, 300);
}

// Global functions for onclick handlers
window.openModal = openModal;
window.closeModal = closeModal;
window.updateStudentMarks = updateStudentMarks;
window.updateQuestionMark = updateQuestionMark;
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    if (!toast || !toastMessage) return;

    toastMessage.textContent = message;
    toast.className = `toast-notification ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

window.showToast = showToast;

// --- DYNAMIC DATA FETCHING ---
// async function populateDropdowns() {
//     try {
//         const response = await fetch('/departments');
//         if (!response.ok) throw new Error('Failed to fetch departments');
//         const departments = await response.json();
//         const departmentSelect = document.getElementById('department');
//         departmentSelect.innerHTML = '<option value="">Select Department</option>';
//         departments.forEach(dept => {
//             const option = document.createElement('option');
//             option.value = dept.value;
//             option.textContent = dept.label;
//             departmentSelect.appendChild(option);
//         });

//     } catch (error) {
//         showToast('Could not load departments.', 'error');
//     }
// }

// async function onDepartmentChange() {
//     const department = document.getElementById('department').value;
//     const batchSelect = document.getElementById('batch');
//     const semesterSelect = document.getElementById('semester');
//     const subjectSelect = document.getElementById('subject');
//     const examTypeSelect = document.getElementById('examType');
//     [batchSelect, semesterSelect, subjectSelect, examTypeSelect].forEach(sel => {
//         sel.innerHTML = `<option value="">Select...</option>`;
//         sel.disabled = true;
//     });
//     if (!department) return;
//     try {
//         const response = await fetch(`/details/${department}`);
//         if (!response.ok) throw new Error('Failed to fetch details');
//         const details = await response.json();
//         if (details && details.length > 0) {
//             const { batches, semesters, exams } = details[0];
//             populateSelect(batchSelect, batches, "Batch");
//             populateSelect(semesterSelect, semesters, "Semester");
//             populateSelect(examTypeSelect, exams, "Exam Type");
//         }
//     } catch (error) {
//         showToast('Could not load department details.', 'error');
//     } finally {
//         validateForm();
//     }
// }

// async function onSemesterChange() {
//     const department = document.getElementById('department').value;
//     const semester = document.getElementById('semester').value;
//     const subjectSelect = document.getElementById('subject');
//     subjectSelect.innerHTML = '<option value="">Select Subject</option>';
//     subjectSelect.disabled = true;
//     if (!department || !semester) return;
//     try {
//         const response = await fetch(`/details/${department}`);
//         if (!response.ok) throw new Error('Failed to fetch subjects');
//         const details = await response.json();
//         if (details.length > 0 && details[0].subjects?.[semester]) {
//             populateSelect(subjectSelect, details[0].subjects[semester], "Subject");
//         }
//     } catch (error) {
//         showToast('Could not load subjects.', 'error');
//     } finally {
//         validateForm();
//     }
// }

// function populateSelect(selectElement, options, type) {
//     selectElement.innerHTML = `<option value="">Select ${type}</option>`;
//     options.forEach(option => {
//         const opt = document.createElement('option');
//         opt.value = option;
//         opt.textContent = option;
//         selectElement.appendChild(opt);
//     });
//     selectElement.disabled = false;
// }

// // Call populateDropdowns on page load


// window.onDepartmentChange = onDepartmentChange;
// window.onSemesterChange = onSemesterChange;

// function validateForm() {
//     const fields = ['department', 'batch', 'semester', 'subject', 'examType'];
//     const allFieldsFilled = fields.every(id => {
//         const el = document.getElementById(id);
//         return el && el.value;
//     });
//     const fileUploaded = typeof uploadedFile !== 'undefined' && uploadedFile !== null;
//     const unitsSelected = document.querySelectorAll('.unit-checkbox:checked').length > 0;

//     const generateBtn = document.getElementById('generateBtn');
//     if (generateBtn) {
//         generateBtn.disabled = !(allFieldsFilled && fileUploaded && unitsSelected);
//     }
// }

// window.validateForm = validateForm;