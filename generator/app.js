// --- GLOBAL STATE ---
let collegeData = {
    name: "Kumaraguru College of Liberal Arts & Science",
    shortName: "KCLAS",
    address: "Coimbatore, Tamil Nadu, India"
};

let generatedQuestions = [];
let currentQuestionId = 0;
let currentEditingQuestion = null;
let uploadedFile = null;
let syllabusUnits = [];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    console.log('Initializing application...');
    createIndividualAnswerModal();
    addAnswerTextareaToEditModal();
    setupEventListeners();
    populateDropdowns();
    hideLoadingOverlay();
}

// --- DYNAMIC UI CREATION ---
function createIndividualAnswerModal() {
    if (document.getElementById('individualAnswerModal')) return;
    const modalHTML = `
        <div id="individualAnswerModal" class="modal hidden">
            <div class="modal-backdrop" onclick="closeModal('individualAnswerModal')"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="individualAnswerModalTitle" class="text-2xl font-bold text-blue-900">Answer</h3>
                    <button onclick="closeModal('individualAnswerModal')" class="modal-close"><i class="ri-close-line"></i></button>
                </div>
                <div class="modal-body" id="individualAnswerModalBody" style="font-family: Arial, sans-serif; font-size: 11pt;">
                    <!-- Individual answer content will be injected here -->
                </div>
                <div class="modal-footer">
                    <button type="button" onclick="closeModal('individualAnswerModal')" class="btn-secondary">Close</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function addAnswerTextareaToEditModal() {
    const form = document.getElementById('questionForm');
    if (form && !document.getElementById('questionAnswer')) {
        const answerDiv = document.createElement('div');
        answerDiv.className = 'form-group';
        answerDiv.innerHTML = `
            <label class="form-label">Answer Key</label>
            <textarea id="questionAnswer" class="form-input" rows="8" placeholder="Enter the full answer key, including rubric and keywords if applicable."></textarea>
        `;
        form.appendChild(answerDiv);
    }
}


// --- EVENT LISTENERS ---
function setupEventListeners() {
    console.log('Setting up event listeners...');
    document.getElementById('mobileMenuBtn')?.addEventListener('click', toggleMobileMenu);
    document.getElementById('learnMoreBtn')?.addEventListener('click', () => {
        document.getElementById('configuration')?.scrollIntoView({ behavior: 'smooth' });
    });
    document.getElementById('department')?.addEventListener('change', onDepartmentChange);
    document.getElementById('semester')?.addEventListener('change', onSemesterChange);
    ['department', 'batch', 'semester', 'subject', 'examType', 'difficulty', 'duration'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', validateForm);
    });
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    if (uploadArea && fileInput) {
        uploadArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileSelect);
        ['dragover', 'drop', 'dragleave'].forEach(eventName => uploadArea.addEventListener(eventName, preventDefaults, false));
        ['dragenter', 'dragover'].forEach(eventName => uploadArea.addEventListener(eventName, () => uploadArea.classList.add('drag-over'), false));
        ['dragleave', 'drop'].forEach(eventName => uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('drag-over'), false));
        uploadArea.addEventListener('drop', handleFileDrop);
    }
    document.getElementById('removeFile')?.addEventListener('click', removeFileHandler);
    document.getElementById('generateBtn')?.addEventListener('click', generateQuestions);
    document.getElementById('addQuestionBtn')?.addEventListener('click', () => openQuestionModal());
    document.getElementById('saveQuestion')?.addEventListener('click', saveQuestionHandler);
    document.getElementById('questionType')?.addEventListener('change', toggleMCQOptions);
    document.querySelectorAll('.export-btn').forEach(btn => btn.addEventListener('click', handleExport));

    // Calendar-based Month & Year selection event listeners
    const durationInput = document.getElementById('duration');
    const calendarDropdown = document.getElementById('calendarDropdown');
    const yearView = document.getElementById('yearView');
    const monthView = document.getElementById('monthView');
    const backToYearViewBtn = document.getElementById('backToYearView');

    if (durationInput && calendarDropdown) {
        durationInput.addEventListener('click', (e) => {
            e.stopPropagation();
            calendarDropdown.classList.toggle('hidden');
            if (!calendarDropdown.classList.contains('hidden')) {
                populateYearView();
            }
        });

        document.addEventListener('click', (e) => {
            if (!calendarDropdown.contains(e.target) && e.target !== durationInput) {
                calendarDropdown.classList.add('hidden');
            }
        });
    }

    if (backToYearViewBtn) {
        backToYearViewBtn.addEventListener('click', () => {
            monthView.classList.add('hidden');
            yearView.classList.remove('hidden');
            backToYearViewBtn.classList.add('hidden');
        });
    }
}

function populateYearView() {
    const yearView = document.getElementById('yearView');
    yearView.innerHTML = '';
    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 5; year <= currentYear + 5; year++) {
        const yearBtn = document.createElement('button');
        yearBtn.textContent = year;
        yearBtn.className = 'btn-secondary p-2 rounded-lg hover:bg-blue-100';
        yearBtn.addEventListener('click', () => {
            populateMonthView(year);
            yearView.classList.add('hidden');
            document.getElementById('monthView').classList.remove('hidden');
            document.getElementById('backToYearView').classList.remove('hidden');
        });
        yearView.appendChild(yearBtn);
    }
}

function populateMonthView(year) {
    const monthView = document.getElementById('monthView');
    monthView.innerHTML = '';
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    months.forEach((month, index) => {
        const monthBtn = document.createElement('button');
        monthBtn.textContent = month;
        monthBtn.className = 'btn-secondary p-2 rounded-lg hover:bg-blue-100';
        monthBtn.addEventListener('click', () => {
            const selectedValue = `${month} ${year}`;
            document.getElementById('duration').value = selectedValue;
            document.getElementById('calendarDropdown').classList.add('hidden');
            document.getElementById('monthView').classList.add('hidden');
            document.getElementById('yearView').classList.remove('hidden');
            document.getElementById('backToYearView').classList.add('hidden');
            validateForm();
        });
        monthView.appendChild(monthBtn);
    });
}

// --- DYNAMIC DATA FETCHING ---
async function populateDropdowns() {
    try {
        const response = await fetch('/departments');
        if (!response.ok) throw new Error('Failed to fetch departments');
        const departments = await response.json();
        const departmentSelect = document.getElementById('department');
        departmentSelect.innerHTML = '<option value="">Select Department</option>';
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.value;
            option.textContent = dept.label;
            departmentSelect.appendChild(option);
        });

    } catch (error) {
        showToast('Could not load departments.', 'error');
    }
}

async function onDepartmentChange() {
    const department = document.getElementById('department').value;
    const batchSelect = document.getElementById('batch');
    const semesterSelect = document.getElementById('semester');
    const subjectSelect = document.getElementById('subject');
    const examTypeSelect = document.getElementById('examType');
    [batchSelect, semesterSelect, subjectSelect, examTypeSelect].forEach(sel => {
        sel.innerHTML = `<option value="">Select...</option>`;
        sel.disabled = true;
    });
    if (!department) return;
    try {
        const response = await fetch(`/details/${department}`);
        if (!response.ok) throw new Error('Failed to fetch details');
        const details = await response.json();
        if (details && details.length > 0) {
            const { batches, semesters, exams } = details[0];
            populateSelect(batchSelect, batches, "Batch");
            populateSelect(semesterSelect, semesters, "Semester");
            populateSelect(examTypeSelect, exams, "Exam Type");
        }
    } catch (error) {
        showToast('Could not load department details.', 'error');
    } finally {
        validateForm();
    }
}

async function onSemesterChange() {
    const department = document.getElementById('department').value;
    const semester = document.getElementById('semester').value;
    const subjectSelect = document.getElementById('subject');
    subjectSelect.innerHTML = '<option value="">Select Subject</option>';
    subjectSelect.disabled = true;
    if (!department || !semester) return;
    try {
        const response = await fetch(`/details/${department}`);
        if (!response.ok) throw new Error('Failed to fetch subjects');
        const details = await response.json();
        if (details.length > 0 && details[0].subjects?.[semester]) {
            populateSelect(subjectSelect, details[0].subjects[semester], "Subject");
        }
    } catch (error) {
        showToast('Could not load subjects.', 'error');
    } finally {
        validateForm();
    }
}

function populateSelect(selectElement, options, type) {
    selectElement.innerHTML = `<option value="">Select ${type}</option>`;
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        selectElement.appendChild(opt);
    });
    selectElement.disabled = false;
}

// --- FILE HANDLING ---
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) processFile(file);
}

function handleFileDrop(e) {
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
}

async function processFile(file) {
    if (file.type !== 'application/pdf') {
        showToast('Please select a valid PDF file.', 'error');
        return;
    }
    uploadedFile = file;
    updateFilePreview(file.name, formatFileSize(file.size));
    const formData = new FormData();
    formData.append('file', uploadedFile);
    showLoadingOverlay('Uploading and processing syllabus...');
    try {
        const response = await fetch('/upload-syllabus', { method: 'POST', body: formData });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to process syllabus');
        }
        const data = await response.json();
        syllabusUnits = data.units || [];
        if (syllabusUnits.length > 0) {
            displaySyllabusUnits();
            showToast('Syllabus processed successfully!', 'success');
        } else {
            throw new Error('No units could be extracted from the syllabus.');
        }
    } catch (error) {
        showToast(error.message, 'error');
        removeFileHandler();
    } finally {
        hideLoadingOverlay();
        validateForm();
    }
}

function updateFilePreview(name, size) {
    document.getElementById('fileName').textContent = name;
    document.getElementById('fileSize').textContent = size;
    document.querySelector('.upload-content').style.display = 'none';
    document.getElementById('filePreview').classList.remove('hidden');
}

function removeFileHandler() {
    uploadedFile = null;
    syllabusUnits = [];
    document.getElementById('filePreview').classList.add('hidden');
    document.querySelector('.upload-content').style.display = 'block';
    document.getElementById('fileInput').value = '';
    document.getElementById('unitsSelection').classList.add('hidden');
    document.getElementById('unitsList').innerHTML = '';
    validateForm();
}

function displaySyllabusUnits() {
    const unitsList = document.getElementById('unitsList');
    unitsList.innerHTML = '';
    syllabusUnits.forEach((unit, index) => {
        const unitId = `unit-${index}`;
        const unitElement = document.createElement('div');
        unitElement.innerHTML = `
            <label for="${unitId}" class="flex items-center space-x-3 cursor-pointer p-2 rounded-lg hover:bg-blue-100">
                <input type="checkbox" id="${unitId}" data-index="${index}" class="unit-checkbox h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                <span class="text-blue-800">${unit.unit}</span>
            </label>
        `;
        unitsList.appendChild(unitElement);
    });
    document.getElementById('unitsSelection').classList.remove('hidden');
    document.getElementById('selectAllUnits').addEventListener('change', (e) => {
        document.querySelectorAll('.unit-checkbox').forEach(cb => cb.checked = e.target.checked);
        validateForm();
    });
    document.querySelectorAll('.unit-checkbox').forEach(cb => {
        cb.addEventListener('change', validateForm);
    });
}

// --- CORE LOGIC: QUESTION GENERATION ---
async function generateQuestions() {
    const generateBtn = document.getElementById('generateBtn');
    if (generateBtn.disabled) return;
    showLoadingOverlay('Generating question paper... This may take a moment.');
    try {
        const selectedUnits = Array.from(document.querySelectorAll('.unit-checkbox:checked'))
            .map(cb => syllabusUnits[parseInt(cb.dataset.index)]);
        const payload = {
            selected_units: selectedUnits,
            subject: document.getElementById('subject').value,
            exam_type: document.getElementById('examType').value,
            difficulty: document.getElementById('difficulty').value
        };
        const response = await fetch('/generate-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to generate questions');
        }
        const data = await response.json();
        processGeneratedData(data.question_paper);
        document.getElementById('questionBuilder').classList.remove('hidden');
        document.getElementById('exportOptions').classList.remove('hidden');
        document.getElementById('questionBuilder').scrollIntoView({ behavior: 'smooth' });
        showToast('Questions generated successfully!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoadingOverlay();
    }
}

function processGeneratedData(paper) {
    generatedQuestions = [];
    currentQuestionId = 0;
    const addQuestion = (q, type) => {
        generatedQuestions.push({
            id: ++currentQuestionId,
            type: type,
            text: q.question,
            answer: q.answer,
            marks: q.marks
        });
    };
    paper.MCQ.forEach(q => addQuestion(q, 'MCQ'));
    paper.Short.forEach(q => addQuestion(q, 'Short Answer'));
    paper.Long.forEach(q => addQuestion(q, 'Long Essay'));
    renderQuestions();
}

// --- UI RENDERING & MANAGEMENT ---
function renderQuestions() {
    const questionsList = document.getElementById('questionsList');
    questionsList.innerHTML = ''; // Clear previous content

    const sections = {
        'A': { title: 'MCQ', questions: generatedQuestions.filter(q => q.type === 'MCQ') },
        'B': { title: 'Short Answer', questions: generatedQuestions.filter(q => q.type === 'Short Answer') },
        'C': { title: 'Long Essay', questions: generatedQuestions.filter(q => q.type === 'Long Essay') }
    };

    let questionCounter = 1;

    for (const [key, sec] of Object.entries(sections)) {
        if (sec.questions.length > 0) {
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'mb-8';
            sectionDiv.innerHTML = `<h3 class="text-2xl font-bold text-blue-800 border-b-2 border-blue-200 pb-2 mb-4">Section ${key}</h3>`;
            
            if (key === 'A') {
                sec.questions.forEach(q => {
                    sectionDiv.appendChild(createQuestionCard(q, `${questionCounter++}`));
                });
            } else {
                for (let i = 0; i < sec.questions.length; i += 2) {
                    const q1 = sec.questions[i];
                    const q2 = sec.questions[i + 1];
                    sectionDiv.appendChild(createQuestionCard(q1, `${questionCounter}.a`));
                    if (q2) {
                        sectionDiv.appendChild(createQuestionCard(q2, `${questionCounter}.b`));
                    }
                    questionCounter++;
                }
            }
            questionsList.appendChild(sectionDiv);
        }
    }
    if (generatedQuestions.length === 0) {
        questionsList.innerHTML = `<p class="text-center text-blue-700">No questions generated yet.</p>`;
    }
}


function createQuestionCard(question, number) {
    const card = document.createElement('div');
    card.className = 'question-card';
    const questionTextHtml = question.text.replace(/\n/g, '<br>');
    card.innerHTML = `
        <div class="question-header">
            <div class="flex items-center space-x-4">
                <div class="question-number">${number}</div>
                <div class="flex items-center space-x-3">
                    <span class="question-type-badge ${'badge-' + question.type.toLowerCase().replace(' ', '-')}">${question.type}</span>
                    <span class="text-sm font-semibold text-blue-700">${question.marks} marks</span>
                </div>
            </div>
            <div class="question-actions">
                <button class="answer-btn" onclick="showIndividualAnswer(${question.id})"><i class="ri-eye-line mr-1"></i>Answer</button>
                <button class="edit-btn" onclick="editQuestion(${question.id})"><i class="ri-edit-line mr-1"></i>Edit</button>
                <button class="delete-btn" onclick="deleteQuestion(${question.id})"><i class="ri-delete-bin-line mr-1"></i>Delete</button>
            </div>
        </div>
        <div class="question-content"><p class="text-blue-900 font-medium leading-relaxed">${questionTextHtml}</p></div>`;
    return card;
}

// --- QUESTION CRUD & ANSWER VIEWING ---
function showIndividualAnswer(questionId) {
    const question = generatedQuestions.find(q => q.id === questionId);
    if (!question) return;

    const modalTitle = document.getElementById('individualAnswerModalTitle');
    const modalBody = document.getElementById('individualAnswerModalBody');
    
    modalTitle.innerText = `Answer for Question`;
    modalBody.innerHTML = formatAnswerForDisplay(question);

    openModal('individualAnswerModal');
}

function editQuestion(questionId) {
    const question = generatedQuestions.find(q => q.id === questionId);
    if (!question) return;
    currentEditingQuestion = question;
    document.getElementById('questionText').value = question.text;
    document.getElementById('questionMarks').value = question.marks;
    document.getElementById('questionType').value = question.type;
    document.getElementById('questionAnswer').value = question.answer;
    toggleMCQOptions();
    openModal('questionModal');
}

function deleteQuestion(questionId) {
    if (confirm('Are you sure you want to delete this question?')) {
        generatedQuestions = generatedQuestions.filter(q => q.id !== questionId);
        renderQuestions();
    }
}

function saveQuestionHandler() {
    const text = document.getElementById('questionText').value.trim();
    const marks = parseInt(document.getElementById('questionMarks').value);
    const type = document.getElementById('questionType').value;
    const answer = document.getElementById('questionAnswer').value.trim();

    if (!text || !marks || !type) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    const questionData = { text, marks, type, answer };
    if (currentEditingQuestion) {
        Object.assign(currentEditingQuestion, questionData);
    } else {
        questionData.id = ++currentQuestionId;
        generatedQuestions.push(questionData);
    }
    renderQuestions();
    closeModal('questionModal');
}

// --- EXPORT & PREVIEW ---
function handleExport(e) {
    const action = e.currentTarget.dataset.action;
    switch (action) {
        case 'preview-paper': previewPaper(); break;
        case 'download-paper': downloadDocxPaper(); break; // UPDATED
        case 'preview-key': previewAnswerKey(); break;
        case 'download-key': downloadDocxAnswerKey(); break; // UPDATED
    }
}

function previewPaper() {
    document.getElementById('paperPreview').innerHTML = generatePaperHTML();
    openModal('previewModal');
}

function previewAnswerKey() {
    document.getElementById('answerKeyPreview').innerHTML = generateAnswerKeyHTML();
    openModal('answerKeyModal');
}

// --- NEW DOCX DOWNLOAD FUNCTIONS ---
async function downloadDocx(endpoint, fileType) {
    const subject = document.getElementById('subject').value || 'Subject';
    const filename = `${subject}_${fileType}.docx`;
    
    showLoadingOverlay(`Generating ${fileType} DOCX file...`);

    try {
        const payload = {
            department: document.getElementById('department').value,
            batch: document.getElementById('batch').value,
            semester: document.getElementById('semester').value,
            subject: document.getElementById('subject').value,
            examType: document.getElementById('examType').value,
            duration: document.getElementById('duration').value,
            paperSetter: document.getElementById('paperSetter').value,
            hod: document.getElementById('hod').value,
            questions: generatedQuestions
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Failed to generate ${fileType}`);
        }

        const blob = await response.blob();
        simulateDownload(filename, URL.createObjectURL(blob));

    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoadingOverlay();
    }
}

