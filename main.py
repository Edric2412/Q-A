import os
import re
import json
import random
import asyncio
from pathlib import Path
from dotenv import load_dotenv
import io
import logging

# Load environment variables
load_dotenv()

from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Form
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from typing import List, Dict, Any

import pdfplumber
import bcrypt
from pydantic import BaseModel
from docx import Document
from docx.text.paragraph import Paragraph

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI

# --- IMPORT EVALUATOR ---
# This pulls the 'evaluator_app' FastAPI object from main2.py
from main2 import evaluator_app

# --- CONFIGURATION ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- AI & DB INITIALIZATION ---
try:
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY environment variable not set")
    os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.6)
    embedding = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")
    logger.info("Google AI Models initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Google AI Models. Error: {e}")
    raise

try:
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    client.admin.command('ping')
    db = client["QP"]
    logger.info("MongoDB connection established successfully")
except (ConnectionFailure, ServerSelectionTimeoutError) as e:
    logger.error(f"Failed to connect to MongoDB: {e}")
    raise

# --- PROMPT ENGINEERING ---
MCQ_BATCH_PROMPT = PromptTemplate.from_template("""
You are an expert question paper setter for {subject}. 
Generate **{num_questions}** distinct Multiple Choice Questions of {difficulty} difficulty, each worth {marks} mark.

For each MCQ, provide:
- "question": The question text
- "options": An object with keys A, B, C, D and their option texts
- "answer": The correct option letter (A, B, C, or D)

Return a single, valid JSON object:
{{"questions": [
  {{"question": "...", "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}}, "answer": "A"}},
  ...
]}}

**Context:** {context}
""")

RUBRIC_BATCH_PROMPT = PromptTemplate.from_template("""
You are an expert question paper setter for **{subject}**.
Generate **{num_questions}** distinct {question_type} questions of {difficulty} difficulty, each worth {marks} marks.

For each question, provide:
- "question": The question text
- "answer": A detailed marking scheme/rubric in this EXACT format:
  * Multiple bullet points, each with:
    - A specific assessment criterion (what the student should include)
    - The mark allocation for that point in parentheses, e.g. "(3)"
  * The marks should sum to {marks}
  * End with a "Keywords:" line listing 4-6 important terms

Example answer format for a {marks}-mark question:
"- Provides a clear definition of the concept (3)\\n- Explains key characteristics and differences (3)\\n- Discusses practical applications or examples (4)\\n**Keywords:** Term1, Term2, Term3, Term4"

Return a single, valid JSON object:
{{"questions": [
  {{"question": "...", "answer": "- Point 1 (marks)\\n- Point 2 (marks)\\n**Keywords:** ..."}},
  ...
]}}

**Context:** {context}
""")

# --- FASTAPI APP SETUP ---
app = FastAPI(title="Question Paper Generator", version="2.0")

# CORS Configuration for Next.js Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
TEMP_DIR = BASE_DIR / "temp"
TEMP_DIR.mkdir(exist_ok=True)

TEMPLATE_DIR_DOCX = BASE_DIR / "templates"
TEMPLATE_PATHS = {
    "CIA": {
        "paper": TEMPLATE_DIR_DOCX / "CIA_QP_template.docx",
        "key": TEMPLATE_DIR_DOCX / "CIA_Answerkey_template.docx"
    },
    "Model": {
        "paper": TEMPLATE_DIR_DOCX / "Models_QP_template.docx",
        "key": TEMPLATE_DIR_DOCX / "Models_Answerkey_template.docx"
    }
}

# Mount Evaluator (main2.py) at /evaluator
# This allows it to run on the SAME port (8000)
app.mount("/evaluator", evaluator_app)

# --- PYDANTIC MODELS ---
class Question(BaseModel):
    id: int
    type: str
    text: str
    answer: str
    marks: int

class DownloadRequest(BaseModel):
    department: str
    batch: str
    semester: str
    subject: str
    examType: str
    duration: str
    paperSetter: str
    hod: str
    questions: List[Question]

# --- CORE FUNCTIONS ---
def extract_units_from_pdf(pdf_path: str) -> List[Dict[str, str]]:
    try:
        with pdfplumber.open(pdf_path) as pdf:
            full_text = "".join(page.extract_text() for page in pdf.pages if page.extract_text())
        unit_pattern = re.compile(r"((?:Unit|Module)[:\s]*\d+.*?(?=(?:Unit|Module)[:\s]*\d+|$))", re.DOTALL | re.IGNORECASE)
        matches = unit_pattern.findall(full_text)
        if not matches:
            return [{"unit": "Full Syllabus", "text": full_text}] if full_text.strip() else []
        return [{"unit": f"Unit {idx+1}", "text": match.strip()} for idx, match in enumerate(matches) if match.strip()]
    except Exception as e:
        logger.error(f"Error reading PDF {pdf_path}: {e}")
        return []

