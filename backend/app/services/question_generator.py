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
from services.graph_service import graph_engine

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
    
    # Updated to raw SDK in run_batch_query
    embedding = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")
except Exception as e:
    logger.error(f"Failed to initialize embeddings: {e}")

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

async def run_batch_query(prompt_template: PromptTemplate, q_type: str, num: int, marks: int, context: str, subject: str, difficulty: str, topics: List[str] = None) -> List[Dict[str, str]]:
    if num <= 0: return []
    try:
        logger.info(f"Generating {num} {q_type} questions using raw SDK...")
        
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
        
        # Format prompt using the LangChain template but we'll send it raw
        full_prompt = prompt_template.format(**input_vars)

        models_to_try = [
            ("gemini-2.5-flash", "PRIMARY"),
            ("gemini-1.5-pro", "FALLBACK 1"),
            ("gemini-1.5-flash", "FALLBACK 2")
        ]

        for model_name, label in models_to_try:
            try:
                logger.info(f"Attempting {label} with {model_name}...")
                model = genai.GenerativeModel(model_name)
                response = await model.generate_content_async(full_prompt)
                
                if response and response.text:
                    questions = parse_json_output(response.text)
                    if questions:
                        return questions
                
                logger.warning(f"{label} returned empty or invalid response. Trying next...")
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "503" in err_str:
                    logger.warning(f"{label} exhausted or service unavailable. Trying next...")
                    continue
                else:
                    logger.error(f"{label} failed with unexpected error: {e}")
                    continue
        
        return []

    except Exception as e:
        logger.error(f"Error in batch query: {e}")
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

async def extract_topics_from_text(text: str, subject: str = "General") -> List[str]:
    try:
        if not text: return []
        if len(text) < 30:
            logger.warning(f"Text too short for topic extraction ({len(text)} chars). Text: {text}")
            return []
            
        prompt = f"""
        Identify the key topics/concepts in the following syllabus unit text for the subject {subject}.
        Return strictly a JSON list of strings, e.g. ["Topic 1", "Topic 2"].
        Text: {text[:2000]}...
        """
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = await model.generate_content_async(prompt)
        cleaned = clean_json_string(response.text) 
        topics = json.loads(cleaned)
        
        # Background sync to Neo4j so it doesn't fail the main request
        if topics:
            import asyncio
            for t in topics:
                asyncio.create_task(graph_engine.create_topic(subject, t))
            
        return topics
    except Exception as e:
        logger.error(f"Topic extraction failed: {e}")
        # Return empty list only if Gemini/JSON fails, but keep units
        return []

async def sync_knowledge_graph(subject: str, topics: List[str]):
    """
    Highly automated: Uses LLM to determine prerequisites for topics and populates Neo4j.
    """
    if not topics or not graph_engine.driver: return
    
    try:
        topic_str = ", ".join(topics)
        prompt = f"""
        For the subject '{subject}', analyze these topics: {topic_str}.
        For each topic, identify its direct PREREQUISITES from within the same subject.
        Return strictly a JSON list of objects:
        [
          {{"topic": "Name", "prerequisites": ["Pre1", "Pre2"]}},
          ...
        ]
        If no prerequisites, return empty list for that topic.
        """
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = await model.generate_content_async(prompt)
        cleaned = clean_json_string(response.text)
        mapping = json.loads(cleaned)
        
        for item in mapping:
            t_name = item.get("topic")
            prereqs = item.get("prerequisites", [])
            if t_name:
                await graph_engine.create_topic(subject, t_name)
                for p in prereqs:
                    await graph_engine.create_topic(subject, p)
                    await graph_engine.add_prerequisite(t_name, p)
                    
        logger.info(f"Knowledge Graph synced for {len(topics)} topics in {subject}.")
    except Exception as e:
        logger.error(f"KG Sync failed: {e}")

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

async def extract_units_and_topics_unified(pdf_path: str, subject: str = "Syllabus") -> List[Dict[str, Any]]:
    """
    Consolidates Unit and Topic extraction into a SINGLE Gemini call.
    """
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

        logger.info("Extracting Units and Topics in a single Gemini (3-Flash) call...")
        
        prompt = f"""
        Act as a syllabus parser. Analyze the following syllabus text.
        1. Identify the Units/Modules/Chapters (e.g., Unit 1, Unit 2).
        2. For each Unit, provide its full descriptive text as found in the syllabus.
        3. For each Unit, extract a list of 5-8 specific key topics or concepts.
        
        Return strictly a valid JSON list of objects:
        [
          {{
            "unit": "Unit 1: Name",
            "text": "Full text of unit 1 content...",
            "topics": ["Topic A", "Topic B", ...]
          }},
          ...
        ]
        
        Syllabus Text:
        {full_text[:8000]}
        """
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = await model.generate_content_async(prompt)
        cleaned = clean_json_string(response.text)
        units_data = json.loads(cleaned)
        
        # Background sync to Knowledge Graph
        if units_data:
            import asyncio
            all_topics = []
            for u in units_data:
                all_topics.extend(u.get("topics", []))
            
            # Use passed subject name for Knowledge Graph isolation
            asyncio.create_task(sync_knowledge_graph(subject, all_topics))
            
        return units_data
    except Exception as e:
        logger.error(f"Unified extraction failed: {e}")
        return []

# Maintain compatibility with upload-syllabus route
async def extract_units_from_pdf(pdf_path: str, subject: str = "Syllabus") -> List[Dict[str, Any]]:
    return await extract_units_and_topics_unified(pdf_path, subject)

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
    q_id_counter = 1

    # Generate sections
    raw_mcqs = await run_batch_query(MCQ_BATCH_PROMPT, "MCQ", num_mcq, marks_mcq, context_sample, subject, difficulty, topics)
    for q in raw_mcqs:
        if isinstance(q, dict):
            q.update({"id": q_id_counter, "type": "MCQ", "marks": marks_mcq})
            paper["MCQ"].append(q)
            q_id_counter += 1

    raw_shorts = await run_batch_query(RUBRIC_BATCH_PROMPT, "Short Answer", num_short * 2, marks_short, context_sample, subject, difficulty, topics)
    for q in raw_shorts:
        if isinstance(q, dict):
            q.update({"id": q_id_counter, "type": "Short Answer", "marks": marks_short})
            paper["Short"].append(q)
            q_id_counter += 1

    raw_longs = await run_batch_query(RUBRIC_BATCH_PROMPT, "Long Essay", num_long * 2, marks_long, context_sample, subject, difficulty, topics)
    for q in raw_longs:
        if isinstance(q, dict):
            q.update({"id": q_id_counter, "type": "Long Essay", "marks": marks_long})
            paper["Long"].append(q)
            q_id_counter += 1
    
    # --- PHASE 3: Automated Graph Ingestion ---
    # Trigger background sync of topics and prerequisites
    if topics:
        try:
            import asyncio
            asyncio.create_task(sync_knowledge_graph(subject, topics))
        except Exception as ge:
            logger.error(f"Failed to trigger KG Sync: {ge}")
        
    return paper
