
import sys
import os
import unittest

# Add backend/app directory to sys.path so we can import 'main2' and it can find 'database'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../app')))

from main2 import clean_json_string, extract_student_identity, parse_student_text

class TestUtils(unittest.TestCase):

    # --- clean_json_string Tests ---

    def test_clean_json_string_simple(self):
        """Test standard JSON string extraction."""
        raw = 'Here is some text: {"id": 1} and more text.'
        expected = '{"id": 1}'
        self.assertEqual(clean_json_string(raw), expected)

    def test_clean_json_string_multiline(self):
        """Test multiline JSON extraction."""
        raw = 'Start\n{\n  "id": 123\n}\nEnd'
        self.assertEqual(clean_json_string(raw).strip(), '{\n  "id": 123\n}')

    def test_clean_json_string_nested(self):
        """Test nested JSON extraction."""
        raw = '{"outer": {"inner": 1}}'
        self.assertEqual(clean_json_string(raw), raw)

    def test_clean_json_string_no_json(self):
        """Test behavior when no JSON braces are found."""
        raw = "Just plain text"
        self.assertEqual(clean_json_string(raw), raw)

    # --- extract_student_identity Tests ---

    def test_extract_student_identity_standard(self):
        """Test standard formats: Roll No: 22BBA001"""
        text = "Name: John Doe\nRoll No: 22BBA001\nClass: BBA"
        self.assertEqual(extract_student_identity(text), "22BBA001")

    def test_extract_student_identity_variations(self):
        """Test variations like 'Roll Number', 'Roll No.', etc."""
        variations = [
            "Roll Number: 22BBA002",
            "Roll No. : 22BBA003",
            "Roll-No: 22BBA004",
            "Roll No 22BBA005"
        ]
        for v in variations:
            extracted = extract_student_identity(v)
            self.assertIsNotNone(extracted)
            self.assertTrue(extracted.startswith("22BBA"))

    def test_extract_student_identity_embedded(self):
        """Test when Roll No is embedded in a sentence."""
        text = "The student with Roll No: 22BBA006 has submitted."
        self.assertEqual(extract_student_identity(text), "22BBA006")

    def test_extract_student_identity_none(self):
        """Test when no Roll No is present."""
        text = "Just a name: Alice"
        self.assertIsNone(extract_student_identity(text))


    # --- parse_student_text Tests ---

    def test_parse_student_text_standard(self):
        """Test standard Q.No format."""
        text = """
        Q1. This is answer 1.
        Q2. This is answer 2.
        """
        parsed = parse_student_text(text)
        self.assertEqual(parsed.get("1"), "This is answer 1.")
        self.assertEqual(parsed.get("2"), "This is answer 2.")

    def test_parse_student_text_implicit(self):
        """Test implicit numbering like '1. Answer'."""
        text = """
        1. Answer one
        2. Answer two
        """
        parsed = parse_student_text(text)
        self.assertEqual(parsed.get("1"), "Answer one")
        self.assertEqual(parsed.get("2"), "Answer two")

    def test_parse_student_text_subparts(self):
        """Test subparts like 1a, 1b."""
        text = """
        1a. Part A answer
        1b. Part B answer
        """
        parsed = parse_student_text(text)
        # This behavior aggregates subparts into one answer string for "1"
        self.assertIn("Part A answer", parsed.get("1"))
        self.assertIn("Part B answer", parsed.get("1"))

    def test_parse_student_text_fallback(self):
        """Test fallback when no numbering is found."""
        text = """
        Just a paragraph of text.
        Another paragraph.
        """
        # If regex fails, fallback splits by newlines > 5 chars
        parsed = parse_student_text(text)
        self.assertEqual(parsed.get("1"), "Just a paragraph of text.")
        self.assertEqual(parsed.get("2"), "Another paragraph.")

if __name__ == '__main__':
    unittest.main()
