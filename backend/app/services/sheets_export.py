from sqlalchemy import select
from ..domain import PACIFIC
from ..models import Member, Signup

CORE_COLUMNS = [
    ("name", "Name"), ("email", "Email"), ("phone", "Phone"), ("transport", "Transport"),
    ("joined_at", "Signup time"), ("status", "Signup status"), ("notes", "Notes"),
]


def column_catalog(event):
    choices = CORE_COLUMNS + [("question:" + q["id"], q["label"].strip() or "Question " + q["id"])
                              for q in event.questions]
    used, result = set(), []
    for key, label in choices:
        header, number = label, 2
        while header.casefold() in used:
            suffix = f" ({number})"
            header = label[:200 - len(suffix)] + suffix
            number += 1
        used.add(header.casefold())
        result.append({"key": key, "header": header})
    return result


def signup_rows(db, eid, columns, limit=None):
    query = select(Signup, Member).join(Member).where(Signup.event_id == eid).order_by(Signup.id)
    if limit is not None:
        query = query.limit(limit)
    for signup, member in db.execute(query):
        values = {
            "name": member.name, "email": member.email or "", "phone": member.phone,
            "transport": {"ride": "Needs a ride", "driver": "Driving others", "own": "Has own ride",
                          "unknown": "Not recorded"}[signup.role],
            "joined_at": signup.joined_at.astimezone(PACIFIC).strftime("%Y-%m-%d %I:%M %p %Z")
            if signup.joined_at else "",
            "status": "Cancelled" if signup.cancelled else "Active", "notes": signup.notes,
        }
        for qid, answer in signup.answers.items():
            values["question:" + qid] = "\n".join(answer) if isinstance(answer, list) else answer
        yield [str(signup.id)] + [values.get(c["key"], "") for c in columns]


def form_column_catalog(form):
    base = [("name", "Name"), ("email", "Email"), ("phone", "Phone"), ("status", "Signup status"),
            ("response_status", "Response status"), ("form_state", "Form state"),
            ("submitted_at", "Submitted"), ("updated_at", "Last updated")]
    used, result = set(), []
    for key, label in base + [("question:" + q["id"], q["label"]) for q in form.questions]:
        header, number = label, 2
        while header.casefold() in used:
            suffix = f" ({number})"
            header = label[:200 - len(suffix)] + suffix
            number += 1
        used.add(header.casefold())
        result.append({"key": key, "header": header})
    return result


def form_rows(db, form, columns, limit=None):
    from ..models import EventFormResponse
    from .event_forms import STATUS_LABELS, response_status
    from ..domain import utcnow
    query = select(Signup, Member, EventFormResponse).join(Member).outerjoin(
        EventFormResponse, (EventFormResponse.signup_id == Signup.id) & (EventFormResponse.form_id == form.id),
    ).where(Signup.event_id == form.event_id).order_by(Signup.id)
    if limit is not None:
        query = query.limit(limit)
    at = utcnow()
    for signup, member, response in db.execute(query):
        values = {"name": member.name, "email": member.email or "", "phone": member.phone,
                  "status": "Cancelled" if signup.cancelled else "Active", "form_state": form.state.capitalize(),
                  "response_status": STATUS_LABELS[response_status(form, signup, response, at)],
                  "submitted_at": "", "updated_at": ""}
        if response:
            for key in ("submitted_at", "updated_at"):
                values[key] = getattr(response, key).astimezone(PACIFIC).strftime("%Y-%m-%d %I:%M %p %Z")
            for qid, answer in response.answers.items():
                values["question:" + qid] = "\n".join(answer) if isinstance(answer, list) else answer
        yield [str(signup.id)] + [values.get(c["key"], "") for c in columns]
