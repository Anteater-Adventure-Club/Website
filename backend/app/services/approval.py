"""Account admission is separate from paid membership and scoped bans."""
from ..domain import fail
from ..models import Member


def enforce_approval(db, mid):
    user = db.get(Member, mid)
    if user is None or user.approval_status != "approved":
        fail(403, "approval_required", "Club approval is required. View your application for its current status.")
