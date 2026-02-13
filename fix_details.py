"""Fix the details table: drop old flat schema, create JSONB schema, re-migrate from MongoDB."""
import asyncio, asyncpg, json, os
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv()

async def fix():
    pool = await asyncpg.create_pool(os.getenv("DATABASE_URL", "postgresql://edric:edric123@localhost:5433/qp"))
    
    async with pool.acquire() as conn:
        await conn.execute("DROP TABLE IF EXISTS details")
        await conn.execute("""CREATE TABLE details (
            id SERIAL PRIMARY KEY,
            department VARCHAR(255) NOT NULL,
            batches JSONB DEFAULT '[]',
            semesters JSONB DEFAULT '[]',
            exams JSONB DEFAULT '[]',
            subjects JSONB DEFAULT '{}'
        )""")
        print("Table recreated with JSONB columns")
    
    client = MongoClient(os.getenv("MONGO_URI", "mongodb+srv://edricjsam:edricjsam@cluster0.xnfedd7.mongodb.net/"))
    docs = list(client["QP"]["details"].find({}, {"_id": 0}))
    print(f"Found {len(docs)} details docs in MongoDB")
    
    async with pool.acquire() as conn:
        for d in docs:
            await conn.execute(
                "INSERT INTO details (department, batches, semesters, exams, subjects) VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb)",
                d.get("department", ""),
                json.dumps(d.get("batches", [])),
                json.dumps(d.get("semesters", [])),
                json.dumps(d.get("exams", [])),
                json.dumps(d.get("subjects", {}))
            )
    print(f"✅ {len(docs)} details migrated with full nested structure")
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT department, batches FROM details LIMIT 1")
        print(f"Sample: {row['department']} - {len(json.loads(row['batches']))} batches")
    
    await pool.close()

asyncio.run(fix())
