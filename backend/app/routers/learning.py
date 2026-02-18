import json
import uuid
import datetime
import random
import logging
from typing import List, Dict, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core import database as db_module
from services import rl_agent
from services import question_generator as qg

router = APIRouter()
logger = logging.getLogger(__name__)

# --- BKT PARAMS ---
P_INIT = 0.5
P_TRANSIT = 0.1
P_SLIP = 0.05
P_GUESS = 0.15

def update_bkt(mastery: float, correct: bool) -> float:
    """
    Update mastery probability using Bayesian Knowledge Tracing.
    """
    if correct:
        p_learning = (mastery * (1 - P_SLIP)) / (mastery * (1 - P_SLIP) + (1 - mastery) * P_GUESS)
    else:
        p_learning = (mastery * P_SLIP) / (mastery * P_SLIP + (1 - mastery) * (1 - P_GUESS))
    
    p_next = p_learning + (1 - p_learning) * P_TRANSIT
    return min(max(p_next, 0.0), 1.0)

# --- MODELS ---
class StartSessionRequest(BaseModel):
    student_id: int
    subject: str
    exam_id: str

class SubmitAnswerRequest(BaseModel):
    session_id: str
    student_id: int
    question: str # The question text
    answer: str
    topic_index: int # Passed back from frontend state
    topic_name: Optional[str] = None
    difficulty: str

# --- ROUTES ---

