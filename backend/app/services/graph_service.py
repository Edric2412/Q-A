import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from neo4j import GraphDatabase
from typing import List, Dict, Optional

# Ensure environment variables are loaded
load_dotenv(Path(__file__).parent.parent / ".env")

logger = logging.getLogger(__name__)

class GraphService:
    def __init__(self):
        uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        user = os.getenv("NEO4J_USER", "neo4j")
        password = os.getenv("NEO4J_PASSWORD", "password")
        try:
            self.driver = GraphDatabase.driver(uri, auth=(user, password))
            logger.info("Connected to Neo4j successfully.")
        except Exception as e:
            logger.error(f"Failed to connect to Neo4j: {e}")
            self.driver = None

    def close(self):
        if self.driver:
            self.driver.close()

    async def create_topic(self, subject: str, topic_name: str):
        """
        Creates a Topic node if it doesn't exist.
        """
        if not self.driver: return
        query = (
            "MERGE (s:Subject {name: $subject}) "
            "MERGE (t:Topic {name: $topic_name}) "
            "MERGE (s)-[:HAS_TOPIC]->(t)"
        )
        try:
            with self.driver.session() as session:
                session.run(query, subject=subject, topic_name=topic_name)
        except Exception as e:
            logger.error(f"Neo4j create_topic error: {e}")

    async def add_prerequisite(self, topic_name: str, prereq_name: str):
        """
        Creates a PREREQUISITE_OF relationship.
        """
        if not self.driver: return
        query = (
            "MERGE (t:Topic {name: $topic_name}) "
            "MERGE (p:Topic {name: $prereq_name}) "
            "MERGE (p)-[:PREREQUISITE_OF]->(t)"
        )
        try:
            with self.driver.session() as session:
                session.run(query, topic_name=topic_name, prereq_name=prereq_name)
        except Exception as e:
            logger.error(f"Neo4j add_prerequisite error: {e}")

    async def get_prerequisites(self, subject: str, topic_name: str) -> List[str]:
        """
        Returns a list of prerequisite topic names for a given topic WITHIN a subject.
        """
        if not self.driver: return []
        query = (
            "MATCH (s:Subject)-[:HAS_TOPIC]->(t:Topic) "
            "WHERE toLower(s.name) = toLower($subject) AND toLower(t.name) = toLower($topic_name) "
            "MATCH (p:Topic)-[:PREREQUISITE_OF]->(t) "
            "WHERE (s)-[:HAS_TOPIC]->(p) "
            "RETURN p.name as name"
        )
        try:
            with self.driver.session() as session:
                result = session.run(query, subject=subject, topic_name=topic_name)
                return [record["name"] for record in result]
        except Exception as e:
            logger.error(f"Neo4j get_prerequisites error: {e}")
            return []

    async def get_mastery_bottleneck(self, student_id: int, topic_name: str, subject: str, db_module) -> Optional[str]:
        """
        Traverses the graph to find the deepest unmastered prerequisite.
        """
        if not self.driver: return None
        
        prereqs = await self.get_prerequisites(subject, topic_name)
        if not prereqs: return None
        
        # Check mastery of each prereq in PostgreSQL
        mastery_map = await db_module.get_student_progress(student_id, subject)
        
        # Strategy: Return the first prerequisite with mastery < 0.6
        # Use Case-Insensitive keys for the mastery_map
        lower_mastery_map = {k.lower(): v for k, v in mastery_map.items()}
        for p in prereqs:
            m = lower_mastery_map.get(p.lower(), 0.1) # Default low if never seen
            if m < 0.6:
                return p
        return None

    async def get_local_graph_state_topics(self, subject: str, anchor_topic: str) -> List[str]:
        """
        Projects a sliding 9-topic bidirectional window from the graph:
        Index 0: Anchor Topic
        Index 1..4: Closest Prerequisites (Backward path)
        Index 5..8: Closest Post-requisites (Forward path)
        """
        if not self.driver: return [anchor_topic]
        
        # 1. Get up to 4 prerequisites (BFS order outward from anchor)
        prereq_query = (
            "MATCH (s:Subject)-[:HAS_TOPIC]->(t:Topic) "
            "WHERE toLower(s.name) = toLower($subject) AND toLower(t.name) = toLower($anchor) "
            "MATCH path = (p:Topic)-[:PREREQUISITE_OF*1..5]->(t) "
            "WHERE (s)-[:HAS_TOPIC]->(p) "
            "RETURN p.name as name, length(path) as dist "
            "ORDER BY dist ASC, name ASC LIMIT 4"
        )
        
        # 2. Get up to 4 post-requisites (BFS order outward from anchor)
        postreq_query = (
            "MATCH (s:Subject)-[:HAS_TOPIC]->(t:Topic) "
            "WHERE toLower(s.name) = toLower($subject) AND toLower(t.name) = toLower($anchor) "
            "MATCH path = (t)-[:PREREQUISITE_OF*1..5]->(post:Topic) "
            "WHERE (s)-[:HAS_TOPIC]->(post) "
            "RETURN post.name as name, length(path) as dist "
            "ORDER BY dist ASC, name ASC LIMIT 4"
        )
        
        try:
            with self.driver.session() as session:
                prereq_result = session.run(prereq_query, subject=subject, anchor=anchor_topic)
                prereqs = [record["name"] for record in prereq_result]
                
                postreq_result = session.run(postreq_query, subject=subject, anchor=anchor_topic)
                postreqs = [record["name"] for record in postreq_result]
                
                # Construct exactly 9-length logical mapping, prioritizing existing nodes
                state_topics = [anchor_topic]
                state_topics.extend(prereqs)
                state_topics.extend(postreqs)
                
                # Removing duplicates securely without breaking the anchor at 0
                unique_topics = []
                for t in state_topics:
                    if t not in unique_topics:
                        unique_topics.append(t)
                
                # Return list (it will be padded downstream in learning.py to reach 9)
                return unique_topics[:9]
                
        except Exception as e:
            logger.error(f"Neo4j get_local_graph_state_topics error: {e}")
            return [anchor_topic]

    async def get_subject_topics(self, subject: str) -> List[str]:
        """
        Returns all topic names for a given subject.
        """
        if not self.driver: return []
        query = "MATCH (s:Subject)-[:HAS_TOPIC]->(t:Topic) WHERE toLower(s.name) = toLower($subject) RETURN t.name as name"
        try:
            with self.driver.session() as session:
                result = session.run(query, subject=subject)
                return [record["name"] for record in result]
        except Exception as e:
            logger.error(f"Neo4j get_subject_topics error: {e}")
            return []

# Global instance
graph_engine = GraphService()
