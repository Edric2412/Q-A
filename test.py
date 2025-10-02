# ✅ Final Polished Version: With Universal Rubrics and Superior Formatting for All Subjects

# Required installations:
# !pip install google-generativeai pdfplumber streamlit langchain_core langchain-google-genai

import os
import re
import json
import random
import time
import asyncio
import pdfplumber
import streamlit as st

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI

# --- Configuration & Setup ---
st.set_page_config(layout="wide")
GOOGLE_API_KEY = "AIzaSyBG-3UZywIePST2_Dgiy5EROQ4azEdhC-k"
os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY

if not GOOGLE_API_KEY or GOOGLE_API_KEY == "YOUR_GOOGLE_API_KEY_HERE":
    st.error("Please paste your Google API Key into the script.")
    st.stop()

try:
    asyncio.get_running_loop()
except RuntimeError:
    asyncio.set_event_loop(asyncio.new_event_loop())

try:
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-pro", temperature=0.6)
    embedding = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
except Exception as e:
    st.error(f"Failed to initialize Google AI Models. Error: {e}")
    st.stop()

# --- ADVANCED PROMPT ENGINEERING ---

STATS_MCQ_BATCH_PROMPT = PromptTemplate.from_template("""You are an expert question paper setter for **Statistics**. Generate **{num_questions}** distinct, calculation-based Multiple Choice Questions of {difficulty} difficulty, based on the context below. The "question" field MUST contain the question followed by four options, each starting with `\\n` and then A), B), C), and D). The "answer" field MUST contain the correct option's letter AND its full text. Return a single, valid JSON object with one key, "questions". CONTEXT: {context}""")
STATS_BATCH_PROMPT = PromptTemplate.from_template("""You are an expert question paper setter for **Statistics**. Generate **{num_questions}** distinct, calculation-based {question_type} questions of {difficulty} difficulty, based on the context below. For the answer, provide a detailed step-by-step solution with a suggested mark allocation in parentheses for each step, like (1 mark). **Inside the JSON 'answer' string, you MUST use `\\n` for all newlines.** Return a single, valid JSON object with one key, "questions". CONTEXT: {context}""")
MCQ_BATCH_PROMPT = PromptTemplate.from_template("""You are an expert question paper setter for {subject}. Generate **{num_questions}** distinct Multiple Choice Questions (MCQs) of {difficulty} difficulty, based on the context below. The "question" field must contain the question followed by four options, each starting with `\\n` and then A), B), C), and D). The "answer" field MUST contain the correct option's letter and its full text. Return a single, valid JSON object with one key, "questions". CONTEXT: {context}""")

# --- THIS PROMPT IS NEW: It enforces rubrics for ALL subjects ---
RUBRIC_BATCH_PROMPT = PromptTemplate.from_template("""
You are an expert question paper setter for **{subject}**.
Generate **{num_questions}** distinct {question_type} questions of {difficulty} difficulty, based on the context below.

**Instructions:**
1.  Create insightful questions that test the core concepts from the context.
2.  For the answer, provide a detailed, well-structured explanation.
3.  **For each logical point or step in the explanation, provide a suggested mark allocation in parentheses, like (1 mark) or (2 marks).**
4.  **Inside the JSON 'answer' string, you MUST use `\\n` for all newlines.**
5.  Return a single, valid JSON object with one key, "questions".

**CONTEXT:**
---
{context}
---
""")


# --- UTILITY & CORE FUNCTIONS ---
def clean_text(text):
    """A powerful cleaning function to fix common AI formatting artifacts."""
    if not isinstance(text, str): return text
    # Add a space before a capital letter if it's preceded by a lowercase letter (fixes "WhatisThis" -> "What is This")
    text = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', text)
    # Standardize all whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def format_answer_display(answer):
    if not isinstance(answer, str): answer = str(answer)
    # Check for encoded newlines (`\\n`) and format as a list
    if r'\n' in answer:
        return "\n".join(f"- {clean_text(step)}" for step in answer.split(r'\n'))
    return clean_text(answer)

