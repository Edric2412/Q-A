import os
import shutil
import json
import datetime
import pdfplumber
import docx
import openpyxl
# FIX: Added specific openpyxl imports
from openpyxl import Workbook
from openpyxl.styles import PatternFill, Font, Alignment

from io import BytesIO
from dotenv import load_dotenv
import google.generativeai as genai
from sentence_transformers import SentenceTransformer, util
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

# FIX: Added logging import
import logging

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

import re
import motor.motor_asyncio
from bson import ObjectId
from pathlib import Path

# Load environment variables
load_dotenv()

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure FastAPI app
evaluator_app = FastAPI(
    title="Answer Paper Evaluation API",
    description="A FastAPI backend for AI-powered answer paper evaluation using MiniLM and Gemini.",
    version="1.0.0",
)

# CORS configuration
origins = ["*"]
evaluator_app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Configuration ====================
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
db = client.QP

# --- AI Model Setup ---
# Check both keys to ensure compatibility with main.py
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel('gemini-2.5-flash')
    print("SUCCESS: Gemini Model initialized.")
else:
    print("ERROR: GOOGLE_API_KEY not found. Gemini features will fail.")
    gemini_model = None

# Load Sentence Transformer model
try:
    minilm_model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
    print("SUCCESS: MiniLM Model initialized.")
except Exception as e:
    print(f"Warning: Could not load MiniLM model. Error: {e}")
    minilm_model = None

# --- Pydantic Models ---
class Student(BaseModel):
    roll_no: str
    name: str

class StudentListRequest(BaseModel):
    department: str
    batch: str
    semester: Optional[str] = None
    subject: Optional[str] = None
    exam_type: Optional[str] = None
    exam_id: Optional[str] = None

class MarkUpdateRequest(BaseModel):
    exam_id: str
    roll_no: str
    question_num: int
    new_mark: float

# --- Helper Functions ---
# In main2.py

def parse_docx_table_data(file_path: str, is_question_paper: bool = False) -> List[Dict[str, Any]]:
    doc = docx.Document(file_path)
    items = []
    current_text = ""
    
    # Regex to ensure the row starts with a number (e.g., "1", "10", "11a")
    valid_q_pattern = re.compile(r'^\d+') 

    for table in doc.tables:
        for row in table.rows:
            cells = row.cells
            if len(cells) < 2: continue
            
            col0_text = cells[0].text.strip()
            col1_text = cells[1].text.strip()
            marks_text = cells[2].text.strip() if len(cells) > 2 else ""

            # Skip Header Rows
            if "Q.No" in col0_text or "Answers" in col1_text:
                continue

            # LOGIC FOR QUESTION PAPER
            if is_question_paper:
                # Only treat it as a new question if col0 has a number
                if col0_text and valid_q_pattern.match(col0_text):
                    if current_text:
                        items.append({'text': current_text.strip(), 'marks': 0})
                    current_text = col1_text 
                elif col1_text and current_text:
                    current_text += f"\n{col1_text}"

            # LOGIC FOR ANSWER KEY (Strict)
            else:
                # STRICT FIX: Only accept rows where Col 0 starts with a number
                if col0_text and col1_text and valid_q_pattern.match(col0_text):
                    if "(OR)" not in col0_text:
                        # Parse marks
                        found_marks = re.findall(r'\(?(\d+)\)?', marks_text)
                        row_marks = sum(float(m) for m in found_marks) if found_marks else 1.0
                        items.append({'text': col1_text, 'marks': row_marks})

    if is_question_paper and current_text:
        items.append({'text': current_text.strip(), 'marks': 0})
        
    return items

def parse_student_text(text: str) -> Dict[str, str]:
    """
    Intelligently extracts answers looking for:
    1. '1.', '1)', '1-', '1:'
    2. 'Q1.', 'Ans 1', 'Answer 1'
    3. '11a', '11 a'
    """
    # FIX: Added '[:]' to regex to support "Answer 11:"
    pattern = re.compile(r'(?:^|\n)(?:Q\.?|Ans\.?|Answer)?\s*(\d+(?:\s*[a-zA-Z])?)\s*[.)\-\:]')
    
    splits = pattern.split(text)
    parsed_answers = {}
    
    for i in range(1, len(splits), 2):
        q_num = splits[i].replace(" ", "").lower()
        answer_text = splits[i+1].strip()
        parsed_answers[q_num] = answer_text
        
    if not parsed_answers:
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        for idx, para in enumerate(paragraphs):
            parsed_answers[str(idx + 1)] = para
            
    return parsed_answers
    
