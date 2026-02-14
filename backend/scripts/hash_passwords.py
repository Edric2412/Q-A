"""
hash_passwords.py — One-time utility to hash plaintext passwords in PostgreSQL.
"""

import os
import psycopg2
import bcrypt
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://edric:edric123@localhost:5433/qp")

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("Starting password hashing process...")

cur.execute("SELECT id, email, password FROM users")
users = cur.fetchall()

for user_id, email, current_password in users:
    if current_password and not current_password.startswith('$2b$'):
        print(f"Hashing password for user: {email}")
        hashed_password = bcrypt.hashpw(current_password.encode('utf-8'), bcrypt.gensalt())
        cur.execute("UPDATE users SET password = %s WHERE id = %s", (hashed_password.decode('utf-8'), user_id))
        print(f"Password for user {email} hashed and updated.")
    elif current_password and current_password.startswith('$2b$'):
        print(f"Password for user {email} is already hashed. Skipping.")
    else:
        print(f"User {email} has no password or an empty password. Skipping.")

conn.commit()
cur.close()
conn.close()

print("Password hashing process completed.")