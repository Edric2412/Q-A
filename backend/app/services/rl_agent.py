import os
import numpy as np
from stable_baselines3 import PPO
import logging

logger = logging.getLogger(__name__)

# Path to the model
MODEL_PATH = os.path.join(os.path.dirname(__file__), "../resources/adaptive_tutor_policy/model.zip")
_model = None

def load_model():
    global _model
    if _model is None:
        if os.path.exists(MODEL_PATH):
            try:
                _model = PPO.load(MODEL_PATH)
                logger.info("RL Model loaded successfully.")
            except Exception as e:
                logger.error(f"Failed to load RL model: {e}")
        else:
             logger.error(f"RL Model not found at {MODEL_PATH}")
    return _model

def get_next_action(student_state: list) -> dict:
    """
    Predicts the next (Topic Index, Difficulty) based on student state.
    State: List of exactly 9 floats representing mastery for a sliding window of topics.
    Returns: {"topic_index": int, "difficulty": str, "raw_action": int}
    """
    model = load_model()
    n_topics = len(student_state)
    
    if not model or n_topics != 9:
        # Fallback if model missing or state invalid
        import random
        topic_idx = random.randint(0, 8)
        diff_idx = random.randint(0, 2)
        diff_map = {0: "Easy", 1: "Medium", 2: "Hard"}
        return {
            "action_type": "fallback",
            "topic_index": topic_idx,
            "difficulty": diff_map[diff_idx],
            "raw_action": topic_idx * 3 + diff_idx
        }

    # Predict against full per-topic mastery vector 
    # Explicitly reshape into a [1, N] batch to meet Stable-Baselines3 expectations
    state_tensor = np.array([student_state])
    action_raw, _ = model.predict(state_tensor, deterministic=False) 
    
    # Extract scalar action from the batched prediction
    action_val = int(action_raw[0] if isinstance(action_raw, np.ndarray) else action_raw)
    
    topic_idx = action_val // 3
    diff_idx = action_val % 3
    
    diff_map = {0: "Easy", 1: "Medium", 2: "Hard"}
    difficulty = diff_map.get(diff_idx, "Medium")
    
    # Boundary guardrail in case model output exceeds UI limits
    if topic_idx >= n_topics:
        topic_idx = max(0, n_topics - 1)
        
    return {
        "action_type": "model_prediction",
        "topic_index": topic_idx,
        "difficulty": difficulty,
        "raw_action": action_val
    }