# ... (Other core functions are unchanged) ...
def extract_units_from_pdf(pdf_path):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            full_text = "\n".join([page.extract_text() for page in pdf.pages if page.extract_text() and page.extract_text().strip()])
        unit_pattern = re.compile(r"((?:Unit|Module)[:\s]*\d+.*?(?=(?:Unit|Module)[:\s]*\d+|$))", re.DOTALL | re.IGNORECASE)
        matches = unit_pattern.findall(full_text)
        if not matches: return [{"unit": "Full Syllabus", "text": full_text}] if full_text else []
        return [{"unit": f"Unit {idx+1}", "text": match.strip()} for idx, match in enumerate(matches)]
    except Exception as e:
        st.error(f"Error reading PDF: {e}"); return []
def create_document_chunks(units):
    texts = [unit["text"] for unit in units]
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=4000, chunk_overlap=500)
    return text_splitter.create_documents(texts, metadatas=[{"unit": u["unit"]} for u in units])
def parse_json_output(response_text, is_batch=True):
    try:
        match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if match:
            json_str = match.group(0)
            data = json.loads(json_str)
            return data.get("questions", []) if is_batch else data
        return [] if is_batch else {}
    except (json.JSONDecodeError, TypeError):
        return [] if is_batch else {}

@st.cache_data(show_spinner=False)
def generate_question_paper(_docs_content, subject, pattern, difficulty):
    config = {"CIA": {"mcq": 10, "short": 5, "long": 2}, "Model": {"mcq": 10, "short": 5, "long": 5}}[pattern]
    paper, answers = {"MCQ": [], "Short": [], "Long": []}, {"MCQ": [], "Short": [], "Long": []}

    with st.spinner("Step 1 of 3: Generating MCQs..."):
        context_sample = "\n---\n".join(random.sample(_docs_content, min(len(_docs_content), 3)))
        def run_batch_query(prompt, q_type, num):
            if num == 0: return [], []
            chain = prompt | llm | StrOutputParser()
            response = chain.invoke({"subject": subject, "num_questions": num, "question_type": q_type, "difficulty": difficulty, "context": context_sample})
            results = parse_json_output(response, is_batch=True)
            if not results: st.warning(f"The AI failed to generate {q_type}s. This can be a temporary API issue. Trying again may help.")
            return [item.get("question", "[Failed]") for item in results], [item.get("answer", "[Failed]") for item in results]

        # --- UPDATED PROMPT SELECTION LOGIC ---
        mcq_prompt = STATS_MCQ_BATCH_PROMPT if subject == "Statistics" else MCQ_BATCH_PROMPT
        other_prompt = STATS_BATCH_PROMPT if subject == "Statistics" else RUBRIC_BATCH_PROMPT # Use the new rubric prompt
        
        paper["MCQ"], answers["MCQ"] = run_batch_query(mcq_prompt, "MCQ", config["mcq"])
    
    time.sleep(10)

    with st.spinner("Step 2 of 3: Generating Short Answers..."):
        short_q, short_a = run_batch_query(other_prompt, "Short Answer", config["short"] * 2)
        paper["Short"] = [{"a": q1, "b": q2} for q1, q2 in zip(short_q[::2], short_q[1::2])]
        answers["Short"] = [{"a": a1, "b": a2} for a1, a2 in zip(short_a[::2], short_a[1::2])]

    time.sleep(10)

    with st.spinner("Step 3 of 3: Generating Long Answers..."):
        long_q, long_a = run_batch_query(other_prompt, "Long Essay", config["long"] * 2)
        paper["Long"] = [{"a": q1, "b": q2} for q1, q2 in zip(long_q[::2], long_q[1::2])]
        answers["Long"] = [{"a": a1, "b": a2} for a1, a2 in zip(long_a[::2], long_a[1::2])]

    return paper, answers

# --- Streamlit UI ---
st.title("📄 AI Question Paper Generator")
with st.sidebar:
    st.header("⚙️ Configuration")
    department = st.selectbox("Select Department", ["B.Sc. Data Science", "BCA", "B.Com IT"])
    subject = st.selectbox("Select Subject", ["Data Security and Compliance", "Python Programming", "Statistics"], key="subject")
    batch = st.selectbox("Select Batch", ["2021-2024", "2022-2025", "2023-2026"])
    exam_type = st.selectbox("Exam Type", ["CIA", "Model"])
    difficulty = st.selectbox("Difficulty Level", ["Easy", "Medium", "Hard"])
    uploaded_file = st.file_uploader("Upload Syllabus PDF", type="pdf")