def create_document_chunks(units: List[Dict[str, str]]) -> List[Any]:
    texts = [unit["text"] for unit in units if unit.get("text")]
    if not texts: return []
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=4000, chunk_overlap=500)
    return text_splitter.create_documents(texts, metadatas=[{"unit": unit["unit"]} for unit in units])

def parse_json_output(response_text: str) -> List[Dict[str, str]]:
    try:
        # Try code block first
        json_match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', response_text, re.DOTALL)
        if not json_match:
            # Try to find JSON object - use greedy match for nested structures
            # Find opening brace and match to the last closing brace
            start = response_text.find('{')
            end = response_text.rfind('}')
            if start != -1 and end != -1 and end > start:
                json_str = response_text[start:end+1]
            else:
                logger.warning(f"No JSON found in response: {response_text[:200]}")
                return []
        else:
            json_str = json_match.group(1)
        
        data = json.loads(json_str)
        questions = data.get("questions", [])
        if not isinstance(questions, list):
            logger.warning(f"'questions' is not a list: {type(questions)}")
            return []
        
        # Normalize fields
        normalized = []
        for q in questions:
            if isinstance(q, dict):
                # Normalize question -> text
                if "question" in q and "text" not in q:
                    q["text"] = q.pop("question")
                # Ensure answer field exists
                if "answer" not in q:
                    q["answer"] = q.get("correct_answer", q.get("correct", q.get("model_answer", "")))
                # For MCQs, format options into text if present
                if "options" in q and isinstance(q["options"], (list, dict)):
                    opts = q["options"]
                    if isinstance(opts, dict):
                        opt_text = "\n".join([f"{k}) {v}" for k, v in opts.items()])
                    else:
                        opt_text = "\n".join([f"{chr(65+i)}) {o}" for i, o in enumerate(opts)])
                    q["text"] = q.get("text", "") + "\n" + opt_text
                normalized.append(q)
        
        logger.info(f"Parsed {len(normalized)} questions successfully")
        return normalized
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}. Response: {response_text[:500]}")
        return []
    except Exception as e:
        logger.error(f"Parse error: {e}")
        return []

async def run_batch_query(prompt: PromptTemplate, q_type: str, num: int, marks: int, context: str, subject: str, difficulty: str) -> List[Dict[str, str]]:
    if num <= 0: return []
    try:
        chain = prompt | llm | StrOutputParser()
        response = await chain.ainvoke({
            "subject": subject, "num_questions": num, "question_type": q_type,
            "difficulty": difficulty, "marks": marks, "context": context
        })
        return parse_json_output(response)
    except Exception as e:
        logger.error(f"Error in batch query for {q_type}: {e}")
        return []

async def generate_question_paper(docs_content: tuple, subject: str, pattern: str, difficulty: str) -> Dict[str, List]:
    # Generator Patterns (Separate from Evaluator)
    patterns = {
        "CIA": {"mcq": (10, 1), "short": (5, 4), "long": (2, 10)},
        "Model": {"mcq": (10, 1), "short": (5, 5), "long": (5, 8)}
    }
    config = patterns.get(pattern)
    if not config: raise ValueError(f"Invalid pattern '{pattern}'")

    num_mcq, marks_mcq = config["mcq"]
    num_short, marks_short = config["short"]
    num_long, marks_long = config["long"]
    
    context_sample = "\n---\n".join(random.sample(list(docs_content), min(len(docs_content), 5)))
    paper = {"MCQ": [], "Short": [], "Long": []}

    paper["MCQ"] = await run_batch_query(MCQ_BATCH_PROMPT, "MCQ", num_mcq, marks_mcq, context_sample, subject, difficulty)
    paper["Short"] = await run_batch_query(RUBRIC_BATCH_PROMPT, "Short Answer", num_short * 2, marks_short, context_sample, subject, difficulty)
    paper["Long"] = await run_batch_query(RUBRIC_BATCH_PROMPT, "Long Essay", num_long * 2, marks_long, context_sample, subject, difficulty)

    # Filter out non-dict items and assign marks (LLM sometimes returns malformed data)
    paper["MCQ"] = [item for item in paper["MCQ"] if isinstance(item, dict)]
    paper["Short"] = [item for item in paper["Short"] if isinstance(item, dict)]
    paper["Long"] = [item for item in paper["Long"] if isinstance(item, dict)]
    
    for item in paper["MCQ"]: item["marks"] = marks_mcq
    for item in paper["Short"]: item["marks"] = marks_short
    for item in paper["Long"]: item["marks"] = marks_long
        
    return paper

