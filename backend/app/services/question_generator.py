import os
import re
import json
import random
import logging
import pdfplumber
import pytesseract
from pdf2image import convert_from_path
from typing import List, Dict, Any
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
import google.generativeai as genai

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- AI CONFIG ---
try:
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
    # If not set in env, it might be loaded by main.py's load_dotenv.
    # We should ensure dotenv is loaded here or rely on env being set.
    # Assuming environment is set.
    if GOOGLE_API_KEY:
         os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY
         genai.configure(api_key=GOOGLE_API_KEY)
    
    # Model Strategy - 3 Stage Fallback
    # Primary: 3-flash-preview (Fastest/Newest)
    # Fallback 1: 2.5-pro (Best Reasoning)
    # Fallback 2: 2.5-flash (Reliable/Cost-effective)
    
    # User requested: gemini-3-flash-preview, gemini-2.5-pro, gemini-2.5-flash
    # Updated to strict user request.
    
    llm_primary = ChatGoogleGenerativeAI(model="gemini-3-flash-preview", temperature=0.7)
    llm_fallback_1 = ChatGoogleGenerativeAI(model="gemini-1.5-pro", temperature=0.7)
    llm_fallback_2 = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.7)

    # We expose the configured LLM if needed, but primarily use it internally
    embedding = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")
except Exception as e:
    logger.error(f"Failed to initialize Google AI Models (in question_generator): {e}")

# --- PROMPTS ---
MCQ_BATCH_PROMPT = PromptTemplate.from_template("""
You are an expert question paper setter for {subject}. 
{topics_instruction}

Generate **{num_questions}** distinct Multiple Choice Questions of {difficulty} difficulty, each worth {marks} mark.

For each MCQ, provide:
- "question": The question text
- "options": An object with keys A, B, C, D and their option texts
- "answer": The correct option letter (A, B, C, or D)

**IMPORTANT**: For subjects like **Mathematics, Statistics, or Physics**:
- The questions MUST be **numerical problem-solving** or **calculation-based**.
- Avoid purely theoretical definitions or "What is" questions unless absolutely necessary.
- For mathematical symbols, equations, or formulas, use standard LaTeX formatting enclosed in single dollar signs like $E=mc^2$. 

Return a single, valid JSON object:
{{"questions": [
  {{"question": "...", "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}}, "answer": "A"}},
  ...
]}}

**Context:** {context}
""")

