import os
from pymongo import MongoClient
import bcrypt

# MongoDB connection string from environment variables or direct
mongo_uri = os.getenv("MONGO_URI", "mongodb+srv://edricjsam:edricjsam@cluster0.xnfedd7.mongodb.net/")
client = MongoClient(mongo_uri)
db = client["QP"]

users_collection = db["users"]

print("Starting password hashing process...")

for user in users_collection.find():
    user_id = user["_id"]
    current_password = user.get("password")

    if current_password and not current_password.encode('utf-8').startswith(b'$2b$'):
        print(f"Hashing password for user: {user.get('email', user_id)}")
        # Hash the password
        hashed_password = bcrypt.hashpw(current_password.encode('utf-8'), bcrypt.gensalt())
        
        # Update the user document with the hashed password
        users_collection.update_one({'_id': user_id}, {'$set': {'password': hashed_password.decode('utf-8')}})
        print(f"Password for user {user.get('email', user_id)} hashed and updated.")
    elif current_password and current_password.startswith(b'$2b$'):
        print(f"Password for user {user.get('email', user_id)} is already hashed. Skipping.")
    else:
        print(f"User {user.get('email', user_id)} has no password or an empty password. Skipping.")

print("Password hashing process completed.")