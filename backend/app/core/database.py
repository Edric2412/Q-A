"""
database.py — Async PostgreSQL connection pool using asyncpg.
Replaces both pymongo (sync) and motor (async) MongoDB drivers.
"""

import os
import asyncpg
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://edric:edric123@localhost:5433/qp"
)

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    """Get or create the connection pool."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=30
        )
        logger.info("PostgreSQL connection pool created")
    return _pool


async def init_db():
    """Initialize the database by running schema.sql."""
    pool = await get_pool()
    schema_path = os.path.join(os.path.dirname(__file__), "../db/schema.sql")
    with open(schema_path, "r") as f:
        schema_sql = f.read()
    async with pool.acquire() as conn:
        await conn.execute(schema_sql)
    logger.info("Database schema initialized")


async def close_db():
    """Close the connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("PostgreSQL connection pool closed")


# -------------------------------------------------------------------
# Helper functions that mirror the old MongoDB query patterns
# -------------------------------------------------------------------

async def find_user_by_email(email: str) -> dict | None:
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM users WHERE email = $1", email)
    return dict(row) if row else None


async def get_departments() -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch("SELECT value, label FROM departments")
    return [dict(r) for r in rows]


async def get_details_by_department(department: str) -> list[dict]:
    pool = await get_pool()
    # Try exact match first
    rows = await pool.fetch(
        "SELECT department, batches, semesters, exams, subjects FROM details WHERE department = $1",
        department
    )
    # Fallback: case-insensitive match
    if not rows:
        rows = await pool.fetch(
            "SELECT department, batches, semesters, exams, subjects FROM details WHERE LOWER(department) = LOWER($1)",
            department
        )
    results = []
    for r in rows:
        d = dict(r)
        # Parse JSONB strings to Python objects
        for col in ["batches", "semesters", "exams", "subjects"]:
            if isinstance(d.get(col), str):
                d[col] = json.loads(d[col])
        results.append(d)
    return results


async def get_metadata() -> dict:
    pool = await get_pool()
    dept_rows = await pool.fetch("SELECT value, label FROM departments")
    detail_rows = await pool.fetch("SELECT department, batches, semesters, exams, subjects FROM details")
    departments = [dict(r) for r in dept_rows]
    details = []
    for r in detail_rows:
        d = dict(r)
        # Parse JSONB strings
        for col in ["batches", "semesters", "exams", "subjects"]:
            if isinstance(d.get(col), str):
                d[col] = json.loads(d[col])
        details.append(d)
        
    return {
        "departments": departments,
        "details": details
    }


async def get_students(department: str, batch: str) -> list[dict]:
    pool = await get_pool()
    
    # 1. Exact match
    rows = await pool.fetch(
        "SELECT roll_no, name FROM students WHERE department = $1 AND batch = $2 ORDER BY roll_no",
        department, batch
    )
    
    # 2. Fallback: tight batch (remove spaces)
    if not rows:
        tight_batch = batch.replace(" ", "")
        rows = await pool.fetch(
            "SELECT roll_no, name FROM students WHERE department = $1 AND batch = $2 ORDER BY roll_no",
            department, tight_batch
        )
    
    # 3. Fallback: spaced batch
    if not rows and "-" in batch and " - " not in batch:
        spaced_batch = batch.replace("-", " - ")
        rows = await pool.fetch(
            "SELECT roll_no, name FROM students WHERE department = $1 AND batch = $2 ORDER BY roll_no",
            department, spaced_batch
        )
    
    # 4. Fallback: case-insensitive department
    if not rows:
        rows = await pool.fetch(
            "SELECT roll_no, name FROM students WHERE LOWER(department) = LOWER($1) AND batch = $2 ORDER BY roll_no",
            department, batch
        )
    
    return [{"roll_no": r["roll_no"], "name": r["name"] or r["roll_no"]} for r in rows]


async def get_saved_papers(limit: int = 50) -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT id, subject, exam_type, difficulty, created_at FROM question_papers ORDER BY created_at DESC LIMIT $1",
        limit
    )
    result = []
    for r in rows:
        d = dict(r)
        d["_id"] = str(d.pop("id"))  # Frontend expects _id as string
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        result.append(d)
    return result


async def get_saved_paper(paper_id: int) -> dict | None:
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM question_papers WHERE id = $1", paper_id)
    if not row:
        return None
    d = dict(row)
    d["_id"] = str(d.pop("id"))
    if d.get("created_at"):
        d["created_at"] = d["created_at"].isoformat()
    # Parse JSONB paper content
    if isinstance(d.get("paper"), str):
        d["paper"] = json.loads(d["paper"])
    return d


