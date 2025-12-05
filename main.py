import os
import re
import json
import random
import asyncio
from pathlib import Path
from dotenv import load_dotenv
import io

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Form
from fastapi.responses import RedirectResponse, HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from typing import List, Dict, Any
import logging
import pdfplumber
import bcrypt
from pydantic import BaseModel
from docx import Document
from docx.text.paragraph import Paragraph

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI

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
    mongo_uri = os.getenv("MONGO_URI", "mongodb+srv://edricjsam:edricjsam@cluster0.xnfedd7.mongodb.net/")
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

**Instructions for JSON structure:**
- Each question object MUST have exactly two keys: "question" and "answer".
- The "question" field's value MUST be a single string that includes the question text, followed by four options. Each option MUST start on a new line with `\\n` and then `A)`, `B)`, `C)`, `D)`.
- The "answer" field's value MUST be a single string containing ONLY the correct option's letter and its full text (e.g., "A) The correct answer").
- Return a single, valid JSON object with one key, "questions".

**Example 'question' format:** "What is 2+2?\\nA) 3\\nB) 4\\nC) 5\\nD) 6"

**Context:** {context}
""")


RUBRIC_BATCH_PROMPT = PromptTemplate.from_template("""
You are an expert question paper setter for **{subject}**.
Generate **{num_questions}** distinct {question_type} questions of {difficulty} difficulty, each worth {marks} marks.

**Instructions for the 'answer' field:**
1.  The entire answer MUST be a single JSON string.
2.  The answer MUST start with a bulleted list of key points. This is the rubric.
3.  Each bullet point MUST start with `\\n- `.
4.  Each bullet point MUST end with its specific mark allocation in parentheses, like `(2 marks)`.
5.  The total marks in the rubric MUST sum up to exactly {marks} marks.
6.  After the rubric, add the heading `\\n**Keywords:**`.
7.  Following the heading, provide a comma-separated list of 3-5 relevant keywords.

**Example 'answer' format:**
"\\n- Defines the critical region in hypothesis testing (2 marks)\\n- Explains how it's determined for a two-tailed test (2 marks)\\n- Explains how it's determined for a one-tailed test (2 marks)\\n- Explains its role in making a decision (2 marks)\\n**Keywords:** Critical Region, Hypothesis Testing, Significance Level, p-value"

**JSON Output:**
Return a single, valid JSON object with one key, "questions". Each object in the 'questions' list should have 'question' and 'answer' keys.

