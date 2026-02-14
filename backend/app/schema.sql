-- PostgreSQL Schema for QP (Question Paper Generator + Evaluator)
-- Migrated from MongoDB document collections to relational tables

-- 1. Users (login/auth)
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- 2. Departments (dropdown values)
CREATE TABLE IF NOT EXISTS departments (
    id          SERIAL PRIMARY KEY,
    value       VARCHAR(255) UNIQUE NOT NULL,
    label       VARCHAR(255) NOT NULL
);

-- 3. Details (batch/semester/subject per department — nested structure stored as JSONB)
CREATE TABLE IF NOT EXISTS details (
    id          SERIAL PRIMARY KEY,
    department  VARCHAR(255) NOT NULL REFERENCES departments(value) ON DELETE CASCADE ON UPDATE CASCADE,
    batches     JSONB DEFAULT '[]',
    semesters   JSONB DEFAULT '[]',
    exams       JSONB DEFAULT '[]',
    subjects    JSONB DEFAULT '{}'
);

-- 4. Students (roll numbers per dept+batch)
CREATE TABLE IF NOT EXISTS students (
    id          SERIAL PRIMARY KEY,
    department  VARCHAR(255) NOT NULL REFERENCES departments(value) ON DELETE CASCADE ON UPDATE CASCADE,
    batch       VARCHAR(50) NOT NULL,
    roll_no     VARCHAR(50) NOT NULL,
    name        VARCHAR(255) DEFAULT '',
    created_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE(department, batch, roll_no)
);

-- 5. Question Papers (uses JSONB for the full paper structure)
CREATE TABLE IF NOT EXISTS question_papers (
    id          SERIAL PRIMARY KEY,
    subject     VARCHAR(255) NOT NULL,
    exam_type   VARCHAR(50) NOT NULL,
    difficulty  VARCHAR(50),
    created_at  TIMESTAMP DEFAULT NOW(),
    paper       JSONB
);

-- 6. Evaluations (uses JSONB for flexible marks/feedback maps)
CREATE TABLE IF NOT EXISTS evaluations (
    id          SERIAL PRIMARY KEY,
    roll_no     VARCHAR(50) NOT NULL,
    exam_id     VARCHAR(255) NOT NULL,
    marks       JSONB NOT NULL DEFAULT '{}',
    feedback    JSONB DEFAULT '{}',
    total       DECIMAL(6,2) NOT NULL DEFAULT 0,
    timestamp   TIMESTAMP DEFAULT NOW(),
    subject     VARCHAR(255),
    batch       VARCHAR(50),
    department  VARCHAR(255) REFERENCES departments(value) ON UPDATE CASCADE,
    semester    VARCHAR(50)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_evaluations_exam_id ON evaluations(exam_id);
CREATE INDEX IF NOT EXISTS idx_details_department ON details(department);
CREATE INDEX IF NOT EXISTS idx_students_dept_batch ON students(department, batch);
CREATE INDEX IF NOT EXISTS idx_qp_created_at ON question_papers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_roll_no ON evaluations(roll_no);