def extract_text_from_pdf(file_path: str) -> str:
    with pdfplumber.open(file_path) as pdf:
        return "".join(page.extract_text() for page in pdf.pages if page.extract_text())

def extract_text_from_docx(file_path: str) -> str:
    doc = docx.Document(file_path)
    return "\n".join(para.text for para in doc.paragraphs)

def extract_text(file_path: str) -> str:
    if file_path.endswith(".pdf"):
        return extract_text_from_pdf(file_path)
    elif file_path.endswith(".docx"):
        return extract_text_from_docx(file_path)
    return ""

def extract_student_identity(text: str) -> str:
    """
    Extracts the Roll Number from the student paper text.
    Matches formats like: "Roll No : 23BDS001", "Roll Number: 23BDS002"
    """
    # Pattern explanation:
    # (?i)       -> Case insensitive
    # Roll\s* -> Matches "Roll" followed by optional space
    # (?:No|Number|\.)? -> Matches "No", "Number", or "." optionally
    # \s*[:\-\.]? -> Matches optional separator (: - .)
    # \s* -> Optional whitespace
    # ([A-Z0-9]+) -> Capture the Alphanumeric ID (The Roll No)
    match = re.search(r"(?i)Roll\s*(?:No|Number|\.)?\s*[:\-\.]?\s*([A-Z0-9]+)", text)
    
    if match:
        return match.group(1).upper().strip()
    return None

# --- API Endpoints ---

