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
    State: List of 9 floats (Mastery 0..1 for each of 9 topics).
    Returns: {"topic_index": int, "difficulty": str}
    """
    model = load_model()
    if not model or len(student_state) != 9:
        # Fallback if model missing or state invalid
        import random
        bucket = random.randint(0, 2)
        diff_map = {0: "Easy", 1: "Medium", 2: "Hard"}
        return {
            "action_type": "bucket_selection_fallback",
            "bucket_index": bucket,
            "difficulty": diff_map[bucket],
            "raw_action": bucket
        }

    # Predict
    # The model expects a boolean or int input? No, Box(0,1, shape=(3,)). 
    # It outputs a Discrete(3) action (0, 1, 2).
    # We interpret the action 0, 1, 2 as "Focus on Bucket X".
    # Bucket 0: Low Mastery (Need Improvement)
    # Bucket 1: Medium Mastery (Practice)
    # Bucket 2: High Mastery (Challenge/Maintain)
    
    # The input state should be [AvgMastery_Bucket0, AvgMastery_Bucket1, AvgMastery_Bucket2].
    
    action_raw, _ = model.predict(np.array(student_state), deterministic=False) 
    bucket_idx = int(action_raw) # 0, 1, or 2
    
    # We don't have the topic details here, just the decision "Focus on Bucket X".
    # We return the bucket index. The caller (learning.py) must map this to a specific topic.
    # We also need to determine difficulty.
    # Heuristic: 
    # If Bucket 0 (Low): Easy
    # If Bucket 1 (Med): Medium
    # If Bucket 2 (High): Hard
    
    diff_map = {0: "Easy", 1: "Medium", 2: "Hard"}
    difficulty = diff_map.get(bucket_idx, "Medium")
    
    return {
        "action_type": "bucket_selection",
        "bucket_index": bucket_idx,
        "difficulty": difficulty,
        "raw_action": bucket_idx
    }