if uploaded_file:
    temp_file_path = os.path.join(".", "temp_syllabus.pdf")
    with open(temp_file_path, "wb") as f: f.write(uploaded_file.getvalue())
    with st.spinner("Reading and analyzing syllabus..."): units = extract_units_from_pdf(temp_file_path)
    if not units:
        st.error("Could not extract units from the syllabus.")
    else:
        st.success(f"Successfully extracted {len(units)} unit(s).")
        all_unit_names = [unit["unit"] for unit in units]
        selected_unit_names = st.multiselect("Select Units to Include", all_unit_names, default=all_unit_names)
        if st.button(f"Generate {exam_type} Question Paper"):
            if not selected_unit_names:
                st.warning("Please select at least one unit.")
            else:
                filtered_units = [u for u in units if u["unit"] in selected_unit_names]
                doc_chunks = create_document_chunks(filtered_units)
                if not doc_chunks:
                    st.error("Failed to process content.")
                else:
                    doc_contents = tuple([doc.page_content for doc in doc_chunks])
                    paper, answers = generate_question_paper(doc_contents, subject, exam_type, difficulty)

                    st.subheader(f"📘 {exam_type} Question Paper - {subject} ({difficulty})")
                    st.markdown(f"**Batch:** {batch} | **Department:** {department}")
                    st.markdown("---")

                    rubrics = { "mcq": "1 mark", "cia_short": "4 marks", "cia_long": "10 marks", "model_short": "5 marks", "model_long": "8 marks" }
                    short_marks = rubrics['cia_short'] if exam_type == 'CIA' else rubrics['model_short']
                    long_marks = rubrics['cia_long'] if exam_type == 'CIA' else rubrics['model_long']

                    col1, col2 = st.columns(2)
                    with col1:
                        st.header("❓ Question Paper")
                        q_num = 1
                        if paper.get("MCQ"):
                            st.write(f"**Part A: Multiple Choice Questions ({rubrics['mcq']} each)**")
                            for q in paper["MCQ"]: st.markdown(f"**{q_num}.** {clean_text(q).replace(r'\\n', '  \n')}"); q_num += 1
                        if paper.get("Short"):
                            st.markdown("---"); st.write(f"**Part B: Short Answer Questions ({short_marks} each)**")
                            for pair in paper["Short"]: st.markdown(f"**{q_num}. (a)** {clean_text(pair.get('a'))}\n\n**OR**\n\n**(b)** {clean_text(pair.get('b'))}"); q_num += 1
                        if paper.get("Long"):
                            st.markdown("---"); st.write(f"**Part C: Essay Questions ({long_marks} each)**")
                            for pair in paper["Long"]: st.markdown(f"**{q_num}. (a)** {clean_text(pair.get('a'))}\n\n**OR**\n\n**(b)** {clean_text(pair.get('b'))}"); q_num += 1
                    with col2:
                        st.header("🔑 Answer Key")
                        ans_num = 1
                        if answers.get("MCQ"):
                            st.write(f"**Part A Answers ({rubrics['mcq']} each)**")
                            for a in answers["MCQ"]: st.markdown(f"**{ans_num}.** {format_answer_display(a)}"); ans_num += 1
                        if answers.get("Short"):
                            st.markdown("---"); st.write(f"**Part B Answers ({short_marks} each)**")
                            for pair in answers["Short"]: st.markdown(f"**{ans_num}. (a)**\n{format_answer_display(pair.get('a'))}\n\n**(b)**\n{format_answer_display(pair.get('b'))}"); ans_num += 1
                        if answers.get("Long"):
                            st.markdown("---"); st.write(f"**Part C Answers ({long_marks} each)**")
                            for pair in answers["Long"]: st.markdown(f"**{ans_num}. (a)**\n{format_answer_display(pair.get('a'))}\n\n**(b)**\n{format_answer_display(pair.get('b'))}"); ans_num += 1
    
    if os.path.exists(temp_file_path):
        os.remove(temp_file_path)