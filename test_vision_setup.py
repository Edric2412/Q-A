
import os
import sys
from dotenv import load_dotenv

# Add current directory to path
sys.path.append(os.getcwd())

try:
    from vision_utils import grade_pdf_with_vision
    import google.generativeai as genai
    print("Imports successful.")
except ImportError as e:
    print(f"ImportError: {e}")
    sys.exit(1)

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY") 
if not api_key:
    print("Error: GOOGLE_API_KEY not found in environment.")
    sys.exit(1)

print(f"API Key present: {api_key[:4]}***")

try:
    genai.configure(api_key=api_key)
    # List models to check connectivity
    model = genai.GenerativeModel('gemini-3-flash-preview')
    print("Gemini configuration successful.")
except Exception as e:
    print(f"Gemini configuration failed: {e}")
    sys.exit(1)

print("Environment check passed.")