async def insert_question_paper(subject: str, exam_type: str, difficulty: str, paper: dict) -> int:
    pool = await get_pool()
    row = await pool.fetchrow(
        """INSERT INTO question_papers (subject, exam_type, difficulty, paper)
           VALUES ($1, $2, $3, $4::jsonb) RETURNING id""",
        subject, exam_type, difficulty, json.dumps(paper)
    )
    return row["id"]


async def insert_evaluation(data: dict) -> int:
    pool = await get_pool()
    # Parse timestamp string to datetime for asyncpg
    ts = data.get("timestamp")
    if isinstance(ts, str):
        try:
            ts = datetime.fromisoformat(ts)
        except (ValueError, TypeError):
            ts = datetime.utcnow()
    elif ts is None:
        ts = datetime.utcnow()
    
    row = await pool.fetchrow(
        """INSERT INTO evaluations (roll_no, exam_id, marks, feedback, total, timestamp, subject, batch, department, semester, topics, exam_type)
           VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9, $10, $11::jsonb, $12) RETURNING id""",
        data["roll_no"],
        data["exam_id"],
        json.dumps(data.get("marks", {})),
        json.dumps(data.get("feedback", {})),
        data.get("total", 0),
        ts,
        data.get("subject"),
        data.get("batch"),
        data.get("department"),
        data.get("semester"),
        json.dumps(data.get("topics", {})),
        data.get("exam_type")
    )
    return row["id"]


async def find_evaluation(exam_id: str, roll_no: str) -> dict | None:
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM evaluations WHERE exam_id = $1 AND roll_no = $2",
        exam_id, roll_no
    )
    if not row:
        return None
    d = dict(row)
    d["_id"] = str(d.pop("id"))
    # Parse JSONB fields
    if isinstance(d.get("marks"), str):
        d["marks"] = json.loads(d["marks"])
    if isinstance(d.get("feedback"), str):
        d["feedback"] = json.loads(d["feedback"])
    if isinstance(d.get("topics"), str):
        d["topics"] = json.loads(d["topics"])
    return d


async def update_evaluation_marks(eval_id: int, marks: dict, total: float):
    pool = await get_pool()
    await pool.execute(
        "UPDATE evaluations SET marks = $1::jsonb, total = $2 WHERE id = $3",
        json.dumps(marks), total, eval_id
    )


async def get_evaluation_results(exam_id: str) -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT * FROM evaluations WHERE exam_id = $1 ORDER BY roll_no",
        exam_id
    )
    results = []
    for r in rows:
        d = dict(r)
        d["_id"] = str(d.pop("id"))
        if d.get("timestamp"):
            d["timestamp"] = d["timestamp"].isoformat()
        # Parse JSONB fields
        if isinstance(d.get("marks"), str):
            d["marks"] = json.loads(d["marks"])
        if isinstance(d.get("feedback"), str):
            d["feedback"] = json.loads(d["feedback"])
        if isinstance(d.get("topics"), str):
            d["topics"] = json.loads(d["topics"])
        results.append(d)
    return results


async def delete_paper(paper_id: int):
    pool = await get_pool()
    await pool.execute("DELETE FROM question_papers WHERE id = $1", paper_id)


async def delete_evaluation(exam_id: str):
    pool = await get_pool()
    await pool.execute("DELETE FROM evaluations WHERE exam_id = $1", exam_id)


