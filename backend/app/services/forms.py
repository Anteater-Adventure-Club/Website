"""Shared form definitions and validation for events and admission applications."""
import re
from ..domain import fail
from ..schemas import Question


def external_member_questions():
    student = {"question_id": "college_student", "equals": "yes"}
    return [Question(**q).model_dump() for q in [
        {"id": "college_student", "label": "Are you currently a college student?", "kind": "yes-no", "required": True},
        {"id": "college_email", "label": "College email", "kind": "email", "required": True, "show_when": student},
        {"id": "school", "label": "School", "kind": "text", "required": True, "show_when": student},
        {"id": "grade", "label": "Grade", "kind": "choice", "required": True, "show_when": student,
         "options": ["1st year", "2nd year", "3rd year", "4th year", "grad student", "phd student"]},
        {"id": "about", "label": "Tell us a little bit about yourself.", "kind": "long", "required": True, "max_words": 250},
        {"id": "why_join", "label": "Why do you want to join Adventure Club?", "kind": "long", "required": True, "max_words": 250},
    ]]


def validate_answers(questions, answers, *, require_answers=True):
    definitions = [Question.model_validate(q) for q in questions]
    if any(key not in {q.id for q in definitions} for key in answers):
        fail(422, "answer_invalid", "An answer does not match the form questions.")
    result = {}
    for q in definitions:
        if q.show_when and result.get(q.show_when.question_id) != q.show_when.equals:
            continue
        answer = answers.get(q.id, [] if q.kind == "multiple-select" else "")
        if q.kind == "multiple-select":
            if (not isinstance(answer, list) or any(not isinstance(a, str) for a in answer)
                    or len(set(answer)) != len(answer) or any(a not in q.options for a in answer)):
                fail(422, "answer_invalid", "Choose from the available answers.", field=q.id)
        else:
            if not isinstance(answer, str) or len(answer) > (20000 if q.max_words else 2000):
                fail(422, "answer_invalid", "An answer is too long or has the wrong format.", field=q.id)
            answer = answer.strip()
            if answer and q.kind in {"choice", "yes-no"} and answer not in (
                ["yes", "no"] if q.kind == "yes-no" else q.options
            ):
                fail(422, "answer_invalid", "Choose one of the available answers.", field=q.id)
            if answer and q.kind == "email" and (len(answer) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", answer)):
                fail(422, "answer_invalid", "Enter a valid email address.", field=q.id)
            if q.max_words and len(answer.split()) > q.max_words:
                fail(422, "answer_word_limit", f"{q.label} Use no more than {q.max_words} words.", field=q.id)
        if require_answers and q.required and not answer:
            fail(422, "answer_required", f"Complete the required question: {q.label}", field=q.id)
        if q.id in answers:
            result[q.id] = answer
    return result