# --- DOCX UTILS ---
def replace_text_in_paragraph(paragraph: Paragraph, context: Dict[str, str]):
    full_text = "".join(run.text for run in paragraph.runs)
    if '{{' not in full_text: return
    for key, value in context.items():
        if key in full_text: full_text = full_text.replace(key, str(value))
    # Clear runs and add new text
    for run in paragraph.runs:
        p = paragraph._p
        p.remove(run._r)
    if full_text:
        lines = full_text.split('\n')
        for i, line in enumerate(lines):
            if i > 0: paragraph.add_run().add_break()
            paragraph.add_run(line)

def replace_placeholders(doc: Document, context: Dict[str, str]):
    for p in doc.paragraphs: replace_text_in_paragraph(p, context)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs: replace_text_in_paragraph(p, context)
    for section in doc.sections:
        for p in section.header.paragraphs: replace_text_in_paragraph(p, context)
        for table in section.header.tables:
            for row in table.rows:
                for cell in row.cells:
                    for p in cell.paragraphs: replace_text_in_paragraph(p, context)
        for p in section.footer.paragraphs: replace_text_in_paragraph(p, context)
        for table in section.footer.tables:
            for row in table.rows:
                for cell in row.cells:
                    for p in cell.paragraphs: replace_text_in_paragraph(p, context)
    return doc

def parse_answer_and_marks(answer_text: str):
    if not answer_text: return "", ""
    lines = answer_text.strip().split('\n')
    cleaned_answer_lines = []
    formatted_marks_lines = []
    mark_pattern = re.compile(r'\s*\((\d+)\s*marks?\)$')

    for line in lines:
        line = line.strip()
        match = mark_pattern.search(line)
        if match:
            mark_number = match.group(1)
            formatted_marks_lines.append(f"({mark_number})")
            cleaned_line = mark_pattern.sub('', line)
            cleaned_answer_lines.append(cleaned_line)
        else:
            cleaned_answer_lines.append(line)
            formatted_marks_lines.append("")

    return "\n".join(cleaned_answer_lines), "\n".join(formatted_marks_lines)

# --- ROUTES ---
@app.get("/")
async def read_root():
    return {"message": "KCLAS Question Paper Generator API", "version": "2.0"}

@app.post("/login")
async def login(request: Request, email: str = Form(...), password: str = Form(...)):
    try:
        user = db["users"].find_one({"email": email})
        if user and bcrypt.checkpw(password.encode('utf-8'), user["password"].encode('utf-8')):
            # Return redirect for Next.js to detect successful login
            return RedirectResponse(url="/dashboard", status_code=303)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Login failed")

@app.get("/departments")
async def get_departments():
    return list(db["departments"].find({}, {"_id": 0, "value": 1, "label": 1}))

@app.get("/details/{department}")
async def get_details_by_department(department: str):
    try:
        # 1. Clean the input (remove %20 artifacts if any remain, though FastAPI handles most)
        dept_clean = department.strip()
        
        # 2. Try Exact Match first
        details = list(db["details"].find({"department": dept_clean}, {"_id": 0}))
        
        # 3. If no results, try Case-Insensitive Regex Match
        # This solves issues like "visual communication" vs "Visual Communication"
        if not details:
            regex_query = {"department": {"$regex": f"^{re.escape(dept_clean)}$", "$options": "i"}}
            details = list(db["details"].find(regex_query, {"_id": 0}))
            
        return details
    except Exception as e:
        logger.error(f"Error fetching details for {department}: {e}")
        return []