async def get_evaluation_history(limit: int = 50) -> list[dict]:
    """Replaces the MongoDB aggregation pipeline for history."""
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT 
                exam_id AS _id,
                COUNT(*) AS student_count,
                AVG(total) AS avg_score,
                MAX(timestamp) AS latest_date,
                (array_agg(subject))[1] AS subject,
                (array_agg(batch))[1] AS batch,
                (array_agg(department))[1] AS department
           FROM evaluations
           GROUP BY exam_id
           ORDER BY MAX(timestamp) DESC
           LIMIT $1""",
        limit
    )
    results = []
    for r in rows:
        d = dict(r)
        if d.get("avg_score") is not None:
            d["avg_score"] = float(d["avg_score"])
        if d.get("latest_date"):
            d["latest_date"] = d["latest_date"].isoformat()
        results.append(d)
    return results


# -------------------------------------------------------------------
# Auth & Adaptive Learning Functions
# -------------------------------------------------------------------

async def create_user(email: str, password_hash: str, role: str = 'faculty', roll_no: str = None) -> int:
    pool = await get_pool()
    # Check if exists
    existing = await find_user_by_email(email)
    user_id = None
    if existing:
        user_id = existing['id']
    else:
        row = await pool.fetchrow(
            "INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id",
            email, password_hash, role
        )
        user_id = row['id']
    
    # If roll_no is provided, link it in students table
    if roll_no:
        try:
             await pool.execute("UPDATE students SET email = $1 WHERE roll_no = $2", email, roll_no)
        except Exception as e:
            # Log error but don't fail user creation
            print(f"Failed to link roll_no {roll_no} to {email}: {e}")
            
    return user_id

async def update_password(email: str, password_hash: str):
    pool = await get_pool()
    await pool.execute("UPDATE users SET password = $1 WHERE email = $2", password_hash, email)


async def get_student_progress(student_id: int, subject: str) -> dict:
    """Returns {topic: mastery, ...}"""
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT topic, mastery FROM student_progress WHERE student_id = $1 AND subject = $2",
        student_id, subject
    )
    return {r['topic']: r['mastery'] for r in rows}


async def update_student_progress(student_id: int, subject: str, topic: str, new_mastery: float):
    pool = await get_pool()
    await pool.execute(
        """
        INSERT INTO student_progress (student_id, subject, topic, mastery, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (student_id, subject, topic)
        DO UPDATE SET mastery = $4, updated_at = NOW()
        """,
        student_id, subject, topic, new_mastery
    )



async def get_student_evaluations(email: str) -> list[dict]:
    pool = await get_pool()
    # 1. Get Roll No from email
    student = await pool.fetchrow("SELECT roll_no FROM students WHERE email = $1", email)
    if not student: return []
    
    roll_no = student['roll_no']
    
    # 2. Get Evaluations
    rows = await pool.fetch(
        "SELECT * FROM evaluations WHERE roll_no = $1 ORDER BY timestamp DESC",
        roll_no
    )
    
    results = []
    for r in rows:
        d = dict(r)
        d["_id"] = str(d.pop("id"))
        if d.get("timestamp"):
            d["timestamp"] = d["timestamp"].isoformat()
        # Parse JSONB fields
        if isinstance(d.get("marks"), str): d["marks"] = json.loads(d["marks"])
        if isinstance(d.get("feedback"), str): d["feedback"] = json.loads(d["feedback"])
        if isinstance(d.get("topics"), str): d["topics"] = json.loads(d["topics"])
        
        results.append(d)
    return results

async def get_evaluation_topics(exam_id: str) -> list[str]:
    pool = await get_pool()
    # Fetch topics from evaluations table (stored as jsonb or array)
    # The evaluation stores "topics" which is usually a list of strings
    # But wait, evaluations stores topics for that specific student/exam?
    # Yes, insert_evaluation stores "topics"
    
    # Let's just pick one evaluation for this exam_id to get topics?
    # Or should we store topics in question_papers?
    # Actually, evaluations has "topics" column which stores the topics covered in that exam.
    
    row = await pool.fetchrow("SELECT topics FROM evaluations WHERE exam_id = $1 LIMIT 1", exam_id)
    if not row: return []
    
    topics_json = row['topics']

    # Handle string (double-encoded JSON)
    if isinstance(topics_json, str):
        try:
            topics_json = json.loads(topics_json)
        except:
            return []

    # Handle List
    if isinstance(topics_json, list):
        return [str(t) for t in topics_json if t]

    # Handle Dict (Values are topics)
    if isinstance(topics_json, dict):
        # Extract unique values
        raw_values = list(topics_json.values())
        unique_topics = list(set([str(v) for v in raw_values if v and v != "Unknown"]))
        return unique_topics if unique_topics else ["General"]

    return []

async def create_learning_session(session_id: str, student_id: int, subject: str, exam_id: str = None):
    pool = await get_pool()
    await pool.execute(
        "INSERT INTO learning_sessions (session_id, student_id, subject, start_time, exam_id) VALUES ($1, $2, $3, NOW(), $4)",
        session_id, student_id, subject, exam_id
    )

async def log_learning_step(log_data: dict):
    pool = await get_pool()
    await pool.execute(
        """
        INSERT INTO learning_logs 
        (session_id, student_id, topic, difficulty, score, feedback, mastery_before, mastery_after, action_taken, reward, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        """,
        log_data["session_id"],
        log_data["student_id"],
        log_data["topic"],
        log_data["difficulty"],
        log_data["score"],
        log_data.get("feedback", ""), # Add feedback
        log_data["mastery_before"],
        log_data["mastery_after"],
        log_data["action_taken"],
        log_data["reward"]
    )



async def get_session_by_id(session_id: str) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM learning_sessions WHERE session_id = $1", session_id)
    return dict(row) if row else None


async def get_student_learning_logs(student_id: int, limit: int = 10) -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT * FROM learning_logs 
        WHERE student_id = $1 
        ORDER BY timestamp DESC 
        LIMIT $2
        """,
        student_id, limit
    )
    results = []
    for r in rows:
        d = dict(r)
        if d.get("timestamp"):
            d["timestamp"] = d["timestamp"].isoformat()
        results.append(d)
    return results
