
import asyncio
import os
import asyncpg
from dotenv import load_dotenv

from pathlib import Path
load_dotenv(Path(__file__).parent.parent.parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")

async def migrate():
    print(f"Connecting to {DATABASE_URL}...")
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        # 1. Add email column to students table if not exists
        print("Adding email column to students table...")
        await conn.execute("""
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
        """)

        # 2. Update specific students with emails
        updates = [
            ("23BDS002", "edricjeffreysam.23bds@kclas.ac.in"), # Edric Jeffrey Sam
            ("23BDS003", "nithish.23bds@kclas.ac.in"),         # Nithish
            ("23BDS001", "athiseshan.23bds@kclas.ac.in")       # Athi Seshan
        ]

        print("Updating student emails...")
        for roll_no, email in updates:
            res = await conn.execute("""
                UPDATE students 
                SET email = $1 
                WHERE roll_no = $2
            """, email, roll_no)
            print(f"Updated {roll_no} -> {email}: {res}")

        # 3. Verify
        rows = await conn.fetch("SELECT roll_no, name, email FROM students WHERE email IS NOT NULL")
        print("\nVerified Students with Emails:")
        for r in rows:
            print(dict(r))

    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(migrate())
