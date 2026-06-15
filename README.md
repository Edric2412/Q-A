# 🎓 All-in-One RAG Assessment & Adaptive Learning Engine

> **Dynamic Creation, Automated Evaluation, and Personalized Learning Optimization**

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

**AI-powered question paper generation and automated grading for educational institutions along with an adaptive learning platform for students** – A complete RAG-based assessment workflow from syllabus to graded results to student subject mastery

---

## 🚀 Overview

This project provides a **tri-pipeline architecture** for modern educational assessment:

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

![Architecture Diagram](architecture.png)

**Tech Stack:**
- **Backend:** FastAPI (Python 3.10+), Gemini 2.5 Flash
- **Frontend:** Next.js 16, React 19, TypeScript, Framer Motion
- **Database:** PostgreSQL 16, Neo4j Graph Database (Dockerized)
- **AI/ML:** Reinforcement Learning (PPO – Stable-Baselines3, Gymnasium), Bayesian Knowledge Tracing, Google Generative AI SDK, Sentence-Transformers (MiniLM), Langchain (prompt template handling)
- **Charts:** Recharts (score distributions, per-question analysis, heatmaps)
- **Document Processing:** PDFPlumber, python-docx, latex2mathml, pytesseract

---

## ✨ Key Features

| 📝 Question Generator | 🔍 Answer Evaluator |
|---|---|
| **📄 Smart Syllabus Parsing**<br>Extracts units from digital/scanned PDFs using OCR fallback (Gemini Vision). | **📝 Handwriting OCR & Vision**<br>Evaluates scanned handwritten answer PDFs directly via Gemini Vision. |
| **🧠 Multi-Format Generation**<br>Generates University-standard MCQs, Short, and Long essays. | **🤖 Automated Grading Rubrics**<br>Matches student submissions against AI-generated scoring criteria. |
| **📐 LaTeX Equations in DOCX**<br>Converts formulas into native Microsoft Word equations (MathML → OMML). | **📊 Student Roster Identification**<br>Resolves student IDs using filenames, Tesseract OCR, and content analysis. |
| **🔗 Knowledge Graph Sync**<br>Pipes parsed syllabus dependencies into Neo4j for learning maps. | **📥 Bulk Export & Management**<br>Generates cohort-wide grade breakdowns into Excel spreadsheets. |

| 📊 Performance Analytics | 🧠 Adaptive Tutor Engine |
|---|---|
| **📈 High-Density Dashboards**<br>Frosted glass, no-scroll interface with class-wide averages and pass rates. | **🎮 Reinforcement Learning (PPO)**<br>Dynamically selects topics and difficulty based on localized Neo4j syllabus graphs. |
| **🗺️ Student × Concept Heatmaps**<br>Visual color-coded grid mapping question-by-concept student scores. | **⏳ Ebbinghaus Memory Decay**<br>Simulates forgetting curve rates to decay concept mastery over time. |
| **🍩 Performance Visualizations**<br>Score histograms, leaderboard standings, and pass/fail donut charts. | **💬 Strict Evaluator Badging**<br>Badge indicators showing crystal pills feedback on manual reviews. |

### 🎨 Modern UI/UX
* **macOS Liquid Glass**: Premium translucent design with deep backdrop blurs, specular highlights, and frosted glass pill navigation.
* **Dynamic Animations**: Interactive animated grid patterns, loading skeletons, and Framer Motion shadows.
* **Optimized Layouts**: No-scroll high-density dashboards, full light/dark themes, and print-ready CSS styles.

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

1. **Session Start** → System fetches mastery vector and local Neo4j knowledge graph.
2. **Ebbinghaus Decay** → Previous mastery scores naturally decay based on time elapsed since last practice.
3. **Graph Projection** → Neo4j generates a 9-topic localized sliding window (Anchor, Prereqs, Postreqs).
4. **RL Action Selection** → PPO Policy chooses optimal topic and difficulty from the local window.
5. **Adaptive Questioning** → Generated based on dynamic difficulty (Easy/Medium/Hard).
6. **Student Response** → AI grades strictly using the **Session Rubric**.
7. **Mastery Update** → Bounded EMA-style mastery increment ensures smooth UI progression.
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

