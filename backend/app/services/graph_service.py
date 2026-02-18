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