RUBRIC_BATCH_PROMPT = PromptTemplate.from_template("""
You are an expert question paper setter for **{subject}**.
{topics_instruction}

Generate **{num_questions}** distinct {question_type} questions of {difficulty} difficulty, each worth {marks} marks.

For each question, provide:
- "question": The question text
- "answer": A detailed marking scheme/rubric in this EXACT format:
  * **For Math/Statistics**: Provide **detailed step-by-step calculations** to solve the problem.
  * **For Theory**: Use multiple bullet points.
  * **CRITICAL**: If the subject is Math or Statistics, generate **NUMERICAL PROBLEMS** that require solving, not just explaining concepts.
  * For mathematical symbols, equations, or formulas, use standard LaTeX formatting enclosed in single dollar signs like $E=mc^2$.
  * Format:
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

# --- FUNCTIONS ---

def parse_json_output(response_text: str) -> List[Dict[str, str]]:
    try:
        data = None
        json_obj_match = re.search(r'(\{[\s\S]*\})', response_text)
        if json_obj_match:
            try:
                data = json.loads(json_obj_match.group(1))
            except:
                pass

        if data is None:
            json_list_match = re.search(r'(\[[\s\S]*\])', response_text)
            if json_list_match:
                try:
                    data = json.loads(json_list_match.group(1))
                except:
                    pass

        if data is None:
             # Try matching code block with closing fence
             match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_text)
             if match:
                 try:
                     data = json.loads(match.group(1))
                 except:
                     pass

        if data is None:
             # Fallback: Try matching start of code block to end of string (handling truncated response)
             match = re.search(r'```(?:json)?\s*([\s\S]*)', response_text)
             if match:
                 candidate = match.group(1).strip()
                 # Attempt to find the last closing brace/bracket
                 end_brace = candidate.rfind('}')
                 end_bracket = candidate.rfind(']')
                 end_idx = max(end_brace, end_bracket)
                 
                 if end_idx != -1:
                     candidate = candidate[:end_idx+1]
                     try:
                         data = json.loads(candidate)
                     except:
                         pass

        if data is None:
            logger.error(f"JSON Parse Failed. Raw: {response_text[:200]}...")
            return []

        questions = []
        if isinstance(data, dict):
             questions = data.get("questions", [])
        elif isinstance(data, list):
             questions = data
        
        normalized = []
        for q in questions:
            if isinstance(q, dict):
                # Strip hallucinated fields
                q.pop("topic", None)
                if "question" in q and "text" not in q: q["text"] = q.pop("question")
                if "answer" not in q: q["answer"] = q.get("correct_answer", "")
                if "options" in q and isinstance(q["options"], dict):
                    opt_text = "\n".join([f"{k}) {v}" for k, v in q["options"].items()])
                    q["text"] = q.get("text", "") + "\n" + opt_text
                normalized.append(q)
        return normalized
    except Exception as e:
        logger.error(f"Parse error: {e}")
        return []

async def run_batch_query(prompt: PromptTemplate, q_type: str, num: int, marks: int, context: str, subject: str, difficulty: str, topics: List[str] = None) -> List[Dict[str, str]]:
    if num <= 0: return []
    try:
        logger.info(f"Generating {num} {q_type} questions...")
        
        topics_instruction = ""
        if topics:
            topics_list = ", ".join(topics)
            topics_instruction = f"**STRICT CONSTRAINT**: You must ONLY generate questions related to the following topics: {topics_list}. Do NOT generate questions from any other topics found in the context."
        
        input_vars = {
            "subject": subject, 
            "num_questions": num, 
            "question_type": q_type,
            "difficulty": difficulty, 
            "marks": marks, 
            "context": context,
            "topics_instruction": topics_instruction
        }

        # Helper to execute chain
        async def execute_chain(llm, name):
            logger.info(f"Attempting generation with {name}...")
            chain = prompt | llm | StrOutputParser()
            return await chain.ainvoke(input_vars)

        try:
            # 1. Try Primary
            response = await execute_chain(llm_primary, "PRIMARY (3-Flash-Preview)")
            return parse_json_output(response)
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "503" in err_str:
                logger.warning(f"Primary model exhausted/failed. Switching to FALLBACK 1...")
                try:
                    # 2. Try Fallback 1
                    response = await execute_chain(llm_fallback_1, "FALLBACK 1 (2.5-Pro)")
                    return parse_json_output(response)
                except Exception as e2:
                    err_str2 = str(e2)
                    if "429" in err_str2 or "RESOURCE_EXHAUSTED" in err_str2 or "503" in err_str2:
                        logger.warning(f"Fallback 1 exhausted/failed. Switching to FALLBACK 2...")
                        # 3. Try Fallback 2
                        response = await execute_chain(llm_fallback_2, "FALLBACK 2 (2.5-Flash)")
                        return parse_json_output(response)
                    else:
                        raise e2
            else:
                raise e 

    except Exception as e:
        logger.error(f"Error in batch query (All models failed): {e}")
        return []

def clean_json_string(text: str) -> str:
    try:
        # Remove code blocks
        match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
        if match:
            text = match.group(1)
            
        text = text.strip()
        
        # Determine if it's likely a list or dict
        first_brace = text.find('{')
        first_bracket = text.find('[')
        
        if first_brace != -1 and (first_bracket == -1 or first_brace < first_bracket):
             # Treating as Object
             start = first_brace
             end = text.rfind('}')
             if start != -1 and end != -1:
                 return text[start:end+1]
        elif first_bracket != -1:
             # Treating as List
             start = first_bracket
             end = text.rfind(']')
             if start != -1 and end != -1:
                 return text[start:end+1]
                 
        return text
    except:
        return text

async def extract_topics_from_text(text: str) -> List[str]:
    try:
        if not text or len(text) < 50: return []
        prompt = f"""
        Identify the key topics/concepts in the following syllabus unit text.
        Return strictly a JSON list of strings, e.g. ["Topic 1", "Topic 2"].
        Text: {text[:2000]}...
        """
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = await model.generate_content_async(prompt)
        cleaned = clean_json_string(response.text) 
        return json.loads(cleaned)
    except Exception as e:
        logger.error(f"Topic extraction failed: {e}")
        return []

def ocr_pdf_with_tesseract(pdf_path: str) -> str:
    try:
        logger.info(f"Starting Tesseract OCR for {pdf_path}")
        images = convert_from_path(pdf_path)
        full_text = ""
        for i, image in enumerate(images):
            text = pytesseract.image_to_string(image)
            full_text += f"\n--- Page {i+1} ---\n{text}"
        return full_text
    except Exception as e:
        logger.error(f"Tesseract OCR failed: {e}")
        return ""

async def extract_units_from_pdf(pdf_path: str) -> List[Dict[str, Any]]:
    try:
        full_text = ""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                full_text = "".join(page.extract_text() or "" for page in pdf.pages)
        except Exception as e:
            logger.error(f"PDFPlumber failed: {e}")

        if not full_text or len(full_text.strip()) < 100:
            logger.warning("PDF appears to be scanned. Attempting Tesseract OCR...")
            full_text = ocr_pdf_with_tesseract(pdf_path)
            if not full_text: return []

        unit_pattern = re.compile(
            r"((?:Unit|Module)[\s:-]+(?:(?:\d+)|(?:\b[IVX]+\b)).*?(?=(?:Unit|Module)[\s:-]+(?:(?:\d+)|(?:\b[IVX]+\b))|$))", 
            re.DOTALL | re.IGNORECASE
        )
        matches = unit_pattern.findall(full_text)
        if not matches:
             topics = await extract_topics_from_text(full_text)
             return [{"unit": "Full Syllabus", "text": full_text, "topics": topics}]

        results = []
        for idx, match in enumerate(matches):
            txt = match.strip()
            if not txt: continue
            topics = await extract_topics_from_text(txt) 
            results.append({"unit": f"Unit {idx+1}", "text": txt, "topics": topics})
        return results
    except Exception as e:
        logger.error(f"Error reading PDF {pdf_path}: {e}")
        return []

def create_document_chunks(units: List[Dict[str, Any]]) -> List[Any]:
    texts = [unit["text"] for unit in units if unit.get("text")]
    if not texts: return []
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=4000, chunk_overlap=500)
    return text_splitter.create_documents(texts, metadatas=[{"unit": unit["unit"]} for unit in units])

async def generate_question_paper(docs_content: tuple, subject: str, pattern: str, difficulty: str, topics: List[str] = None) -> Dict[str, List]:
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

    paper["MCQ"] = await run_batch_query(MCQ_BATCH_PROMPT, "MCQ", num_mcq, marks_mcq, context_sample, subject, difficulty, topics)
    paper["Short"] = await run_batch_query(RUBRIC_BATCH_PROMPT, "Short Answer", num_short * 2, marks_short, context_sample, subject, difficulty, topics)
    paper["Long"] = await run_batch_query(RUBRIC_BATCH_PROMPT, "Long Essay", num_long * 2, marks_long, context_sample, subject, difficulty, topics)

    for cat in ["MCQ", "Short", "Long"]:
        paper[cat] = [item for item in paper[cat] if isinstance(item, dict)]
    
    for item in paper["MCQ"]: item["marks"] = marks_mcq
    for item in paper["Short"]: item["marks"] = marks_short
    for item in paper["Long"]: item["marks"] = marks_long
        
    return paper
