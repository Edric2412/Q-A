
import logging
import asyncio
import json
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

logger = logging.getLogger(__name__)

def upload_to_gemini(path: str, mime_type: str = "application/pdf"):
    """Uploads a file to Gemini File API."""
    try:
        file = genai.upload_file(path, mime_type=mime_type)
        logger.info(f"Uploaded file '{file.display_name}' as: {file.uri}")
        return file
    except Exception as e:
        logger.error(f"Failed to upload file {path}: {e}")
        raise

async def wait_for_file_active(file):
    """Waits for the file to be processed and active."""
    logger.info(f"Waiting for file {file.name} to process...")
    while file.state.name == "PROCESSING":
        await asyncio.sleep(2)
        file = genai.get_file(file.name)
    
    if file.state.name != "ACTIVE":
        raise ValueError(f"File {file.name} failed to process. State: {file.state.name}")
    
    logger.info(f"File {file.name} is ACTIVE.")
    return file

async def grade_pdf_with_vision(pdf_path: str, rubric_text: str, model_name: str = "gemini-3-flash-preview") -> dict:
    """
    Uploads PDF, waits for processing, and grades it using Gemini Vision in one go.
    Returns a dictionary of results { "1": {"score": X, "feedback": Y}, ... }
    """
    gemini_file = None
    try:
        # 1. Upload (Upload is sync, but fast)
        gemini_file = upload_to_gemini(pdf_path)
        
        # 2. Wait
        gemini_file = await wait_for_file_active(gemini_file)
        
        # 3. Construct Prompt
        # We prompt the model to look at the PDF and the Rubric string.
        # The Rubric string should contain all questions and their criteria.
        
        prompt = f"""
        You are an strict academic evaluator. 
        I have provided a student's answer script (PDF) and a master rubric.
        
        **TASK**:
        1. Read the student's handwritten answers in the PDF.
        2. Match each answer to the corresponding Question ID in the Rubric.
        3. Grade ONLY the questions present in the Rubric.
        4. If a student attempted an "Either/Or" choice, grade the one they answered.
        5. If a question is missing or unreadable, mark it as 0.0 with feedback "Not attempting/Unreadable".
        
        **RUBRIC**:
        {rubric_text}
        
        **OUTPUT FORMAT**:
        Return a valid JSON object where keys are the Question IDs (e.g., "11", "12", "16") and values are objects with "score" and "feedback".
        
        Example JSON:
        {{
            "11": {{"score": 3.5, "feedback": "Good definition, but missed the second point about..."}},
            "12": {{"score": 5.0, "feedback": "Perfect answer."}}
        }}
        
        **IMPORTANT**: 
        - Return ONLY the JSON. No markdown formatting.
        - Ensure numeric scores are floats (e.g. 4.0, 2.5).
        """
        
        # 4. Generate Content
        
        model = genai.GenerativeModel(model_name)
        
        # specific safety settings to avoid blocking academic content
        safety_settings = {
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
        }

        # Async generation
        response = await model.generate_content_async(
            [prompt, gemini_file],
            safety_settings=safety_settings
        )
        
        # 5. Parse Response
        try:
            text = response.text
            # Clean markdown code blocks if present
            if "```json" in text:
                text = text.replace("```json", "").replace("```", "")
            elif "```" in text:
                 text = text.replace("```", "")
                 
            return json.loads(text.strip())
            
        except Exception as e:
            logger.error(f"Failed to parse Gemini Vision response: {e}")
            logger.error(f"Raw Response: {response.text}")
            return {}

    except Exception as e:
        logger.error(f"Vision Grading Failed: {e}")
        return {}
        
    finally:
        # 6. Cleanup
        if gemini_file:
            try:
                genai.delete_file(gemini_file.name)
                logger.info(f"Deleted file {gemini_file.name}")
            except Exception as e:
                logger.warning(f"Failed to delete file {gemini_file.name}: {e}")
