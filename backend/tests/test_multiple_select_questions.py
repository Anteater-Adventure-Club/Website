import csv
import io

import pytest
from pydantic import ValidationError

from app.schemas import Question
from conftest import cookie, event, person, quarter, signup


QUESTION = {
    "id": "activities",
    "label": "Which activities?",
    "kind": "multiple-select",
    "required": False,
    "options": ["Hiking", "Swimming", "Picnic, games"],
}


@pytest.mark.parametrize("kind", ["choice", "multiple-select"])
@pytest.mark.parametrize("options", [[], ["Hiking"], ["Hiking", "Hiking"], ["Hiking", ""], ["x" * 101, "Hiking"]])
def test_choice_definitions_require_distinct_valid_options(kind, options):
    with pytest.raises(ValidationError):
        Question.model_validate({**QUESTION, "kind": kind, "options": options})


@pytest.mark.parametrize("answer", ["Hiking", "", ["Kayaking"], ["Hiking", "Hiking"], ["Hiking", "Kayaking"]])
def test_multiple_select_rejects_invalid_answers(api, answer):
    e = event(api, quarter(api), questions=[QUESTION])
    m = person(api)
    response = api.post(f"/api/admin/events/{e['id']}/signups", json={
        "member_id": m["id"], "role": "own", "answers": {"activities": answer},
    })
    assert response.status_code == 422, response.text
    assert response.json()["detail"]["code"] == "answer_invalid"
    assert api.get(f"/api/admin/events/{e['id']}/signups").json()["total"] == 0


@pytest.mark.parametrize("answers", [{}, {"activities": []}])
def test_required_multiple_select_needs_at_least_one_answer(api, answers):
    e = event(api, quarter(api), questions=[{**QUESTION, "required": True}])
    m = person(api)
    api.cookies.set("aac_session", cookie(m["id"]))
    response = api.put(f"/api/events/{e['id']}/signup", json={"role": "own", "answers": answers})
    assert response.status_code == 422, response.text
    assert response.json()["detail"]["code"] == "answer_required"


@pytest.mark.parametrize("kind", ["text", "long", "choice", "yes-no"])
def test_single_answer_questions_reject_lists(api, kind):
    e = event(api, quarter(api), questions=[{**QUESTION, "kind": kind}])
    m = person(api)
    response = api.post(f"/api/admin/events/{e['id']}/signups", json={
        "member_id": m["id"], "role": "own", "answers": {"activities": ["Hiking"]},
    })
    assert response.status_code == 422, response.text
    assert response.json()["detail"]["code"] == "answer_invalid"


def test_member_multiple_select_round_trip_and_edit_with_existing_answer_types(api):
    questions = [
        {**QUESTION, "required": True},
        {"id": "experience", "label": "Experience", "kind": "choice", "options": ["New", "Experienced"]},
        {"id": "note", "label": "Anything else?", "kind": "text"},
        {"id": "ready", "label": "Ready?", "kind": "yes-no"},
    ]
    e = event(api, quarter(api), questions=questions)
    assert e["questions"][0] == {**questions[0], "max_words": None, "show_when": None}
    m = person(api)
    api.cookies.set("aac_session", cookie(m["id"]))
    answers = {"activities": ["Swimming"], "experience": "New", "note": "Hello", "ready": "yes"}
    response = api.put(f"/api/events/{e['id']}/signup", json={"role": "own", "answers": answers})
    assert response.status_code == 200, response.text
    assert response.json()["answers"] == answers
    saved = api.get(f"/api/me/signups?event_id={e['id']}").json()["items"][0]
    assert saved["answers"] == answers
    answers["activities"] = ["Hiking", "Picnic, games"]
    response = api.put(f"/api/events/{e['id']}/signup", json={
        "role": "own", "answers": answers, "expected_revision": saved["revision"],
    })
    assert response.status_code == 200, response.text
    assert api.get(f"/api/me/signups?event_id={e['id']}").json()["items"][0]["answers"] == answers


def test_optional_answers_totals_and_csv_include_each_selected_choice(api):
    e = event(api, quarter(api), questions=[QUESTION])
    first = signup(api, e, person(api, 1), answers={"activities": ["Hiking", "Picnic, games"]})
    signup(api, e, person(api, 2), answers={"activities": ["Hiking"]})
    signup(api, e, person(api, 3), answers={"activities": []})
    signup(api, e, person(api, 4))
    cancelled = signup(api, e, person(api, 5), answers={"activities": ["Swimming"]})
    assert api.delete(f"/api/admin/signups/{cancelled['id']}").status_code == 200
    response = api.get(f"/api/admin/events/{e['id']}/questions")
    assert response.status_code == 200, response.text
    assert response.json()["totals"]["activities"] == {"Hiking": 2, "Picnic, games": 1, "": 2}
    assert next(row for row in response.json()["items"] if row["signup_id"] == first["id"])["answers"] == {
        "activities": ["Hiking", "Picnic, games"],
    }
    response = api.get(f"/api/admin/events/{e['id']}/signups.csv")
    assert response.status_code == 200, response.text
    rows = list(csv.DictReader(io.StringIO(response.text)))
    assert rows[0]["Which activities?"] == "Hiking; Picnic, games"
    assert rows[1]["Which activities?"] == "Hiking"
    assert rows[2]["Which activities?"] == rows[3]["Which activities?"] == ""


def test_multiple_select_accepts_all_options_and_csv_escapes_formulas(api):
    options = ["=1+1"] + [str(index).ljust(100, "x") for index in range(29)]
    e = event(api, quarter(api), questions=[{**QUESTION, "options": options}])
    s = signup(api, e, person(api), answers={"activities": options})
    assert s["answers"]["activities"] == options
    response = api.get(f"/api/admin/events/{e['id']}/signups.csv")
    rows = list(csv.DictReader(io.StringIO(response.text)))
    assert rows[0]["Which activities?"] == "'" + "; ".join(options)