**Context:**
---
{context}
---
""")

# --- FASTAPI APP SETUP ---
app = FastAPI(title="Question Paper Generator", version="1.5.4")
BASE_DIR = Path(__file__).parent
LOGIN_DIR = BASE_DIR / "login"
GENERATOR_DIR = BASE_DIR / "generator"
TEMP_DIR = BASE_DIR / "temp"
TEMP_DIR.mkdir(exist_ok=True)

# Define Template Paths
TEMPLATE_DIR_DOCX = Path("D:/QP/templates")
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


# Mount static files for both login and generator pages
if LOGIN_DIR.exists():
    app.mount("/login_static", StaticFiles(directory=str(LOGIN_DIR), html=True), name="login_static")
app.mount("/generator", StaticFiles(directory=str(GENERATOR_DIR), html=True), name="generator")

# Import and mount the evaluator_app from main2.py
# Import and mount the evaluator_app from main2.py
from main2 import evaluator_app
app.mount("/evaluator", evaluator_app)

# Initialize Jinja2 templates for the login page
templates = Jinja2Templates(directory=str(LOGIN_DIR) if LOGIN_DIR.exists() else "templates")

# --- PYDANTIC MODELS FOR DOCX DOWNLOAD REQUESTS ---
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
        json_match = re.search(r'```json\s*(\{.*?\})\s*```', response_text, re.DOTALL)
        if not json_match:
            json_match = re.search(r'(\{.*?\})', response_text, re.DOTALL)
        
        if json_match:
            data = json.loads(json_match.group(1))
            questions = data.get("questions", [])
            return questions if isinstance(questions, list) else []
        logger.warning("No valid JSON found in LLM response.")
        return []
    except (json.JSONDecodeError, TypeError) as e:
        logger.error(f"Error parsing JSON output: {e}\nResponse: {response_text[:500]}")
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
    patterns = {
        "CIA": {"mcq": (10, 1), "short": (5, 4), "long": (2, 10)},
        "Model": {"mcq": (10, 1), "short": (5, 5), "long": (5, 8)}
    }
    config = patterns.get(pattern)
    if not config:
        raise ValueError(f"Invalid pattern '{pattern}'. Must be 'CIA' or 'Model'")

    num_mcq, marks_mcq = config["mcq"]
    num_short, marks_short = config["short"]
    num_long, marks_long = config["long"]
    
    context_sample = "\n---\n".join(random.sample(list(docs_content), min(len(docs_content), 5)))

    paper = {"MCQ": [], "Short": [], "Long": []}

    logger.info(f"Generating {num_mcq} MCQs...")
    paper["MCQ"] = await run_batch_query(MCQ_BATCH_PROMPT, "MCQ", num_mcq, marks_mcq, context_sample, subject, difficulty)
    logger.info(f"Received {len(paper['MCQ'])} MCQs.")

    logger.info(f"Generating {num_short * 2} Short Answer questions...")
    paper["Short"] = await run_batch_query(RUBRIC_BATCH_PROMPT, "Short Answer", num_short * 2, marks_short, context_sample, subject, difficulty)
    logger.info(f"Received {len(paper['Short'])} Short Answer questions.")

    logger.info(f"Generating {num_long * 2} Long Essay questions...")
    paper["Long"] = await run_batch_query(RUBRIC_BATCH_PROMPT, "Long Essay", num_long * 2, marks_long, context_sample, subject, difficulty)
    logger.info(f"Received {len(paper['Long'])} Long Essay questions.")

    for item in paper["MCQ"]: item["marks"] = marks_mcq
    for item in paper["Short"]:
        item["marks"] = marks_short
    for item in paper["Long"]:
        item["marks"] = marks_long
        
    return paper

# --- DOCX HELPER FUNCTIONS ---

def replace_text_in_paragraph(paragraph: Paragraph, context: Dict[str, str]):
    """
    Replaces placeholders in a paragraph, handling split runs.
    """
    full_text = "".join(run.text for run in paragraph.runs)

    if '{{' not in full_text:
        return

    for key, value in context.items():
        if key in full_text:
            full_text = full_text.replace(key, str(value))

    for run in paragraph.runs:
        p = paragraph._p
        p.remove(run._r)

    if full_text:
        lines = full_text.split('\n')
        for i, line in enumerate(lines):
            if i > 0:
                paragraph.add_run().add_break()
            paragraph.add_run(line)

def replace_placeholders(doc: Document, context: Dict[str, str]):
    """Iterates through a docx file and robustly replaces placeholders."""
    for p in doc.paragraphs:
        replace_text_in_paragraph(p, context)
    
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    replace_text_in_paragraph(p, context)

    # Replace placeholders in headers
    for section in doc.sections:
        header = section.header
        for p in header.paragraphs:
            replace_text_in_paragraph(p, context)
        for table in header.tables:
            for row in table.rows:
                for cell in row.cells:
                    for p in cell.paragraphs:
                        replace_text_in_paragraph(p, context)

    # Replace placeholders in footers
    for section in doc.sections:
        footer = section.footer
        for p in footer.paragraphs:
            replace_text_in_paragraph(p, context)
        for table in footer.tables:
            for row in table.rows:
                for cell in row.cells:
                    for p in cell.paragraphs:
                        replace_text_in_paragraph(p, context)

    return doc

def parse_answer_and_marks(answer_text: str):
    """
    Parses an answer string line-by-line to separate rubric text from mark allocations,
    ensuring perfect parallel alignment.
    """
    if not answer_text:
        return "", ""
    
    lines = answer_text.strip().split('\n')
    cleaned_answer_lines = []
    formatted_marks_lines = []
    
    # Regex to find a mark allocation at the end of a line
    mark_pattern = re.compile(r'\s*\((\d+)\s*marks?\)$')

    for line in lines:
        line = line.strip()
        match = mark_pattern.search(line)
        
        if match:
            # A mark was found on this line
            mark_number = match.group(1)
            # Add the mark to the marks list
            formatted_marks_lines.append(f"({mark_number})")
            # Remove the mark from the answer line
            cleaned_line = mark_pattern.sub('', line)
            cleaned_answer_lines.append(cleaned_line)
        else:
            # No mark was found on this line
            cleaned_answer_lines.append(line)
            # Add an empty string to the marks list to maintain alignment
            formatted_marks_lines.append("")

    # Join the processed lines back together
    final_cleaned_answer = "\n".join(cleaned_answer_lines)
    final_formatted_marks = "\n".join(formatted_marks_lines)
    
    return final_cleaned_answer, final_formatted_marks


# --- API ENDPOINTS ---
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("login.html", {"request": request, "error_message": None})

@app.post("/login")
async def login(request: Request, email: str = Form(...), password: str = Form(...)):
    if not email or not password:
        return templates.TemplateResponse("login.html", {"request": request, "error_message": "Email and password are required"})
    
    try:
        user = db["users"].find_one({"email": email})
        if user and bcrypt.checkpw(password.encode('utf-8'), user["password"].encode('utf-8')):
            return RedirectResponse(url="/generator/", status_code=303)
        else:
            return templates.TemplateResponse("login.html", {"request": request, "error_message": "Invalid credentials"})
    except Exception as e:
        logger.error(f"Login error: {e}")
        return templates.TemplateResponse("login.html", {"request": request, "error_message": "An error occurred during login."})


@app.get("/departments")
async def get_departments():
    return list(db["departments"].find({}, {"_id": 0, "value": 1, "label": 1}))

@app.get("/details/{department}")
async def get_details_by_department(department: str):
    return list(db["details"].find({"department": department}, {"_id": 0}))

@app.post("/upload-syllabus")
async def upload_syllabus(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    temp_file_path = TEMP_DIR / f"temp_{random.randint(1000, 9999)}_{file.filename}"
    try:
        with open(temp_file_path, "wb") as f:
            f.write(await file.read())
        units = extract_units_from_pdf(str(temp_file_path))
        if not units:
            raise HTTPException(status_code=422, detail="Could not extract units from the syllabus")
        return {"units": units}
    finally:
        if temp_file_path.exists():
            temp_file_path.unlink()

@app.post("/generate-questions")
async def generate_questions(request: Request):
    try:
        data = await request.json()
        
        exam_type = data.get("exam_type")
        if exam_type == "Models":
            exam_type = "Model"

        doc_chunks = create_document_chunks(data.get("selected_units", []))
        if not doc_chunks:
            raise HTTPException(status_code=422, detail="Failed to process content from selected units.")
        
        doc_contents = tuple(doc.page_content for doc in doc_chunks)
        paper = await generate_question_paper(
            doc_contents, data["subject"], exam_type, data["difficulty"]
        )
        
        expected_mcqs = { "CIA": 10, "Model": 10 }.get(exam_type, 0)
        if len(paper.get("MCQ", [])) < expected_mcqs:
            logger.warning(f"Generated only {len(paper.get('MCQ', []))} MCQs, but expected {expected_mcqs}. The syllabus content might be insufficient for more.")

        return {"question_paper": paper}
    except (KeyError, TypeError):
        raise HTTPException(status_code=400, detail="Missing required parameters in request.")
    except Exception as e:
        logger.error(f"Error generating questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- DOCX DOWNLOAD ENDPOINTS ---
@app.post("/download-paper")
async def download_paper(data: DownloadRequest):
    exam_type = "Model" if data.examType == "Models" else data.examType
    template_path = TEMPLATE_PATHS.get(exam_type, {}).get("paper")

    if not template_path or not template_path.exists():
        raise HTTPException(status_code=404, detail=f"Template not found at path: {template_path}")

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
            context["{{Q" + str(i) + "}}"] = parts[0]
            context["{{Q" + str(i) + "_A}}"] = parts[1] if len(parts) > 1 else ""
            context["{{Q" + str(i) + "_B}}"] = parts[2] if len(parts) > 2 else ""
            context["{{Q" + str(i) + "_C}}"] = parts[3] if len(parts) > 3 else ""
            context["{{Q" + str(i) + "_D}}"] = parts[4] if len(parts) > 4 else ""
    
    q_num = 11
    for i in range(0, len(short_answers), 2):
        context["{{Q" + str(q_num) + "a}}"] = short_answers[i].text
        context["{{Q" + str(q_num) + "b}}"] = short_answers[i + 1].text if i + 1 < len(short_answers) else ""
        q_num += 1

    q_num = 16
    for i in range(0, len(long_essays), 2):
        context["{{Q" + str(q_num) + "a}}"] = long_essays[i].text
        context["{{Q" + str(q_num) + "b}}"] = long_essays[i + 1].text if i + 1 < len(long_essays) else ""
        q_num += 1

    doc = replace_placeholders(doc, context)
    
    file_path = TEMP_DIR / f"{data.subject}_QP_{random.randint(1000,9999)}.docx"
    doc.save(file_path)
    return FileResponse(path=file_path, media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename=f"{data.subject}_Question_Paper.docx")

@app.post("/download-key")
async def download_key(data: DownloadRequest):
    exam_type = "Model" if data.examType == "Models" else data.examType
    template_path = TEMPLATE_PATHS.get(exam_type, {}).get("key")
    if not template_path or not template_path.exists():
        raise HTTPException(status_code=404, detail=f"Answer key template not found at path: {template_path}")
    
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
        context["{{A" + str(i) + "}}"] = mcqs[i-1].answer if i <= len(mcqs) else ""

    q_num = 11
    for i in range(0, len(short_answers), 2):
        answer_text_a = short_answers[i].answer.replace('\\n', '\n')
        cleaned_answer_a, formatted_marks_a = parse_answer_and_marks(answer_text_a)
        context["{{A" + str(q_num) + "a}}"] = cleaned_answer_a
        context["{{M" + str(q_num) + "a}}"] = formatted_marks_a
        
        if i + 1 < len(short_answers):
            answer_text_b = short_answers[i+1].answer.replace('\\n', '\n')
            cleaned_answer_b, formatted_marks_b = parse_answer_and_marks(answer_text_b)
            context["{{A" + str(q_num) + "b}}"] = cleaned_answer_b
            context["{{M" + str(q_num) + "b}}"] = formatted_marks_b
        else:
            context["{{A" + str(q_num) + "b}}"] = ""
            context["{{M" + str(q_num) + "b}}"] = ""
        q_num += 1

    q_num = 16
    for i in range(0, len(long_essays), 2):
        answer_text_a = long_essays[i].answer.replace('\\n', '\n')
        cleaned_answer_a, formatted_marks_a = parse_answer_and_marks(answer_text_a)
        context["{{A" + str(q_num) + "a}}"] = cleaned_answer_a
        context["{{M" + str(q_num) + "a}}"] = formatted_marks_a

        if i + 1 < len(long_essays):
            answer_text_b = long_essays[i+1].answer.replace('\\n', '\n')
            cleaned_answer_b, formatted_marks_b = parse_answer_and_marks(answer_text_b)
            context["{{A" + str(q_num) + "b}}"] = cleaned_answer_b
            context["{{M" + str(q_num) + "b}}"] = formatted_marks_b
        else:
            context["{{A" + str(q_num) + "b}}"] = ""
            context["{{M" + str(q_num) + "b}}"] = ""
        q_num += 1
        
    doc = replace_placeholders(doc, context)
    
    file_path = TEMP_DIR / f"{data.subject}_Key_{random.randint(1000,9999)}.docx"
    doc.save(file_path)
    return FileResponse(path=file_path, media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename=f"{data.subject}_Answer_Key.docx")


if __name__ == "__main__":
    import uvicorn
    import argparse

    parser = argparse.ArgumentParser(description="Run the FastAPI application.")
    parser.add_argument("--port", type=int, default=8000, help="Port number to run the server on.")
    args = parser.parse_args()

    uvicorn.run(app, host="0.0.0.0", port=args.port)