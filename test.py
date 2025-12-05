# ✅ Simplified Version: Plain Text Batch Generation for Testing

# Required installations:
# !pip install llama-cpp-python pdfplumber streamlit langchain_core langchain_community

import os
import re
import json
import random
import pdfplumber
import streamlit as st

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_community.llms import LlamaCpp

# --- Configuration & Setup ---
st.set_page_config(layout="wide")

# --- LOCAL MODEL CONFIGURATION ---
# ❗️ IMPORTANT: Replace this with the actual path to your downloaded GGUF model file.
MODEL_PATH = "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf"

if not os.path.exists(MODEL_PATH):
    st.error(f"Model file not found. Please download a model and update the MODEL_PATH variable in the script.")
    st.stop()

try:
    llm = LlamaCpp(
        model_path=MODEL_PATH,
        n_gpu_layers=0,
        n_ctx=8192,
        temperature=0.6,
        max_tokens=-1,
        verbose=True,
    )
except Exception as e:
    st.error(f"Failed to initialize the local Llama model. Error: {e}")
    st.stop()

# --- NEW, SIMPLIFIED TEXT PROMPTS ---

SIMPLE_TEXT_PROMPT = PromptTemplate.from_template("""
You are an expert question paper setter for {subject}.
Your task is to generate a question paper based on the provided context.

**Instructions:**
1.  Generate a total of {num_mcq} Multiple Choice Questions for Part A.
2.  Generate a total of {num_short} Short Answer Questions for Part B.
3.  Generate a total of {num_long} Long Essay Questions for Part C.
4.  For each question, provide a correct and detailed answer immediately below it, prefixed with "Answer:".
5.  Format the output clearly with headings for each part.

CONTEXT:
---
{context}
---
""")

# --- UTILITY FUNCTIONS (Unchanged) ---
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

# --- SIMPLIFIED BATCH GENERATION FUNCTION ---
@st.cache_data(show_spinner=False)
def generate_simple_question_paper(_docs_content, subject, pattern, difficulty):
    config = {"CIA": {"mcq": 10, "short": 5, "long": 2}, "Model": {"mcq": 10, "short": 5, "long": 5}}[pattern]
    
    # Combine a few random chunks of the syllabus to create a rich context
    context_sample = "\n---\n".join(random.sample(_docs_content, min(len(_docs_content), 5)))
    
    # Create the chain
    chain = SIMPLE_TEXT_PROMPT | llm | StrOutputParser()
    
    # Invoke the chain with all parameters to generate one single block of text
    response_text = chain.invoke({
        "subject": subject,
        "difficulty": difficulty,
        "num_mcq": config["mcq"],
        "num_short": config["short"],
        "num_long": config["long"],
        "context": context_sample
    })
    
    return response_text

# --- Streamlit UI ---
st.title("📄 AI Question Paper Generator (Simple Text Test)")
with st.sidebar:
    st.header("⚙️ Configuration")
    department = st.selectbox("Select Department", ["B.Sc. Data Science", "BCA", "B.Com IT"])
    subject = st.selectbox("Select Subject", ["Data Security and Compliance", "Python Programming", "Statistics"], key="subject")
    batch = st.selectbox("Select Batch", ["2021-2024", "2022-2025", "2023-2026"])
    exam_type = st.selectbox("Exam Type", ["CIA", "Model"])
    difficulty = st.selectbox("Difficulty Level", ["Easy", "Medium", "Hard"])
    uploaded_file = st.file_uploader("Upload Syllabus PDF", type="pdf")

if uploaded_file:
    temp_file_path = f"./temp_syllabus_{uploaded_file.file_id}.pdf"
    with open(temp_file_path, "wb") as f:
        f.write(uploaded_file.getvalue())

    with st.spinner("Reading and analyzing syllabus..."):
        units = extract_units_from_pdf(temp_file_path)

    if not units:
        st.error("Could not extract any text or units from the syllabus PDF.")
    else:
        st.success(f"Successfully extracted {len(units)} unit(s).")
        all_unit_names = [unit["unit"] for unit in units]
        selected_unit_names = st.multiselect("Select Units to Include", all_unit_names, default=all_unit_names)
        
        if st.button(f"Generate {exam_type} Question Paper"):
            if not selected_unit_names:
                st.warning("Please select at least one unit.")
            else:
                with st.spinner("Processing document..."):
                    filtered_units = [u for u in units if u["unit"] in selected_unit_names]
                    doc_chunks = create_document_chunks(filtered_units)
                
                if not doc_chunks:
                    st.error("Failed to process content from the selected units.")
                else:
                    doc_contents = tuple([doc.page_content for doc in doc_chunks])
                    
                    with st.spinner(f"Generating full question paper for {subject}... This may take a few minutes."):
                        # Call the new, simplified generation function
                        generated_paper = generate_simple_question_paper(doc_contents, subject, exam_type, difficulty)

                    st.subheader("✅ Generation Complete!")
                    st.markdown(f"**Subject:** {subject} | **Exam Type:** {exam_type} | **Difficulty:** {difficulty}")
                    st.markdown("---")
                    
                    # Display the raw text output in a text area for easy viewing and copying
                    st.text_area("Generated Question Paper & Answers", generated_paper, height=600)

    if os.path.exists(temp_file_path):
        os.remove(temp_file_path)