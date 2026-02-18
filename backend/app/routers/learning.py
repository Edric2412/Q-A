import json
import uuid
import datetime
import random
import logging
from typing import List, Dict, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

import os
import google.generativeai as genai
from core import database as db_module
from services import rl_agent
from services import question_generator as qg

# Configure Gemini
api_key = os.getenv("GOOGLE_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

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
    rubric: Optional[str] = None
    correct_answer: Optional[str] = None

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

        # 1. Grade Answer (Strict Mode)
        rubric_section = f"\nExpected Answer/Rubric: {req.rubric or req.correct_answer}" if (req.rubric or req.correct_answer) else ""
        
        prompt = f"""
        You are a strict academic evaluator for {subject}.
        Question: {req.question}{rubric_section}
        Student Answer: {req.answer}
        
        ### EVALUATION CRITERIA:
        - match the analytical standards of a university faculty evaluator.
        - Be EXTREMELY STRICT. Do not give marks for vague, repetitive, or partially correct answers.
        - If a rubric is provided above, ensure the student answer addresses the key points/keywords mentioned.
        - Grade on a scale of 0.0 to 1.0 (where 0.7+ is mastery).
        - If the answer is purely theoretical when a numerical solution was expected (for Math/Stats), give a score below 0.3.
        
        Return STRICT JSON: {{"score": float, "feedback": "Detailed, critical feedback in 1-2 sentences"}}
        """
        
        # Use direct Gemini SDK (Consistent with platform upgrade)
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = await model.generate_content_async(prompt)
        
        # Clean and Parse
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        
        score = 0.5
        feedback = "Good attempt."
        correct = False

        try:
             data = json.loads(clean_text)
             
             if isinstance(data, dict):
                raw_score = float(data.get("score", 0.0))
                # Normalize if needed
                score = raw_score / 10.0 if raw_score > 1.0 else raw_score
                feedback = data.get("feedback", "")
                correct = score >= 0.6
             else:
                  raise ValueError("Parsed JSON is not a dictionary")

        except Exception as ex:
             logger.error(f"Grading parse error: {ex}. Raw text: {clean_text}")
             # Fallback logic
             if "correct" in clean_text.lower(): 
                 score = 0.8
                 feedback = clean_text
                 correct = True
             else:
                 score = 0.4
                 feedback = clean_text
             
        # 2. Update Mastery (With Case-Insensitive Alignment)
        topic_key = req.topic_name if hasattr(req, "topic_name") and req.topic_name else f"Topic {req.topic_index+1}"
        
        # Align with authorized topics to prevent casing drift
        session_info = await db_module.get_session_by_id(req.session_id)
        if session_info:
            exam_id = session_info.get("exam_id")
            authorized_list = await db_module.get_evaluation_topics(exam_id) if exam_id else []
            # Find case-insensitive match
            for auth_t in authorized_list:
                if auth_t.lower() == topic_key.lower():
                    topic_key = auth_t
                    break
        
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
        
        # 4. Next Action - GRAPH AWARE
        # If student failed, check for graph-based bottlenecks
        next_topic_name = None
        next_diff = None
        
        if not correct:
            try:
                from services.graph_service import graph_engine
                bottleneck = await graph_engine.get_mastery_bottleneck(req.student_id, topic_key, subject, db_module)
                if bottleneck:
                    next_topic_name = bottleneck
                    next_diff = "Easy" # Drop difficulty for remediation
                    logger.info(f"GRAPH REMEDIATION: Switching student to {next_topic_name} due to failure in {topic_key}")
            except Exception as ge:
                logger.error(f"Graph remediation lookup failed: {ge}")

        # If no bottleneck or student was correct, use RL as usual
        if not next_topic_name:
            # Re-fetch mastery vector because it changed
            mastery_map_updated = await db_module.get_student_progress(req.student_id, subject)
            
            # Need available topics again. 
            session_info = await db_module.get_session_by_id(req.session_id)
            exam_id = session_info.get("exam_id")
            topics_list = await db_module.get_evaluation_topics(exam_id) if exam_id else []
            if not topics_list: topics_list = [f"Topic {i+1}" for i in range(9)]
                
            # State Vector Construction for RL
            topic_masteries = []
            for t in topics_list:
                m = mastery_map_updated.get(t, P_INIT)
                topic_masteries.append({"topic": t, "mastery": m})
                
            topic_masteries.sort(key=lambda x: x["mastery"])
            n = len(topic_masteries)
            k = max(1, n // 3)
            
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
            
            selected_bucket = [b0, b1, b2][bucket_idx]
            if not selected_bucket:
                selected_bucket = topic_masteries
                 
            chosen_item = random.choice(selected_bucket)
            next_topic_name = chosen_item["topic"]
        else:
            # We already have next_topic_name and next_diff from remediation
            # Just need to calculate the state_vector for the response (UI)
            mastery_map_updated = await db_module.get_student_progress(req.student_id, subject)
            # ... (minimal state vector construction for UI)
            state_vector = [0.5, 0.5, 0.5] # Simplified for now to save tokens
        
        # Need current topics list for index lookup
        session_info = await db_module.get_session_by_id(req.session_id)
        exam_id = session_info.get("exam_id")
        topics_list_sync = await db_module.get_evaluation_topics(exam_id) if exam_id else []
        if not topics_list_sync: topics_list_sync = [f"Topic {i+1}" for i in range(9)]
        
        try:
            next_topic_idx_raw = topics_list_sync.index(next_topic_name)
        except:
            next_topic_idx_raw = 0
            
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
            "available_topics": topics_list_sync
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