function downloadDocxPaper() {
    downloadDocx('/download-paper', 'Question_Paper');
}

function downloadDocxAnswerKey() {
    downloadDocx('/download-key', 'Answer_Key');
}

// --- HTML GENERATION (FOR PREVIEW) - NO CHANGES NEEDED BELOW ---
function generatePaperHTML() {
    const subject = document.getElementById('subject').value || 'N/A';
    const examType = document.getElementById('examType').value || 'N/A';
    const duration = document.getElementById('duration').value || 'N/A';

    let html = `<!DOCTYPE html><html><head><title>Question Paper</title>
        <style>
            body { font-family: 'Times New Roman', serif; margin: 40px; font-size: 12pt; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { font-size: 16pt; margin:0; } .header h2 { font-size: 14pt; margin:0; }
            .details { display: flex; justify-content: space-between; margin: 15px 0; font-weight: bold; }
            .section-title { text-align: center; font-weight: bold; margin: 25px 0 15px; }
            .question-pair { margin-bottom: 15px; }
            .question-header { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .question-text { padding-left: 20px; }
            .or-choice { text-align: center; font-weight: bold; margin: 5px 0; }
        </style></head><body>
            <div class="header"><h1>${collegeData.name}</h1><h2>${examType} Examination</h2></div>
            <div class="details"><span>Subject: ${subject}</span><span>Month & Year: ${duration}</span></div><hr>`;

    const sections = {
        'A': { title: 'MCQ', questions: generatedQuestions.filter(q => q.type === 'MCQ') },
        'B': { title: 'Short Answer', questions: generatedQuestions.filter(q => q.type === 'Short Answer') },
        'C': { title: 'Long Essay', questions: generatedQuestions.filter(q => q.type === 'Long Essay') }
    };

    let questionCounter = 1;
    for (const [key, sec] of Object.entries(sections)) {
        if (sec.questions.length > 0) {
            html += `<div class="section-title">SECTION ${key}</div>`;
            if (key === 'A') { // MCQs are listed individually
                sec.questions.forEach((q) => {
                    html += `<div class="question-pair">
                        <div class="question-header"><span><b>${questionCounter++}.</b></span><span>[${q.marks} Mark]</span></div>
                        <div class="question-text">${q.text.replace(/\n/g, '<br>')}</div>
                    </div>`;
                });
            } else { // Short and Long answers are paired with "OR"
                for (let i = 0; i < sec.questions.length; i += 2) {
                    const q1 = sec.questions[i];
                    const q2 = sec.questions[i + 1];
                    html += `<div class="question-pair">
                        <div class="question-header"><span><b>${questionCounter}. (a)</b></span><span>[${q1.marks} Marks]</span></div>
                        <div class="question-text">${q1.text.replace(/\n/g, '<br>')}</div>`;
                    if (q2) {
                        html += `<div class="or-choice">OR</div>
                        <div class="question-header"><span><b>(b)</b></span><span>[${q2.marks} Marks]</span></div>
                        <div class="question-text">${q2.text.replace(/\n/g, '<br>')}</div>`;
                    }
                    html += `</div>`;
                    questionCounter++;
                }
            }
        }
    }
    html += '</body></html>';
    return html;
}

