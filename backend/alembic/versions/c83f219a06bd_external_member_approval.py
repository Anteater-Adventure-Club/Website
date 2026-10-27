"""Grandfather current members and add external signup review."""
from alembic import op
import sqlalchemy as sa

revision = "c83f219a06bd"
down_revision = "a7c92d184ef0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("members", sa.Column("approval_status", sa.String(20), nullable=False, server_default="approved"))
    op.create_check_constraint("ck_member_approval", "members", "approval_status IN ('required','pending','approved','denied')")
    op.create_index("ix_members_approval_status", "members", ["approval_status"])
    forms = op.create_table(
        "form_definitions",
        sa.Column("key", sa.String(80), primary_key=True),
        sa.Column("questions", sa.JSON(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
    )
    student = {"question_id": "college_student", "equals": "yes"}
    op.bulk_insert(forms, [{"key": "external-members", "revision": 1, "questions": [
        {"id": "college_student", "label": "Are you currently a college student?", "kind": "yes-no", "required": True},
        {"id": "college_email", "label": "College email", "kind": "email", "required": True, "show_when": student},
        {"id": "school", "label": "School", "kind": "text", "required": True, "show_when": student},
        {"id": "grade", "label": "Grade", "kind": "choice", "required": True, "show_when": student,
         "options": ["1st year", "2nd year", "3rd year", "4th year", "grad student", "phd student"]},
        {"id": "about", "label": "Tell us a little bit about yourself.", "kind": "long", "required": True, "max_words": 250},
        {"id": "why_join", "label": "Why do you want to join Adventure Club?", "kind": "long", "required": True, "max_words": 250},
    ]}])
    op.create_table(
        "approval_applications",
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("members.id"), primary_key=True),
        sa.Column("form_revision", sa.Integer(), nullable=False),
        sa.Column("questions", sa.JSON(), nullable=False),
        sa.Column("answers", sa.JSON(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("members.id")),
        sa.Column("message", sa.String(1000), nullable=False),
    )


def downgrade():
    op.drop_table("approval_applications")
    op.drop_table("form_definitions")
    op.drop_index("ix_members_approval_status", table_name="members")
    op.drop_constraint("ck_member_approval", "members", type_="check")
    op.drop_column("members", "approval_status")
