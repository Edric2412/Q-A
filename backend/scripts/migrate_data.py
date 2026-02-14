"""
migrate_data.py — One-time script to copy data from MongoDB to PostgreSQL.
Run this ONCE after setting up PostgreSQL to migrate your existing data.

Usage:
    python migrate_data.py
"""

import os
import json
import asyncio
import asyncpg
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

# MongoDB source
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://edricjsam:edricjsam@cluster0.xnfedd7.mongodb.net/")
mongo_client = MongoClient(MONGO_URI)
mongo_db = mongo_client["QP"]

# PostgreSQL target
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://edric:edric123@localhost:5433/qp")


def parse_ts(val):
    """Convert various timestamp formats to datetime or None."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, str):
        try:
            return datetime.fromisoformat(val)
        except (ValueError, TypeError):
            return None
    return None


async def migrate():
    pool = await asyncpg.create_pool(DATABASE_URL)
    
    print("=" * 60)
    print("  MongoDB → PostgreSQL Migration")
    print("=" * 60)

    # --- 1. Users ---
    users = list(mongo_db["users"].find())
    if users:
        print(f"\n[users] Migrating {len(users)} records...")
        async with pool.acquire() as conn:
            for u in users:
                await conn.execute(
                    "INSERT INTO users (email, password) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING",
                    u["email"], u.get("password", "")
                )
        print(f"  ✅ {len(users)} users migrated")
    else:
        print("\n[users] No data found, skipping")

    # --- 2. Departments ---
    departments = list(mongo_db["departments"].find({}, {"_id": 0}))
    if departments:
        print(f"\n[departments] Migrating {len(departments)} records...")
        async with pool.acquire() as conn:
            for d in departments:
                await conn.execute(
                    "INSERT INTO departments (value, label) VALUES ($1, $2) ON CONFLICT (value) DO NOTHING",
                    d.get("value", ""), d.get("label", d.get("value", ""))
                )
        print(f"  ✅ {len(departments)} departments migrated")
    else:
        print("\n[departments] No data found, skipping")

    # --- 3. Details ---
    details = list(mongo_db["details"].find({}, {"_id": 0}))
    if details:
        print(f"\n[details] Migrating {len(details)} records...")
        async with pool.acquire() as conn:
            for d in details:
                await conn.execute(
                    "INSERT INTO details (department, batches, semesters, exams, subjects) VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb)",
                    d.get("department", ""),
                    json.dumps(d.get("batches", [])),
                    json.dumps(d.get("semesters", [])),
                    json.dumps(d.get("exams", [])),
                    json.dumps(d.get("subjects", {}))
                )
        print(f"  ✅ {len(details)} detail records migrated")
    else:
        print("\n[details] No data found, skipping")

    # --- 4. Students (flatten embedded arrays) ---
    students_docs = list(mongo_db["students"].find())
    if students_docs:
        total_students = 0
        print(f"\n[students] Migrating {len(students_docs)} batch documents...")
        async with pool.acquire() as conn:
            for doc in students_docs:
                dept = doc.get("department", "")
                batch = doc.get("batch", "")
                student_list = doc.get("students", [])
                for student in student_list:
                    # Handle both dict objects and plain strings
                    if isinstance(student, dict):
                        roll_no = student.get("roll_no", student.get("rollNo", ""))
                    else:
                        roll_no = str(student)
                    if roll_no:
                        await conn.execute(
                            "INSERT INTO students (department, batch, roll_no) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
                            dept, batch, roll_no
                        )
                        total_students += 1
        print(f"  ✅ {total_students} individual student records migrated (from {len(students_docs)} batch docs)")
    else:
        print("\n[students] No data found, skipping")

    # --- 5. Question Papers ---
    papers = list(mongo_db["question_papers"].find())
    if papers:
        print(f"\n[question_papers] Migrating {len(papers)} records...")
        async with pool.acquire() as conn:
            for p in papers:
                paper_json = p.get("paper")
                await conn.execute(
                    """INSERT INTO question_papers (subject, exam_type, difficulty, created_at, paper)
                       VALUES ($1, $2, $3, $4, $5::jsonb)""",
                    p.get("subject", ""),
                    p.get("exam_type", ""),
                    p.get("difficulty", ""),
                    parse_ts(p.get("created_at")),
                    json.dumps(paper_json) if paper_json else None
                )
        print(f"  ✅ {len(papers)} question papers migrated")
    else:
        print("\n[question_papers] No data found, skipping")

    # --- 6. Evaluations ---
    evaluations = list(mongo_db["evaluations"].find())
    if evaluations:
        print(f"\n[evaluations] Migrating {len(evaluations)} records...")
        async with pool.acquire() as conn:
            for e in evaluations:
                await conn.execute(
                    """INSERT INTO evaluations (roll_no, exam_id, marks, feedback, total, timestamp, subject, batch, department, semester)
                       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9, $10)""",
                    e.get("roll_no", ""),
                    e.get("exam_id", ""),
                    json.dumps(e.get("marks", {})),
                    json.dumps(e.get("feedback", {})),
                    e.get("total", 0),
                    parse_ts(e.get("timestamp")),
                    e.get("subject"),
                    e.get("batch"),
                    e.get("department"),
                    e.get("semester")
                )
        print(f"  ✅ {len(evaluations)} evaluation records migrated")
    else:
        print("\n[evaluations] No data found, skipping")

    await pool.close()
    
    print("\n" + "=" * 60)
    print("  Migration Complete! 🎉")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(migrate())
