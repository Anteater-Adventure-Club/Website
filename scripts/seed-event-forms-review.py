"""Synthetic event-form preview data; inherits the browser database safety guard."""
import json
from datetime import timedelta
from pathlib import Path
import runpy

context = runpy.run_path(str(Path(__file__).with_name("seed-browser-fixtures.py")))
from sqlalchemy.orm import Session  # noqa: E402
from app.domain import utcnow  # noqa: E402
from app.models import Event, EventForm, EventFormResponse, FormDefinition, Member, Signup  # noqa: E402
from app.schemas import Question  # noqa: E402

fixture = context["fixtures"]
now = utcnow()
questions = [Question(**q).model_dump() for q in [
    {"id": "confirmed", "label": "Are you still joining us for Yosemite?", "kind": "yes-no", "required": True},
    {"id": "gear", "label": "What gear do you need to borrow?", "kind": "multiple-select", "required": True,
     "options": ["Tent", "Sleeping bag", "Sleeping pad", "I have everything"],
     "show_when": {"question_id": "confirmed", "equals": "yes"}},
    {"id": "notes", "label": "Anything else we should know?", "kind": "long", "max_words": 150},
]]
signup_questions = [Question(id="experience", label="Tell us about your camping experience.", kind="long", max_words=150).model_dump()]
with Session(context["engine"]) as db:
    event = Event(quarter_id=fixture["quarter"]["id"], name="Yosemite Fall Retreat", kind="retreat", state="published",
                  destination="Yosemite National Park", description="Three days of granite peaks, golden trees, and campfire stories. Get your gear ready for a weekend in Yosemite Valley.",
                  starts_at=now + timedelta(days=12), ends_at=now + timedelta(days=14),
                  general_signup_opens_at=now - timedelta(days=5), packing=["Warm layers", "Hiking shoes", "Water bottle"],
                  questions=signup_questions)
    db.add(event)
    db.flush()
    people = [
        ("Form member", "Jordan Rivera"), ("Form responded", "Alex Morgan"), ("Form missing", "Sam Taylor"),
        ("Form late", "Casey Chen"), ("Form new", "Riley Park"),
    ]
    signups = []
    for index, (label, name) in enumerate(people):
        member = Member(name=name, email=label.lower().replace(" ", "-") + "@example.com", phone="9495550100")
        db.add(member)
        db.flush()
        signup = Signup(event_id=event.id, member_id=member.id, role="own", answers={"experience": "Weekend camping and local hikes."},
                        registered_at=now - timedelta(days=3) if index != 4 else now,
                        joined_at=now - timedelta(days=3) if index != 4 else now)
        db.add(signup)
        db.flush()
        signups.append(signup)
        fixture["people"][label] = {"id": member.id, "name": name, "email": member.email}
        fixture["cookies"][label] = context["cookie"](member.id)
    forms = []
    for number, title, opens, closes, state, late in [
        (1, "Yosemite gear check", -1, 3, "published", False),
        (2, "Confirm your spot", -3, -1, "published", True),
        (3, "Departure checklist", 5, 10, "published", False),
        (4, "Dietary preferences", -3, -1, "published", False),
        (5, "Weekend feedback", 14, 20, "draft", False),
    ]:
        form = EventForm(event_id=event.id, number=number, title=title, questions=questions,
                         instructions="Let’s make sure everyone is ready for the weekend. Tell us what you’re bringing and what you need — we’ll help with the rest.",
                         opens_at=now + timedelta(days=opens), closes_at=now + timedelta(days=closes),
                         state=state, required=number != 5, allow_late=late)
        db.add(form)
        db.flush()
        forms.append(form)
        for index in ([1, 3] if number == 1 else [0, 1, 3] if number in [2, 4] else []):
            submitted = now - timedelta(days=2) if number != 1 else now - timedelta(hours=2)
            if index == 3 and number == 2:
                submitted = now - timedelta(hours=1)
            answers = {"confirmed": "yes", "gear": ["Sleeping bag", "Sleeping pad"],
                       "notes": "Excited for the trip! I can help with camp setup."}
            if number == 1 and index == 3:
                answers = {"confirmed": "no", "notes": "My exam schedule changed, so I can’t make this trip."}
            db.add(EventFormResponse(form_id=form.id, signup_id=signups[index].id, questions=questions,
                                    answers=answers,
                                    form_revision=1, submitted_at=submitted, updated_at=submitted))
    db.add(FormDefinition(key="template-gear", kind="followup", title="Retreat gear check", questions=questions,
                          instructions="Let’s get ready for our trip. Tell us what you need to borrow.", required=True))
    db.add(FormDefinition(key="template-retreat-signup", kind="signup", title="Retreat signup questions",
                          questions=signup_questions, default_event_kinds=["retreat"]))
    db.commit()
    fixture["event_forms"] = {"event_id": event.id, "event_slug": "yosemite-fall-retreat",
                              "url": f"/events/yosemite-fall-retreat/{event.id}", "form_numbers": [f.number for f in forms]}
context["path"].write_text(json.dumps(fixture, indent=2))
print("Added Yosemite follow-up forms, templates, and synthetic participant responses.")