@app.post("/upload-syllabus")
async def upload_syllabus(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    temp_file_path = TEMP_DIR / f"temp_{random.randint(1000, 9999)}_{file.filename}"
    try:
        with open(temp_file_path, "wb") as f: f.write(await file.read())
        units = extract_units_from_pdf(str(temp_file_path))
        return {"units": units}
    finally:
        if temp_file_path.exists(): temp_file_path.unlink()

@app.post("/generate-questions")
async def generate_questions(request: Request):
    try:
        data = await request.json()
        exam_type = "Model" if data.get("exam_type") == "Models" else data.get("exam_type")
        doc_chunks = create_document_chunks(data.get("selected_units", []))
        if not doc_chunks: raise HTTPException(status_code=422, detail="Failed to process content.")
        
        paper = await generate_question_paper(
            tuple(doc.page_content for doc in doc_chunks), data["subject"], exam_type, data["difficulty"]
        )
        return {"question_paper": paper}
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/download-paper")
async def download_paper(data: DownloadRequest):
    exam_type = "Model" if data.examType == "Models" else data.examType
    template_path = TEMPLATE_PATHS.get(exam_type, {}).get("paper")
    if not template_path or not template_path.exists():
        raise HTTPException(status_code=404, detail="Template not found")

    doc = Document(template_path)
    context = {
        "{{department}}": data.department, "{{batch}}": data.batch, "{{semester}}": data.semester,
        "{{subject}}": data.subject, "{{examType}}": data.examType, "{{duration}}": data.duration,
        "{{paperSetter}}": data.paperSetter, "{{hod}}": data.hod,
    }
    mcqs = [q for q in data.questions if q.type == "MCQ"]
    short_answers = [q for q in data.questions if q.type == "Short Answer"]
    long_essays = [q for q in data.questions if q.type == "Long Essay"]

    for i in range(1, 11):
        if i <= len(mcqs):
            q = mcqs[i - 1]
            parts = q.text.split('\n')
            context[f"{{{{Q{i}}}}}"] = parts[0]
            context[f"{{{{Q{i}_A}}}}"] = parts[1] if len(parts) > 1 else ""
            context[f"{{{{Q{i}_B}}}}"] = parts[2] if len(parts) > 2 else ""
            context[f"{{{{Q{i}_C}}}}"] = parts[3] if len(parts) > 3 else ""
            context[f"{{{{Q{i}_D}}}}"] = parts[4] if len(parts) > 4 else ""
    
    q_num = 11
    for i in range(0, len(short_answers), 2):
        context[f"{{{{Q{q_num}a}}}}"] = short_answers[i].text
        context[f"{{{{Q{q_num}b}}}}"] = short_answers[i + 1].text if i + 1 < len(short_answers) else ""
        q_num += 1

    q_num = 16
    for i in range(0, len(long_essays), 2):
        context[f"{{{{Q{q_num}a}}}}"] = long_essays[i].text
        context[f"{{{{Q{q_num}b}}}}"] = long_essays[i + 1].text if i + 1 < len(long_essays) else ""
        q_num += 1

    doc = replace_placeholders(doc, context)
    file_path = TEMP_DIR / f"{data.subject}_QP_{random.randint(1000,9999)}.docx"
    doc.save(file_path)
    return FileResponse(path=file_path, filename=f"{data.subject}_Question_Paper.docx")

@app.post("/download-key")
async def download_key(data: DownloadRequest):
    exam_type = "Model" if data.examType == "Models" else data.examType
    template_path = TEMPLATE_PATHS.get(exam_type, {}).get("key")
    if not template_path or not template_path.exists():
        raise HTTPException(status_code=404, detail="Key template not found")
    
    doc = Document(template_path)
    context = {
        "{{department}}": data.department, "{{batch}}": data.batch, "{{semester}}": data.semester,
        "{{subject}}": data.subject, "{{examType}}": data.examType, "{{duration}}": data.duration,
        "{{paperSetter}}": data.paperSetter, "{{hod}}": data.hod,
    }
    mcqs = [q for q in data.questions if q.type == "MCQ"]
    short = [q for q in data.questions if q.type == "Short Answer"]
    long = [q for q in data.questions if q.type == "Long Essay"]

    for i in range(1, 11):
        context[f"{{{{A{i}}}}}"] = mcqs[i-1].answer if i <= len(mcqs) else ""

    q_num = 11
    for i in range(0, len(short), 2):
        a, m = parse_answer_and_marks(short[i].answer.replace('\\n', '\n'))
        context[f"{{{{A{q_num}a}}}}"] = a
        context[f"{{{{M{q_num}a}}}}"] = m
        if i + 1 < len(short):
            a2, m2 = parse_answer_and_marks(short[i+1].answer.replace('\\n', '\n'))
            context[f"{{{{A{q_num}b}}}}"] = a2
            context[f"{{{{M{q_num}b}}}}"] = m2
        q_num += 1

    q_num = 16
    for i in range(0, len(long), 2):
        a, m = parse_answer_and_marks(long[i].answer.replace('\\n', '\n'))
        context[f"{{{{A{q_num}a}}}}"] = a
        context[f"{{{{M{q_num}a}}}}"] = m
        if i + 1 < len(long):
            a2, m2 = parse_answer_and_marks(long[i+1].answer.replace('\\n', '\n'))
            context[f"{{{{A{q_num}b}}}}"] = a2
            context[f"{{{{M{q_num}b}}}}"] = m2
        q_num += 1
        
    doc = replace_placeholders(doc, context)
    file_path = TEMP_DIR / f"{data.subject}_Key_{random.randint(1000,9999)}.docx"
    doc.save(file_path)
    return FileResponse(path=file_path, filename=f"{data.subject}_Answer_Key.docx")

if __name__ == "__main__":
    import uvicorn
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    uvicorn.run(app, host="0.0.0.0", port=args.port)