@router.post("/start-session")
async def start_session(req: StartSessionRequest):
    try:
        session_id = str(uuid.uuid4())
        await db_module.create_learning_session(session_id, req.student_id, req.subject, req.exam_id)
        
        # Get current state
        mastery_map = await db_module.get_student_progress(req.student_id, req.subject)
        
        # Determine topics
        topics_list = await db_module.get_evaluation_topics(req.exam_id)
        if not topics_list:
             # Fallback to generic 9 topics if no specific topics found
             topics_list = [f"Topic {i+1}" for i in range(9)]
             
        # State Vector Construction for RL
        # 1. Sort topics by mastery to identify buckets
        # We need to pass [Avg_Low, Avg_Med, Avg_High] to RL
        topic_masteries = []
        for t in topics_list:
            m = mastery_map.get(t, P_INIT)
            topic_masteries.append({"topic": t, "mastery": m})
            
        # Sort by mastery ascending
        topic_masteries.sort(key=lambda x: x["mastery"])
        
        # Split into 3 buckets (Low, Med, High)
        n = len(topic_masteries)
        k = max(1, n // 3) # approximately n/3 items per bucket
        
        # Use simple slicing. 
        # Bucket 0: 0 to k
        # Bucket 1: k to 2k
        # Bucket 2: 2k to end
        b0 = topic_masteries[:k]
        b1 = topic_masteries[k:2*k]
        b2 = topic_masteries[2*k:]
        
        def get_avg(lst):
            if not lst: return 0.5
            return sum(x["mastery"] for x in lst) / len(lst)
            
        avg_0 = get_avg(b0)
        avg_1 = get_avg(b1)
        avg_2 = get_avg(b2)
        
        state_vector = [avg_0, avg_1, avg_2]
            
        # Get Action
        action = rl_agent.get_next_action(state_vector)
        bucket_idx = action["bucket_index"]
        difficulty = action["difficulty"]
        
        # Select specific topic from the chosen bucket
        selected_bucket = [b0, b1, b2][bucket_idx]
        if not selected_bucket:
             selected_bucket = topic_masteries
             
        # Pick random from bucket
        chosen_item = random.choice(selected_bucket)
        topic_name = chosen_item["topic"]
        # Find index in original list for frontend usage
        try:
            topic_idx_raw = topics_list.index(topic_name)
        except:
             topic_idx_raw = 0
        
        # Generate Question
        # Use Dummy Context related to Subject
        dummy_context = f"Subject: {req.subject}. Topic: {topic_name}. Key concepts include definitions, applications, and problem solving."
        
        q_type = "Short Answer"
        questions = await qg.run_batch_query(
            qg.RUBRIC_BATCH_PROMPT, q_type, 1, 5, dummy_context, req.subject, difficulty, [topic_name]
        )
        
        if not questions:
            question = {"text": f"Explain key concepts of {topic_name}.", "answer": "..."}
        else:
            question = questions[0]
        
        question["topic"] = topic_name # Force consistent topic naming
            
        return {
            "session_id": session_id,
            "question": question,
            "topic_index": topic_idx_raw,
            "topic_name": topic_name,
            "difficulty": difficulty,
            "mastery": state_vector,
            "available_topics": topics_list
        }
    except Exception as e:
        logger.error(f"Start Session Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/submit-answer")
async def submit_answer(req: SubmitAnswerRequest):
    try:
        # Fetch Session Subject
        session = await db_module.get_session_by_id(req.session_id)
        subject = session['subject'] if session else "General"

        # 1. Grade Answer
        prompt = f"""
        You are an evaluator for {subject}.
        Question: {req.question}
        Student Answer: {req.answer}
        
        Grade the answer on a scale of 0.0 to 1.0 based on correctness and relevance.
        Provide constructive feedback in 1-2 sentences.
        
        Return STRICT JSON: {{"score": float, "feedback": "string"}}
        """
        
        # Use simple generation
        grading_response = await qg.llm_primary.ainvoke(prompt)
        
        def extract_text(obj):
            if isinstance(obj, str): return obj
            if isinstance(obj, list): return "".join([extract_text(i) for i in obj])
            if isinstance(obj, dict):
                if 'text' in obj: return extract_text(obj['text'])
                if 'parts' in obj: return extract_text(obj['parts'])
                # Handle the case in the screenshot: {'type': 'text', 'text': '...'}
                if 'content' in obj: return extract_text(obj['content'])
                # If it's a dict but no specific key, try joining all values if they are strings
                return " ".join([extract_text(v) for k, v in obj.items() if k not in ['extras', 'metadata']])
            if hasattr(obj, 'text'): return obj.text
            if hasattr(obj, 'parts'): return extract_text(obj.parts)
            if hasattr(obj, 'content'): return extract_text(obj.content)
            return str(obj)

        content = extract_text(grading_response)
        
        # Clean up any "dictionary-like" string that might have been produced by str(obj) fallback
        if content.startswith("{") and "text':" in content:
            # This looks like we stringified a dict that had a text field
            # Try to grab the content between 'text': ' and '
            import re
            match = re.search(r"'text':\s*'({.*?})'", content)
            if match:
                content = match.group(1)
            else:
                match = re.search(r"'text':\s*\"({.*?})\"", content)
                if match:
                    content = match.group(1)
        
        score = 0.5
        feedback = "Good attempt."
        correct = False
        
        try:
             # Clean markdown json blocks if any
             cleaned = qg.clean_json_string(content)
             parsed = json.loads(cleaned)
             
             # If parsed is a list (e.g. from a list prompt), pick first item if it's a dict
             if isinstance(parsed, list) and len(parsed) > 0 and isinstance(parsed[0], dict): 
                 parsed = parsed[0]
             
             if isinstance(parsed, dict):
                raw_score = float(parsed.get("score", 0.0))
                # Normalize if needed
                score = raw_score / 10.0 if raw_score > 1.0 else raw_score
                feedback = parsed.get("feedback", "")
                correct = score >= 0.6
             else:
                 # Fallback if parsed json is not a dict/list of dicts
                 raise ValueError("Parsed JSON is not a dictionary")

        except Exception as ex:
             logger.error(f"Grading parse error: {ex}. Raw content: {content}")
             # Fallback logic if JSON fails but we have text
             if "correct" in content.lower(): 
                 score = 0.8
                 feedback = content
                 correct = True
             else:
                 score = 0.4
                 feedback = content
             
        # 2. Update Mastery
        # We need the topic name, not just index. 
        # But wait, frontend passes topic_index. We need the name.
        # Ideally frontend passes topic_name back.
        # Let's rely on finding session details? Or ask frontend to send name.
        # Hack: We will assume we can get it from DB or passed in request.
        # Let's update Request Model to include topic_name
        
        topic_key = req.topic_name if hasattr(req, "topic_name") and req.topic_name else f"Topic {req.topic_index+1}"
        
        mastery_map = await db_module.get_student_progress(req.student_id, subject)
        prev_m = mastery_map.get(topic_key, P_INIT)
        
        new_m = update_bkt(prev_m, correct)
        
        await db_module.update_student_progress(req.student_id, subject, topic_key, new_m)
        
        # 3. Log
        await db_module.log_learning_step({
            "session_id": req.session_id,
            "student_id": req.student_id,
            "topic": topic_key,
            "difficulty": req.difficulty,
            "score": score,
            "feedback": feedback, # Pass feedback
            "mastery_before": prev_m,
            "mastery_after": new_m,
            "action_taken": req.topic_index * 3 + (0 if req.difficulty=="Easy" else (1 if req.difficulty=="Medium" else 2)),
            "reward": score
        })
        
        # 4. Next Action
        # Re-fetch mastery vector because it changed
        mastery_map_updated = await db_module.get_student_progress(req.student_id, subject)
        
        # Need available topics again. 
        # We can pass them from frontend or fetch again.
        # Fetching again is safer.
        session_info = await db_module.get_session_by_id(req.session_id)
        exam_id = session_info.get("exam_id")
        topics_list = await db_module.get_evaluation_topics(exam_id) if exam_id else []
        if not topics_list: topics_list = [f"Topic {i+1}" for i in range(9)]
            
        # State Vector Construction for RL
        # 1. Sort topics by mastery to identify buckets
        # We need to pass [Avg_Low, Avg_Med, Avg_High] to RL
        topic_masteries = []
        for t in topics_list:
            m = mastery_map_updated.get(t, P_INIT)
            topic_masteries.append({"topic": t, "mastery": m})
            
        # Sort by mastery ascending
        topic_masteries.sort(key=lambda x: x["mastery"])
        
        # Split into 3 buckets (Low, Med, High)
        n = len(topic_masteries)
        k = max(1, n // 3) # approximately n/3 items per bucket
        
        # Use simple slicing. 
        # Bucket 0: 0 to k
        # Bucket 1: k to 2k
        # Bucket 2: 2k to end
        b0 = topic_masteries[:k]
        b1 = topic_masteries[k:2*k]
        b2 = topic_masteries[2*k:]
        
        def get_avg(lst):
            if not lst: return 0.5
            return sum(x["mastery"] for x in lst) / len(lst)
            
        avg_0 = get_avg(b0)
        avg_1 = get_avg(b1)
        avg_2 = get_avg(b2)
        
        state_vector = [avg_0, avg_1, avg_2]
            
        action = rl_agent.get_next_action(state_vector)
        bucket_idx = action["bucket_index"]
        next_diff = action["difficulty"]
        
        # Select specific topic from the chosen bucket
        selected_bucket = [b0, b1, b2][bucket_idx]
        if not selected_bucket:
             # Fallback if bucket empty (e.g. n < 3)
             selected_bucket = topic_masteries
             
        # Strategy: Pick the one with lowest mastery in that bucket to improve it?
        # Or random for variety? Let's pick random from the bucket to avoid repetition.
        chosen_item = random.choice(selected_bucket)
        next_topic_name = chosen_item["topic"]
        next_topic_idx_raw = topics_list.index(next_topic_name)
        
        # Generate Next Question
        dummy_context = f"Subject: {subject}. Topic: {next_topic_name}."
        q_type = "Short Answer"
        questions = await qg.run_batch_query(
            qg.RUBRIC_BATCH_PROMPT, q_type, 1, 5, dummy_context, subject, next_diff, [next_topic_name]
        )
        
        next_q = questions[0] if questions else {"text": f"Discuss {next_topic_name}", "answer": "..."}
        next_q["topic"] = next_topic_name # Force exact match for tracking
        
        return {
            "score": score,
            "feedback": feedback,
            "mastery_update": new_m,
            "current_mastery_vector": state_vector,
            "next_question": next_q,
            "next_topic_index": next_topic_idx_raw,
            "next_topic_name": next_topic_name,
            "next_difficulty": next_diff,
            "available_topics": topics_list
        }

    except Exception as e:
        logger.error(f"Submit Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/my-evaluations/{student_id}")
async def get_my_evaluations(student_id: int, email: str):
    # Security: In real app, verify email matches student_id via token.
    # For now, trusting the frontend/email passed for demo.
    try:
        results = await db_module.get_student_evaluations(email)
        return results
    except Exception as e:
        logger.error(f"Error fetching evaluations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/evaluation-details/{exam_id}")
async def get_student_evaluation_details(exam_id: str, email: str):
    try:
        # 1. Get Roll No
        pool = await db_module.get_pool()
        student = await pool.fetchrow("SELECT roll_no FROM students WHERE email = $1", email)
        if not student: raise HTTPException(404, "Student not found")
        
        roll_no = student['roll_no']
        
        # 2. Get Evaluation
        evaluation = await db_module.find_evaluation(exam_id, roll_no)
        if not evaluation: raise HTTPException(404, "Evaluation not found")
        
        return evaluation
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Error fetching evaluation details: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/learning-logs/{student_id}")
async def get_learning_logs(student_id: int):
    try:
        logs = await db_module.get_student_learning_logs(student_id, limit=20)
        return logs
    except Exception as e:
        logger.error(f"Error fetching learning logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))