@evaluator_app.get("/get-metadata")
async def get_metadata():
    try:
        departments = await db.departments.find({}, {"_id": 0}).to_list(length=None) # _id: 0 excludes it entirely (Safest)
        
        # For details, we might need the ID, so let's convert it if it exists
        details_cursor = db.details.find({})
        details = []
        async for doc in details_cursor:
            doc["_id"] = str(doc["_id"]) # Convert ObjectId to string
            details.append(doc)
            
        return {"departments": departments, "details": details} 
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@evaluator_app.post("/get-students")
async def get_students(request: StudentListRequest):
    try:
        # 1. Exact Match
        query = {"department": request.department, "batch": request.batch}
        students_doc = await db.students.find_one(query)
        
        # 2. Flexible Match
        if not students_doc:
            batch_clean = request.batch.replace(" ", "")
            students_doc = await db.students.find_one({"department": request.department, "batch": batch_clean})

        if not students_doc:
            batch_spaced = request.batch.replace("-", " - ")
            students_doc = await db.students.find_one({"department": request.department, "batch": batch_spaced})
            
        if students_doc:
            # FIX: Convert ObjectId to string to avoid the 500 Error
            students_doc["_id"] = str(students_doc["_id"])
            return {
                "students": students_doc.get("students", []),
                "exam_id": request.exam_id
            }
        else:
             return {
                "students": [],
                "exam_id": request.exam_id
            }

    except Exception as e:
        print(f"ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@evaluator_app.post("/upload-files")
async def upload_files(
    exam_id: str = Form(...),
    question_paper: UploadFile = File(...),
    answer_key: UploadFile = File(...),
    student_papers: List[UploadFile] = File(...)
):
    upload_dir = f"./uploads/{exam_id}"
    os.makedirs(upload_dir, exist_ok=True)
    file_paths = {}

    try:
        qp_path = os.path.join(upload_dir, question_paper.filename)
        with open(qp_path, "wb") as buffer:
            shutil.copyfileobj(question_paper.file, buffer)
        file_paths["question_paper"] = qp_path

        ak_path = os.path.join(upload_dir, answer_key.filename)
        with open(ak_path, "wb") as buffer:
            shutil.copyfileobj(answer_key.file, buffer)
        file_paths["answer_key"] = ak_path

        sp_paths = []
        for paper in student_papers:
            sp_path = os.path.join(upload_dir, paper.filename)
            with open(sp_path, "wb") as buffer:
                shutil.copyfileobj(paper.file, buffer)
            sp_paths.append(sp_path)
        file_paths["student_papers"] = sp_paths

        return JSONResponse(status_code=200, content={"message": "Files uploaded successfully", "files": file_paths})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {e}")

# In main2.py

@evaluator_app.post("/evaluate")
async def evaluate(
    exam_id: str = Form(...),
    question_paper_path: str = Form(...),
    answer_key_path: str = Form(...),
    student_papers_paths_str: str = Form(..., alias="student_papers_paths"),
    students_list_str: str = Form(..., alias="students_list"),
):
    if not minilm_model or not gemini_model:
        raise HTTPException(status_code=503, detail="AI models not available.")

    async def evaluation_stream():
        try:
            student_papers_paths = json.loads(student_papers_paths_str)
            students_list = json.loads(students_list_str)
            
            # --- 0. PRE-PROCESS STUDENT LIST ---
            # Create a lookup map: {'23BDS001': {name: 'Athi', ...}, '23BDS002': ...}
            student_map = {s['roll_no'].upper(): s for s in students_list}

            # --- 1. PARSE TEACHER FILES ---
            if question_paper_path.endswith(".docx"):
                qp_data = parse_docx_table_data(question_paper_path, is_question_paper=True)
                questions = [q['text'] for q in qp_data]
            else:
                q_text = extract_text(question_paper_path)
                questions = [q.strip() for q in q_text.split("Q.")[1:] if q.strip()]

            if answer_key_path.endswith(".docx"):
                model_data = parse_docx_table_data(answer_key_path, is_question_paper=False)
            else:
                a_text = extract_text(answer_key_path)
                model_data = [{'text': a.strip(), 'marks': 10.0} for a in a_text.split("A.")[1:] if a.strip()]

            if not questions or not model_data:
                yield json.dumps({"type": "error", "message": "Could not parse QP or Key."}) + "\n"
                return

            results = []
            
            # Total steps based on FILES uploaded, not strictly students in list
            # (Since we might have extra files or missing files)
            total_files = len(student_papers_paths)
            total_questions = len(questions)
            total_steps = total_files * total_questions
            current_step = 0

            # --- 2. EVALUATE FILES (Order doesn't matter now) ---
            for idx, student_paper_path in enumerate(student_papers_paths):
                
                # A. Extract Text & Identity
                student_text = extract_text(student_paper_path)
                detected_roll_no = extract_student_identity(student_text)
                
                # B. Match File to Student
                if detected_roll_no and detected_roll_no in student_map:
                    student_info = student_map[detected_roll_no]
                    student_name = student_info['name']
                    # Remove from map so we know who is missing later? (Optional)
                else:
                    # Fallback: Create a dummy identity or log error
                    # If Roll No is missing in text, we can't reliably grade it against a record
                    student_info = {
                        "roll_no": detected_roll_no if detected_roll_no else f"UNKNOWN_{idx}",
                        "name": "Unknown Student"
                    }
                    student_name = "Unknown Student"
                    # We continue grading, but the result might not link to DB correctly
                
                # C. Parse Answers
                student_answers_dict = parse_student_text(student_text)
                
                marks = {}
                total_marks = 0

                # D. Grading Loop
                for i, (question, model_entry) in enumerate(zip(questions, model_data)):
                    model_answer = model_entry['text']
                    max_score = model_entry['marks']
                    
                    expected_key = str(i + 1)
                    if expected_key in student_answers_dict:
                        student_answer = student_answers_dict[expected_key]
                    else:
                        all_vals = list(student_answers_dict.values())
                        student_answer = all_vals[i] if i < len(all_vals) else ""

                    q_label = f"Q{i+1}"
                    final_score = 0.0
                    
                    if student_answer:
                        # 1. MiniLM
                        embedding1 = minilm_model.encode(model_answer, convert_to_tensor=True)
                        embedding2 = minilm_model.encode(student_answer, convert_to_tensor=True)
                        similarity = util.pytorch_cos_sim(embedding1, embedding2).item()
                        minilm_score = similarity * max_score
                        final_score = minilm_score
                        
                        # 2. Gemini Hybrid Logic
                        # Use Gemini for Theory (>1 mark) OR low confidence matches
                        if max_score > 1.0: 
                            # Check if strict match failed or needs nuance
                            if (0.4 <= similarity <= 0.85) or (len(student_answer.split()) > 15) or (max_score >= 4):
                                try:
                                    prompt = f"Act as an evaluator.\nQ: {question}\nRubric: {model_answer}\nStudent: {student_answer}\nMax Marks: {max_score}\nReturn numeric score only."
                                    response = gemini_model.generate_content(prompt)
                                    gemini_text = re.search(r"[\d\.]+", response.text)
                                    if gemini_text:
                                        gemini_score = float(gemini_text.group())
                                        final_score = 0.3 * minilm_score + 0.7 * gemini_score
                                except:
                                    pass
                        # For 1 Mark questions, stick to MiniLM or strict matching (implied)

                    raw_score = max(0.0, min(max_score, final_score))
                    
                    # 2. Round to nearest 0.25
                    # Formula: round(score * 4) / 4
                    # Example: 1.63 * 4 = 6.52 -> round to 7 -> 7 / 4 = 1.75
                    rounded_score = round(raw_score * 4) / 4
                    
                    marks[q_label] = rounded_score
                    total_marks += marks[q_label]                   
                    
                    current_step += 1
                    progress_percent = int((current_step / total_steps) * 100)
                    
                    yield json.dumps({
                        "type": "progress", 
                        "value": progress_percent, 
                        "message": f"Grading {student_name} (Q{i+1})"
                    }) + "\n"

                result_doc = {
                    "roll_no": student_info["roll_no"],
                    "name": student_info["name"],
                    "exam_id": exam_id,
                    "marks": marks,
                    "total": round(total_marks, 2),
                    "timestamp": datetime.datetime.utcnow().isoformat(),
                }
                
                await db.evaluations.insert_one(result_doc)
                result_doc["_id"] = str(result_doc["_id"])
                results.append(result_doc)

            yield json.dumps({"type": "complete", "status": "success", "results": results}) + "\n"

        except Exception as e:
            logger.error(f"Stream Error: {e}")
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(evaluation_stream(), media_type="application/x-ndjson")

@evaluator_app.post("/update-marks")
async def update_marks(request: MarkUpdateRequest):
    try:
        evaluation = await db.evaluations.find_one({"exam_id": request.exam_id, "roll_no": request.roll_no})
        
        if not evaluation:
            raise HTTPException(status_code=404, detail="Evaluation not found")

        evaluation["marks"][f"Q{request.question_num}"] = request.new_mark
        evaluation["total"] = sum(evaluation["marks"].values())

        await db.evaluations.update_one(
            {"_id": evaluation["_id"]},
            {"$set": {"marks": evaluation["marks"], "total": evaluation["total"]}}
        )
        return {"status": "success", "message": "Marks updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@evaluator_app.get("/export-excel")
async def export_excel(exam_id: str):
    try:
        evaluations = await db.evaluations.find({"exam_id": exam_id}).to_list(length=None)
        
        if not evaluations:
            raise HTTPException(status_code=404, detail="No evaluations found")
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Results"
        
        header_fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF")
        
        first_eval = evaluations[0]
        # Sort Q1, Q2, Q10 correctly
        question_nums = sorted(first_eval["marks"].keys(), key=lambda x: int(x[1:]) if x[1:].isdigit() else 999)
        
        headers = ["Roll No", "Student Name"] + question_nums + ["Total", "Percentage"]
        
        for col_num, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_num, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center")
        
        max_marks = len(question_nums) * 10
        
        for row_num, eval_data in enumerate(evaluations, 2):
            ws.cell(row=row_num, column=1, value=eval_data["roll_no"])
            ws.cell(row=row_num, column=2, value=eval_data["name"])
            
            col_num = 3
            for q_num in question_nums:
                ws.cell(row=row_num, column=col_num, value=eval_data["marks"].get(q_num, 0))
                col_num += 1
            
            total = eval_data["total"]
            percentage = (total / max_marks) * 100 if max_marks > 0 else 0
            
            ws.cell(row=row_num, column=col_num, value=total)
            ws.cell(row=row_num, column=col_num + 1, value=f"{percentage:.2f}%")
        
        UPLOAD_DIR = Path("./uploads")
        filename = f"evaluation_results_{exam_id}.xlsx"
        filepath = UPLOAD_DIR / filename
        wb.save(filepath)
        
        return FileResponse(
            filepath,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename
        )
        
    except Exception as e:
        logger.error(f"Error generating Excel: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Mount frontend at root
if os.path.exists("evaluator"):
    evaluator_app.mount("/", StaticFiles(directory="evaluator", html=True), name="static")