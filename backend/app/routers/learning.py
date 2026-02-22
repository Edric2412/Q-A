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

def update_bkt(mastery: float, score: float) -> float:
    """
    Update mastery probabilistically using an EMA-style bounded increment.
    This replaces explosive pure-BKT updates so the progress bar moves smoothly.
    new_mastery = current_mastery + learning_rate * (score - current_mastery)
    """
    alpha = 0.25  # Learning rate (controls how fast mastery changes per attempt)
    new_mastery = mastery + alpha * (score - mastery)
    
    # Ensure mastery stays solidly bounded within UI presentation limits
    return min(max(new_mastery, 0.05), 0.95)

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
        # Statically assign topics to structural buckets: Foundational, Intermediate, Advanced
        n = len(topics_list)
        k = max(1, n // 3)
        
        b0_topics = topics_list[:k]
        b1_topics = topics_list[k:2*k]
        b2_topics = topics_list[2*k:]
        
        # Helper to get mastery of a specific topic safely
        def get_topic_mastery(t):
            return mastery_map.get(t, P_INIT)
            
        def get_avg(bucket_topics):
            if not bucket_topics: return P_INIT
            return sum(get_topic_mastery(t) for t in bucket_topics) / len(bucket_topics)
            
        avg_0 = get_avg(b0_topics)
        avg_1 = get_avg(b1_topics)
        avg_2 = get_avg(b2_topics)
        
        ui_mastery_vector = [avg_0, avg_1, avg_2]
        
        # RL State Vector (Local Graph Projection: Anchor + Prereqs + Postreqs)
        # For a new session, anchor on the first available topic
        from services.graph_service import graph_engine
        anchor = topics_list[0] if topics_list else "Unknown"
        local_topics = await graph_engine.get_local_graph_state_topics(req.subject, anchor)
        
        # Rigorously enforce exactly 9 dimensions for PPO compatibility
        PAD_VALUE = 0.1
        PAD_NAME = "Padding_Topic"
        
        while len(local_topics) < 9:
            local_topics.append(PAD_NAME)
            
        state_vector = []
        for t in local_topics:
            if t == PAD_NAME:
                state_vector.append(PAD_VALUE)
            else:
                state_vector.append(get_topic_mastery(t))
            
        # Get Action (Outputs 0-8)
        action = rl_agent.get_next_action(state_vector)
        action_idx = action.get("topic_index", 0)
        difficulty = action.get("difficulty", "Medium")
        
        # Select specific topic from the local projection window
        if 0 <= action_idx < 9 and local_topics[action_idx] != PAD_NAME:
            topic_name = local_topics[action_idx]
        else:
            topic_name = anchor # Fallback to anchor if agent hits a pad
            action_idx = 0
            
        # Find index in *global* syllabus list for frontend usage
        try:
            topic_idx_raw = topics_list.index(topic_name)
        except ValueError:
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
        model = genai.GenerativeModel('gemini-3-flash-preview')
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
        
        new_m = update_bkt(prev_m, score)
        
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
            # Statically assign topics to structural buckets: Foundational, Intermediate, Advanced
            n = len(topics_list)
            k = max(1, n // 3)
            
            b0_topics = topics_list[:k]
            b1_topics = topics_list[k:2*k]
            b2_topics = topics_list[2*k:]
            
            # Helper to get mastery of a specific topic safely
            def get_topic_mastery(t):
                return mastery_map_updated.get(t, P_INIT)
                
            def get_avg(bucket_topics):
                if not bucket_topics: return P_INIT
                return sum(get_topic_mastery(t) for t in bucket_topics) / len(bucket_topics)
                
            avg_0 = get_avg(b0_topics)
            avg_1 = get_avg(b1_topics)
            avg_2 = get_avg(b2_topics)
            
            # RL State Vector (Local Graph Projection: Anchor + Prereqs + Postreqs)
            from services.graph_service import graph_engine
            local_topics = await graph_engine.get_local_graph_state_topics(subject, topic_key)
            
            # Rigorously enforce exactly 9 dimensions for PPO compatibility
            PAD_VALUE = 0.1
            PAD_NAME = "Padding_Topic"
            
            while len(local_topics) < 9:
                local_topics.append(PAD_NAME)
                
            state_vector = []
            for t in local_topics:
                if t == PAD_NAME:
                    state_vector.append(PAD_VALUE)
                else:
                    state_vector.append(mastery_map_updated.get(t, P_INIT))
                
            action = rl_agent.get_next_action(state_vector)
            action_idx = action.get("topic_index", 0)
            next_diff = action.get("difficulty", "Medium")
            
            # Select specific topic from the local projection window
            if 0 <= action_idx < 9 and local_topics[action_idx] != PAD_NAME:
                next_topic_name = local_topics[action_idx]
            else:
                next_topic_name = topic_key # Fallback to anchor if agent hits a pad
        else:
            pass # Remediation keeps next_topic_name and next_diff
        
        # Need current topics list for index lookup
        session_info = await db_module.get_session_by_id(req.session_id)
        exam_id = session_info.get("exam_id")
        topics_list_sync = await db_module.get_evaluation_topics(exam_id) if exam_id else []
        if not topics_list_sync: topics_list_sync = [f"Topic {i+1}" for i in range(9)]
        
        try:
            next_topic_idx_raw = topics_list_sync.index(next_topic_name)
        except:
            next_topic_idx_raw = 0
            
        # Ensure UI always receives latest 3-bucket averages safely
        final_mastery_map = await db_module.get_student_progress(req.student_id, subject)
        n_sync = len(topics_list_sync)
        k_sync = max(1, n_sync // 3)
        def final_avg(bucket):
            if not bucket: return P_INIT
            return sum(final_mastery_map.get(t, P_INIT) for t in bucket) / len(bucket)
            
        ui_mastery_vector = [
            final_avg(topics_list_sync[:k_sync]),
            final_avg(topics_list_sync[k_sync:2*k_sync]),
            final_avg(topics_list_sync[2*k_sync:])
        ]
            
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
            "current_mastery_vector": ui_mastery_vector,
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
