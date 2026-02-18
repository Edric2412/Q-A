# 🎓 All-in-One RAG Assessment Engine

> **Dynamic Creation, Automated Evaluation, and University-Centric Output**

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Google AI](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Stable Baselines3](https://img.shields.io/badge/SB3-PPO-FF6F00?style=for-the-badge&logo=pytorch&logoColor=white)](https://stable-baselines3.readthedocs.io/)
[![Knowledge Tracing](https://img.shields.io/badge/KT-BKT-purple?style=for-the-badge&logo=analytics&logoColor=white)](https://en.wikipedia.org/wiki/Bayesian_Knowledge_Tracing)
[![Neo4j](https://img.shields.io/badge/Neo4j-008CC1?style=for-the-badge&logo=neo4j&logoColor=white)](https://neo4j.com/)

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
- 🤖 **Gemini Vision PDF Grading** — direct handwritten answer evaluation
- 📊 **Concept Mastery Analysis** across question sets
- 📈 **Batch Student Evaluation** with Excel export
- 💡 **Per-question Feedback** generation

### 3️⃣ **Performance Analytics Dashboard**
- 📊 **Score Distribution Histogram** — class-wide performance at a glance
- 🎯 **Per-Question Performance** — identify difficult questions
- 🏆 **Student Rankings** — leaderboard with spark bars
- 🗺️ **Score Heatmap** — student × question color-coded grid
- 🍩 **Pass/Fail Breakdown** — donut chart visualization

### 4️⃣ **AI Tutor (Adaptive Learning)**
- 🧠 **Reinforcement Learning (RL)** — dynamically chooses topics using PPO (Stable-Baselines3)
- 📈 **Knowledge Graph (Neo4j)** — maps syllabus prerequisites for logic-based remediation
- � **Bayesian Knowledge Tracing (BKT)** — tracks probability of concept mastery
- 💬 **Strict Evaluator** — uses generated rubrics to eliminate AI leniency in grading
- 🎮 **Gamified UI** — progress bars, mastery zones, and 2.5 Flash-powered tutor

---

## 🏗️ Architecture

```mermaid
flowchart TB
    subgraph Docker["🐳 Docker Compose"]
        subgraph Frontend["🌐 Frontend — Next.js :3000"]
            direction LR
            D["Dashboard"]
            G["Generator"]
            E["Evaluator"]
            R["Results"]
            A["Analytics"]
        end

        subgraph Backend["⚡ Backend — FastAPI :8000"]
            direction LR
            subgraph GenAPI["Generator API"]
                G1["Syllabus Upload"]
                G2["RAG Generation"]
                G3["DOCX Export"]
            end
            subgraph EvalAPI["Evaluator API"]
                E1["Vision PDF Grading"]
                E2["AI Grading"]
            end
            subgraph LearnAPI["Adaptive Tutor API"]
                L1["RL Policy Engine"]
                L2["BKT Mastery Tracking"]
            end
        end

        subgraph DB["Storage Layer"]
            direction LR
            P["🐘 PostgreSQL :5432"]
            N["🌐 Neo4j Graph :7687"]
        end
    end

    subgraph AI["🤖 AI Models & Embeddings"]
        direction LR
        Flash["Gemini 2.5 Flash (Primary)"]
        Embed["Text Embedding 004"]
        MiniLM["MiniLM-L6-v2 (Local)"]
    end

    Frontend -->|REST API| Backend
    Backend -->|asyncpg| P
    Backend -->|Cypher| N
    Backend -->|SDK| AI
```

**Tech Stack:**
<<<<<<< HEAD
- **Backend:** FastAPI (Python 3.10+), Gemini 2.5 Flash
- **Frontend:** Next.js 16, React 19, TypeScript, Framer Motion
- **Database:** PostgreSQL 16, Neo4j Graph Database (Dockerized)
- **AI/ML:** Reinforcement Learning (PPO – Stable-Baselines3, Gymnasium), Bayesian Knowledge Tracing, Google Generative AI SDK, Sentence-Transformers (MiniLM)
=======
- **Backend:** FastAPI (Python 3.10+), Gemini 3 Flash, Gemini 2.5 Flash
- **Frontend:** Next.js 16, React 19, TypeScript, Recharts
- **Database:** PostgreSQL 16 (on Docker)
- **AI/ML:** LangChain, Google Generative AI, Sentence-Transformers (MiniLM), Reinforcement Learning (PPO – Stable-Baselines3, Gymnasium)
>>>>>>> c6d868641a55b35b95b71b5881447fb090e433aa
- **Charts:** Recharts (score distributions, per-question analysis, heatmaps)
- **Document Processing:** PDFPlumber, python-docx, latex2mathml, pytesseract

---

## ✨ Key Features

### 🎯 Question Generation
- **Smart Syllabus Parsing**: Extracts units from scanned/digital PDFs
- **Multi-format Questions**: Generates MCQs with options, Short Answers, and Long Essays
- **Difficulty Levels**: Easy, Medium, Hard with context-aware generation
- **LaTeX Support**: Mathematical equations rendered natively in Word
- **Knowledge Graph Sync**: Automatically parses syllabus prerequisites into Neo4j
- **Rubric Generation**: Automated marking schemes with keyword extraction

### 🔍 Answer Evaluation
- **Robust Identity Extraction**: Prioritizes Filename > OCR (Tesseract) > Content to identify students.
- **Vision PDF Grading**: Direct handwritten PDF evaluation via Gemini Vision.
- **AI Grading**: Context-aware evaluation against model answers.
- **Authorized Vocabulary**: Forces AI to use syllabus-accurate topic names from Neo4j to prevent hallucination.
- **Concept Extraction**: Identifies knowledge gaps per student.
- **Bulk Processing**: Grade entire classes in minutes.
- **Student Results UI**: Enhanced dashboard with conditional **Max Marks** display (CIA: 1/4/10 marks, Model: 1/5/8 marks).
- **Excel Reports**: Downloadable results with per-question feedback.
- **Record Management**: Delete specific evaluation records directly from UI.

### 📊 Performance Analytics
- **Print-Ready Reports**: Optimised layout for printing charts and insights.
- **Summary Stats**: Class average, highest/lowest score, pass rate.
- **Score Distribution**: Histogram showing mark ranges.
- **Per-Question Analysis**: Bar chart comparing avg vs max per question.
- **Student Rankings**: Leaderboard with gradient performance bars.
- **Score Heatmap**: Color-coded student × question grid.
- **Pass/Fail Donut**: Visual breakdown of pass rates.

### 🧠 Adaptive Learning Tutor
- **RL Action Selection**: Uses PPO (Proximal Policy Optimization) via Stable Baselines 3 to choose optimal topics.
- **Knowledge Graph Remediation**: Uses Neo4j to detect "bottleneck" prerequisites when a student fails a concept.
- **BKT Progression**: Real-time mastery updating using Bayesian Knowledge Tracing.
- **Strict Mode Evaluation**: Uses generated question rubrics to ensure university-level grading strictness.
- **High-Fidelity Skeletons**: Modern shimmer-effect loading states for seamless transitions into AI sessions.
- **Liquid Glass Feedback**: AI feedback presented in a premium "Crystal Pill" badge UI.
- **Manual Progression**: Students review feedback before advancing to the next challenge.

### 🎨 Modern UI/UX
- **macOS Liquid Glass**: Premium translucent design with backdrop blur, specular highlights, and glass refraction borders.
- **Dark/Light Mode**: Full theme support across all pages.
- **SVG Icon System**: Professional inline SVG icons (no emoji).
- **Responsive Layout**: Mobile-first design with breakpoints.
- **Print Optimization**: Dedicated CSS for clean, ink-saving analytics prints.

---

## 📦 Installation

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- Google Cloud API Key ([Gemini](https://ai.google.dev/))

### Quick Start (Docker — Recommended)

```bash
# 1. Clone the repository
git clone <repository-url>
cd QP

# 2. Add your Google API key
echo 'GOOGLE_API_KEY=your_key_here' > .env

# 3. Start everything (PostgreSQL + Neo4j + Backend + Frontend)
docker compose up --build
```

That's it! Open `http://localhost:3000` in your browser.

| Service | URL | Container |
|---------|-----|-----------|
| Frontend | `http://localhost:3000` | qp-frontend |
| Backend API | `http://localhost:8000` | qp-backend |
| PostgreSQL | `localhost:5433` | qp-postgres |
| Neo4j Browser | `http://localhost:7474` | qp-neo4j |
| Neo4j Bolt | `localhost:7687` | qp-neo4j |

### Local Development (without Docker)

<details>
<summary>Click to expand</summary>

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Add GOOGLE_API_KEY and DATABASE_URL
cd app && uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000' > .env.local
npm run dev
```

**Database:**
```bash
sudo docker run -d --name qp-postgres \
  -e POSTGRES_USER=your_username -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=qp -p 5433:5432 postgres:16
```

</details>

---

## 🎮 Usage

### Docker (Single Command)

```bash
# Start all services
docker compose up

# Stop all services
docker compose down

# Rebuild after code changes
docker compose up --build
```

The backend API is available at `http://localhost:8000`, with the evaluator mounted at `/evaluator`.

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

1. **Answer Upload** → PDF/DOCX student papers
2. **Identity Extraction** → Filename Check → OCR Fallback → Content Analysis
3. **Vision Grading (PDF)** → Gemini Vision reads handwritten answers directly
4. **Text Grading (DOCX)** → Text extraction with Regex parsing
5. **Rubric Matching** → AI compares answers against marking schemes
6. **Mark Allocation** → Per-question scoring with feedback
7. **Analytics** → Score distributions, heatmaps, rankings
8. **Export Generation** → Excel with per-question feedback columns
### 🧠 Adaptive Learning Flow

1. **Session Start** → System fetches BKT mastery vector and Neo4j knowledge graph.
2. **Bottleneck Detection** → Checks Neo4j for unmastered prerequisites before selecting new topics.
3. **RL Action Selection** → PPO Policy chooses optimal topic bucket (Low/Med/High).
4. **Context Retrieval** → Fetches concepts from syllabus corresponding to chosen topic.
5. **Adaptive Questioning** → Generated based on dynamic difficulty (Easy/Medium/Hard).
6. **Student Response** → AI grades strictly using the **Session Rubric**.
7. **BKT Update** → Mastery probability updated based on performance.
8. **Trajectory Logging** → State/Action/Reward logged for RL policy improvement.

---

## 📁 Project Structure

```
QP/
├── backend/                 # 🐍 Python API
│   ├── .env                 # Environment variables
│   ├── requirements.txt     # Python dependencies
│   ├── app/
│   │   ├── main.py          # Main FastAPI entry
│   │   ├── core/            # Database & Core Logic
│   │   ├── services/        # AI, RL & Generation logic
│   │   ├── routers/         # API Route Handlers
│   │   ├── resources/       # Models, XSLT, static assets
│   │   ├── utils/           # Shared utility functions
│   │   ├── temp/            # Temporary exports
│   │   └── templates/       # DOCX templates
│   └── scripts/             # Maintenance & migration scripts
│
├── frontend/                # ⚛️ Next.js App
│   ├── app/                 # Pages
│   │   ├── dashboard/       # Main dashboard
│   │   ├── generator/       # Question generator
│   │   ├── evaluate/        # Answer evaluator
│   │   ├── results/         # Evaluation results
│   │   ├── visualizations/  # Analytics charts
│   │   └── paper/           # Paper viewer
│   ├── components/          # React components
│   ├── lib/                 # API client & utilities
│   └── package.json
│
├── docker-compose.yml       # 🐳 Stack orchestration
└── README.md
```

---

## 🔧 Configuration

### Environment Variables

**Root (`.env`)** — used by Docker Compose
```env
GOOGLE_API_KEY=your_gemini_api_key
```

**Backend (`backend/.env`)** — used for local development
```env
GOOGLE_API_KEY=your_gemini_api_key
DATABASE_URL=postgresql://user:pass@localhost:5433/qp
```

**Frontend (`frontend/.env.local`)** — only for local development
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> In Docker, `DATABASE_URL` and `NEXT_PUBLIC_API_URL` are set automatically via `docker-compose.yml`.

### Templates

Custom DOCX templates can be added to `backend/app/templates/` directory:
- `{ExamType}_QP_template.docx` - Question paper format
- `{ExamType}_Answerkey_template.docx` - Answer key format

Use placeholders like `{{subject}}`, `{{Q1}}`, `{{A1}}` for dynamic content.

---

## 🗃️ Database Schema

PostgreSQL 16 with 6 tables. Schema is auto-initialized on startup via `schema.sql`.

```mermaid
erDiagram
    users {
        SERIAL id PK
        VARCHAR email UK
        VARCHAR password
    }
    students {
        SERIAL id PK
        VARCHAR roll_no UK
        VARCHAR name
        VARCHAR email
    }
    question_papers {
        SERIAL id PK
        VARCHAR subject
        JSONB paper
    }
    evaluations {
        SERIAL id PK
        VARCHAR roll_no FK
        VARCHAR exam_id
        JSONB marks
        DECIMAL total
        VARCHAR exam_type
    }
    learning_sessions {
        SERIAL id PK
        VARCHAR session_id UK
        INT student_id FK
        VARCHAR subject
    }
    learning_logs {
        SERIAL id PK
        VARCHAR session_id FK
        INT student_id FK
        VARCHAR topic
        FLOAT score
        INT action_taken
    }

    users ||--o{ learning_sessions : "starts"
    learning_sessions ||--o{ learning_logs : "records"
    users ||--o{ learning_logs : "records"
    students ||--o{ evaluations : "submits"
```

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | Auth | `email`, `password` |
| `students` | Roster | `roll_no`, `email` (linked to user) |
| `learning_sessions` | Adaptive Sessions | `session_id`, `student_id` |
| `learning_logs` | RL Training Data | `session_id`, `topic`, `score`, `reward` |
| `student_progress` | Mastery Map | `student_id`, `topic`, `mastery` |
| `question_papers` | Generated Papers | `subject`, `paper` (JSONB) |
| `evaluations` | Grading Results | `roll_no`, `exam_id`, `total`, `exam_type` |

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