function formatAnswerForDisplay(question) {
    const answerText = question.answer || 'No answer provided.';
    let rubricPart = '';
    let keywordsPart = '';
    let html = '';

    if (answerText.includes('**Keywords:**')) {
        const parts = answerText.split('**Keywords:**');
        rubricPart = parts[0].trim();
        keywordsPart = parts[1].trim();
    } else {
        rubricPart = answerText.trim();
    }

    if (question.type === 'MCQ') {
        html += `<div class="answer-mcq">${rubricPart.replace(/\\n/g, '<br>')}</div>`;
    } else {
        const rubricItems = rubricPart.split(/\\n- /).filter(item => item.trim() !== '');
        html += `<div class="rubric"><b>Answer:</b><ul>`;
        rubricItems.forEach(item => {
            html += `<li>${item.trim().replace(/\\n/g, '<br>')}</li>`;
        });
        html += `</ul></div>`;

        if (keywordsPart) {
            html += `<div class="keywords"><b>Keywords:</b> ${keywordsPart}</div>`;
        }
    }
    return html;
}

function generateAnswerKeyHTML() {
    const subject = document.getElementById('subject').value || 'N/A';
    let html = `<!DOCTYPE html><html><head><title>Answer Key</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; font-size: 11pt; }
            .header { text-align: center; margin-bottom: 20px; }
            .question-block { margin-bottom: 20px; page-break-inside: avoid; border-bottom: 1px dashed #ccc; padding-bottom: 15px; }
            .question-title { font-weight: bold; font-size: 12pt; margin-bottom: 10px; }
            .answer-block { border-left: 3px solid #007bff; padding-left: 15px; margin-top: 5px; }
            .answer-mcq { font-weight: bold; }
            .rubric ul { list-style-type: disc; margin: 0; padding-left: 20px; }
            .rubric li { margin-bottom: 5px; }
            .keywords { margin-top: 10px; font-size: 10pt; color: #333; }
            .keywords b { color: #000; }
        </style></head><body>
            <div class="header"><h1>Answer Key</h1><h2>${subject}</h2></div><hr>`;

    let questionCounter = 1;
    const sections = {
        'A': { questions: generatedQuestions.filter(q => q.type === 'MCQ') },
        'B': { questions: generatedQuestions.filter(q => q.type === 'Short Answer') },
        'C': { questions: generatedQuestions.filter(q => q.type === 'Long Essay') }
    };

    for (const [key, sec] of Object.entries(sections)) {
        if (sec.questions.length > 0) {
            if (key === 'A') {
                sec.questions.forEach(q => {
                    html += `<div class="question-block">
                        <div class="question-title">${questionCounter++}. ${q.text.split('\n')[0]} [${q.type} - ${q.marks} Marks]</div>
                        <div class="answer-block">${formatAnswerForDisplay(q)}</div>
                    </div>`;
                });
            } else {
                for (let i = 0; i < sec.questions.length; i += 2) {
                    const q1 = sec.questions[i];
                    const q2 = sec.questions[i+1];
                    html += `<div class="question-block">
                        <div class="question-title">${questionCounter}. (a) ${q1.text.split('\n')[0]} [${q1.type} - ${q1.marks} Marks]</div>
                        <div class="answer-block">${formatAnswerForDisplay(q1)}</div>
                    </div>`;
                     if (q2) {
                        html += `<div class="question-block">
                            <div class="question-title">${questionCounter}. (b) ${q2.text.split('\n')[0]} [${q2.type} - ${q2.marks} Marks]</div>
                            <div class="answer-block">${formatAnswerForDisplay(q2)}</div>
                        </div>`;
                    }
                    questionCounter++;
                }
            }
        }
    }
    
    html += '</body></html>';
    return html;
}

