# 🎓 All-in-One RAG Assessment Engine

> **Dynamic Creation, Automated Evaluation, and University-Centric Output**

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Google AI](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**AI-powered question paper generation and automated grading for educational institutions** – A complete RAG-based assessment workflow from syllabus to graded results.

---

## 🚀 Overview

This project provides a **dual-pipeline architecture** for modern educational assessment:

### 1️⃣ **Question Generator Pipeline**
- 📄 **PDF Syllabus Parsing** with OCR fallback (Gemini Vision)
- 🧠 **RAG-based Question Generation** (MCQ, Short Answer, Long Essay)
- 📐 **LaTeX Math Rendering** in Word documents (MathML → OMML)
- 📝 **University-standard DOCX Export** with customizable templates

### 2️⃣ **Answer Evaluator Pipeline**
- 🔍 **AI-powered Answer Grading** with rubric-based assessment
- 📊 **Concept Mastery Analysis** across question sets
- 📈 **Batch Student Evaluation** with Excel export
- 💡 **Per-question Feedback** generation

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                       │
│  Dashboard • Generator • Evaluator • Results Visualization      │
└────────────────┬────────────────────────────────┬───────────────┘
                 │                                │
    ┌────────────▼───────────┐      ┌────────────▼──────────────┐
    │  Generator API (8000)  │      │  Evaluator API (/eval)    │
    │  • Syllabus Upload     │      │  • Answer Sheet OCR       │
    │  • RAG Generation      │      │  • AI Grading             │
    │  • DOCX Export         │      │  • Concept Analysis       │
    └────────────┬───────────┘      └────────────┬──────────────┘
                 │                                │
                 └────────────┬───────────────────┘
                              │
                 ┌────────────▼──────────────┐
                 │   MongoDB (QP Database)   │
                 │  • Users                  │
                 │  • Question Papers        │
                 │  • Exam Results           │
                 │  • Concept Analytics      │
                 └───────────────────────────┘
```

**Tech Stack:**
- **Backend:** FastAPI (Python 3.10+), Google Gemini 2.5 Flash
- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS v4
- **Database:** MongoDB with Motor (async driver)
- **AI/ML:** LangChain, Google Generative AI Embeddings
- **Document Processing:** PDFPlumber, python-docx, latex2mathml, pytesseract

---

## ✨ Key Features

### 🎯 Question Generation
- **Smart Syllabus Parsing**: Extracts units from scanned/digital PDFs
- **Multi-format Questions**: Generates MCQs with options, Short Answers, and Long Essays
- **Difficulty Levels**: Easy, Medium, Hard with context-aware generation
- **LaTeX Support**: Mathematical equations rendered natively in Word
- **Rubric Generation**: Automated marking schemes with keyword extraction

### 🔍 Answer Evaluation
- **OCR Processing**: Handles scanned answer sheets
- **AI Grading**: Context-aware evaluation against model answers
- **Concept Extraction**: Identifies knowledge gaps per student
- **Bulk Processing**: Grade entire classes in minutes
- **Excel Reports**: Downloadable results with per-question feedback

### 🎨 Modern UI/UX
- **Glassmorphism Design**: Premium dark mode interface
- **3D Particle Backgrounds**: Three.js animated mesh waves
- **Page Transitions**: Smooth framer-motion animations
- **Responsive Layout**: Mobile-first design

---

## 📦 Installation

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB 5.0+
- Google Cloud API Key (Gemini)

### Backend Setup

```bash
# Clone repository
git clone <repository-url>
cd QP

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Add your GOOGLE_API_KEY and MONGO_URI
```

### Frontend Setup

```bash
cd frontend/my-project

# Install dependencies
npm install

# Configure environment
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Run development server
npm run dev
```

### Database Setup

```bash
# Start MongoDB locally or use MongoDB Atlas
mongod --dbpath /path/to/data

# The app will auto-create collections on first run
```

---

## 🎮 Usage

### Start the Backend

```bash
# Terminal 1: Main API (Generator + Evaluator)
uvicorn main:app --reload
```

The evaluator is automatically mounted at `/evaluator` on the same port.

### Start the Frontend

```bash
# Terminal 2: Next.js Dev Server
cd frontend/my-project
npm run dev
```

Access the application at `http://localhost:3000`

### 🔑 API Endpoints

#### Generator Pipeline (`/`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/upload-syllabus` | POST | Upload PDF syllabus, extract units |
| `/generate-questions` | POST | Generate question paper from units |
| `/download-paper` | POST | Export question paper as DOCX |
| `/download-key` | POST | Export answer key as DOCX |
| `/saved-papers` | GET | Retrieve question paper history |

#### Evaluator Pipeline (`/evaluator`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/upload-answers` | POST | Upload answer sheet images/PDFs |
| `/grade-answers` | POST | AI-powered batch grading |
| `/results/{exam_id}` | GET | Retrieve grading results |
| `/download-report` | GET | Export Excel report |
| `/concept-analysis` | GET | View mastery analytics |

---

## 🧠 RAG Workflow

### Question Generation Flow

1. **PDF Upload** → Extract text using PDFPlumber
2. **OCR Fallback** → Gemini Vision API for scanned documents
3. **Unit Splitting** → Regex-based module detection
4. **Chunking** → RecursiveCharacterTextSplitter (4000 chars)
5. **Context Retrieval** → Random sampling of chunks
6. **Prompt Engineering** → Template-based generation
7. **JSON Parsing** → Smart LaTeX escape handling
8. **DOCX Rendering** → MathML → OMML transformation

### Evaluation Flow

1. **Answer Upload** → OCR with Tesseract/Gemini
2. **Answer Matching** → Extract student responses per question
3. **Rubric Parsing** → Tokenize marking scheme
4. **AI Evaluation** → Gemini compares answer to rubric
5. **Mark Allocation** → Per-criterion scoring
6. **Concept Extraction** → Identify assessed skills
7. **Export Generation** → Excel with pivot tables

---

## 📁 Project Structure

```
QP/
├── main.py                  # Generator API
├── main2.py                 # Evaluator API
├── requirements.txt         # Python dependencies
├── templates/               # DOCX templates
│   ├── CIA_QP_template.docx
│   └── Models_QP_template.docx
├── MML2OMML.xsl            # Math transformation stylesheet
├── frontend/
│   └── my-project/
│       ├── app/            # Next.js pages
│       │   ├── dashboard/
│       │   ├── generator/
│       │   ├── evaluate/
│       │   └── results/
│       ├── components/     # React components
│       └── public/         # Static assets
└── uploads/                # Temporary file storage
```

---

## 🔧 Configuration

### Environment Variables

**Backend (`.env`)**
```env
GOOGLE_API_KEY=your_gemini_api_key
MONGO_URI=mongodb://localhost:27017
```

**Frontend (`.env.local`)**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Templates

Custom DOCX templates can be added to `/templates/` directory:
- `{ExamType}_QP_template.docx` - Question paper format
- `{ExamType}_Answerkey_template.docx` - Answer key format

Use placeholders like `{{subject}}`, `{{Q1}}`, `{{A1}}` for dynamic content.

---

## 🎨 LaTeX Math Rendering

The system supports inline LaTeX equations in generated questions:

```latex
$E = mc^2$
$\int_{a}^{b} f(x) dx$
$\frac{\partial}{\partial x} \left( x^2 + y^2 \right)$
```

**Rendering Pipeline:**
1. LaTeX → MathML (via `latex2mathml`)
2. MathML → OMML (via `MML2OMML.xsl`)
3. OMML → Word Equation (native embedding)

This ensures editable, high-fidelity math in exported Word documents

---

## 📄 License

This project is licensed under the **MIT License** - see [LICENSE](LICENSE) for details.

---

<div align="center">
  <strong>Built for the future of education 🚀</strong>
  <br>
  <sub>Empowering educators with AI-driven assessment workflows</sub>
</div>