PostgreSQL 16 with 9 normalized tables. The relational schema is auto-initialized on startup via `schema.sql` and includes performance indexes on critical lookup fields.

```mermaid
erDiagram
    users {
        SERIAL id PK
        VARCHAR email UK
        VARCHAR password
        TIMESTAMP created_at
        VARCHAR role
    }
    departments {
        SERIAL id PK
        VARCHAR value UK
        VARCHAR label
    }
    details {
        SERIAL id PK
        VARCHAR department FK
        JSONB batches
        JSONB semesters
        JSONB exams
        JSONB subjects
    }
    students {
        SERIAL id PK
        VARCHAR department FK
        VARCHAR batch
        VARCHAR roll_no
        VARCHAR name
        TIMESTAMP created_at
    }
    question_papers {
        SERIAL id PK
        VARCHAR subject
        VARCHAR exam_type
        VARCHAR difficulty
        TIMESTAMP created_at
        JSONB paper
    }
    evaluations {
        SERIAL id PK
        VARCHAR roll_no
        VARCHAR exam_id
        JSONB marks
        JSONB feedback
        DECIMAL total
        TIMESTAMP timestamp
        VARCHAR subject
        VARCHAR batch
        VARCHAR department FK
        VARCHAR semester
        JSONB topics
        VARCHAR exam_type
    }
    student_progress {
        SERIAL id PK
        INT student_id FK
        VARCHAR subject
        VARCHAR topic
        FLOAT mastery
        TIMESTAMP updated_at
    }
    learning_sessions {
        SERIAL id PK
        VARCHAR session_id UK
        INT student_id FK
        VARCHAR subject
        TIMESTAMP start_time
        VARCHAR exam_id
    }
    learning_logs {
        SERIAL id PK
        VARCHAR session_id FK
        INT student_id FK
        TIMESTAMP timestamp
        VARCHAR topic
        VARCHAR difficulty
        FLOAT score
        TEXT feedback
        FLOAT mastery_before
        FLOAT mastery_after
        INT action_taken
        FLOAT reward
    }

    departments ||--o{ details : "defines_metadata_for"
    departments ||--o{ students : "enrolls"
    departments ||--o{ evaluations : "associates_exams"
    users ||--o{ student_progress : "has_bkt_mastery"
    users ||--o{ learning_sessions : "attends"
    learning_sessions ||--o{ learning_logs : "creates_trajectory"
    users ||--o{ learning_logs : "logs_rewards"
```

### Table Dictionary Reference

| Table Name | Purpose | Primary & Foreign Keys | Key Schema Details / Constraints |
|:---|:---|:---|:---|
| **`users`** | Core authentication and user profile data | `id` (PK) | Role default 'faculty'; email is unique and indexed. |
| **`departments`** | Dropdown options mapping department codes to labels | `id` (PK), `value` (UK) | e.g. `value: 'BBA'`, `label: 'Bachelor of Business Admin'` |
| **`details`** | Config maps for batches, semesters, exams, and syllabus | `id` (PK), `department` (FK) | Config stored as JSONB. References `departments(value)`. |
| **`students`** | Class roster mapping students to their cohort | `id` (PK), `department` (FK) | Composite unique constraint: `(department, batch, roll_no)`. |
| **`question_papers`** | Saved generated exam question documents | `id` (PK) | Structure of generated questions stored in a `JSONB` document. |
| **`evaluations`** | Student test grades, scores, and rubrics feedback | `id` (PK), `department` (FK) | Scores/feedbacks maps saved in dynamic `JSONB` columns. |
| **`student_progress`** | Real-time Bayesian Knowledge Tracing (BKT) topic mastery | `id` (PK), `student_id` (FK) | Composite unique constraint: `(student_id, subject, topic)`. |
| **`learning_sessions`** | Tracks adaptive tutor session states | `id` (PK), `student_id` (FK) | `session_id` is unique and indexed. References `users(id)`. |
| **`learning_logs`** | RL trajectory metrics (State-Action-Reward tuples) | `id` (PK), `session_id` (FK), `student_id` (FK) | Trajectory logs for trained policy improvement. |

---

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
