"""Populate the guarded browser database with synthetic application examples."""
import json
from pathlib import Path
import runpy

context = runpy.run_path(str(Path(__file__).with_name("seed-browser-fixtures.py")))
from app.models import ApprovalApplication, Member  # noqa: E402
from app.services.forms import external_member_questions  # noqa: E402

fixture = context["fixtures"]
engine = context["engine"]
from sqlalchemy.orm import Session  # noqa: E402

with Session(engine) as db:
    for label, name, status, student in [
        ("Applicant", "Jordan Rivera", "required", True),
        ("Approval pending", "Alex Morgan", "pending", True),
        ("Approval denied", "Sam Taylor", "denied", False),
        ("Approval approved", "Casey Chen", "approved", False),
    ]:
        user = Member(name=name, email=label.lower().replace(" ", "-") + "@example.com", approval_status=status)
        db.add(user)
        db.flush()
        if status != "required":
            answers = {
                "college_student": "yes" if student else "no",
                "about": "I’m a local student who loves hiking, photography, and finding new trails. I recently moved to Orange County and would love to get to know more people who enjoy being outside.",
                "why_join": "I’d love to explore Southern California with a welcoming group and help out with club adventures. The weekend hikes and camping trips sound like a great way to build community.",
            }
            if student:
                answers.update(college_email="alex@sample-college.edu", school="Orange Coast College", grade="2nd year")
            db.add(ApprovalApplication(member_id=user.id, form_revision=1, questions=external_member_questions(), answers=answers,
                reviewed_at=context["utcnow"]() if status != "pending" else None,
                reviewed_by=1 if status != "pending" else None,
                message="Thank you for taking the time to introduce yourself. We’re unable to approve your application." if status == "denied" else ""))
        fixture["people"][label] = {"id": user.id, "name": user.name, "email": user.email, "approval_status": status}
        fixture["cookies"][label] = context["cookie"](user.id)
    db.commit()
context["path"].write_text(json.dumps(fixture, indent=2))
print("Added synthetic application, pending, approved, and denied examples.")