// --- UTILITY & HELPER FUNCTIONS ---
function validateForm() {
    const fields = ['department', 'batch', 'semester', 'subject', 'examType', 'difficulty', 'duration'];
    const allFieldsFilled = fields.every(id => document.getElementById(id)?.value);
    const fileUploaded = uploadedFile !== null;
    const unitsSelected = document.querySelectorAll('.unit-checkbox:checked').length > 0;
    document.getElementById('generateBtn').disabled = !(allFieldsFilled && fileUploaded && unitsSelected);
}

function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    const icon = document.getElementById('mobileMenuBtn').querySelector('i');
    mobileMenu.classList.toggle('hidden');
    icon.classList.toggle('ri-menu-line');
    icon.classList.toggle('ri-close-line');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function simulateDownload(filename, url) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`${filename} downloaded!`, 'success');
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal?.classList.remove('hidden');
    setTimeout(() => modal?.classList.add('show'), 10);
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal?.classList.remove('show');
    setTimeout(() => {
        modal?.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }, 300);
}

function openQuestionModal() {
    document.getElementById('questionForm').reset();
    currentEditingQuestion = null;
    toggleMCQOptions();
    openModal('questionModal');
}

function toggleMCQOptions() {
    const type = document.getElementById('questionType').value;
    document.getElementById('mcqOptions').classList.toggle('hidden', type !== 'MCQ');
}

function showLoadingOverlay(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    overlay.querySelector('p').textContent = message;
    overlay.classList.add('show');
}

function hideLoadingOverlay() {
    document.getElementById('loadingOverlay').classList.remove('show');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.querySelector('p').textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Make functions globally accessible
window.openModal = openModal;
window.closeModal = closeModal;
window.editQuestion = editQuestion;
window.deleteQuestion = deleteQuestion;
window.showIndividualAnswer = showIndividualAnswer;