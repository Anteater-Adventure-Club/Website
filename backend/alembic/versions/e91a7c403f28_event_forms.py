"""Event follow-up forms and reusable question templates."""
from alembic import op
import sqlalchemy as sa

revision = "e91a7c403f28"
down_revision = "d4e61f9a720b"
branch_labels = None
depends_on = None


def upgrade():
    for column in [
        sa.Column("kind", sa.String(30), nullable=False, server_default="application"),
        sa.Column("title", sa.String(150), nullable=False, server_default=""),
        sa.Column("instructions", sa.Text(), nullable=False, server_default=""),
        sa.Column("required", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("allow_late", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("archived", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("default_event_kinds", sa.JSON(), nullable=False, server_default="[]"),
    ]:
        op.add_column("form_definitions", column)
    op.execute("UPDATE form_definitions SET title = 'External Member Application' WHERE key = 'external-members'")
    op.add_column("signups", sa.Column("registered_at", sa.DateTime(timezone=True), nullable=False,
                                      server_default=sa.text("now()")))
    op.execute("UPDATE signups SET registered_at = COALESCE(joined_at, registered_at)")
    op.create_table(
        "event_forms",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(150), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=False),
        sa.Column("questions", sa.JSON(), nullable=False),
        sa.Column("opens_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closes_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("required", sa.Boolean(), nullable=False),
        sa.Column("allow_late", sa.Boolean(), nullable=False),
        sa.Column("state", sa.String(20), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.UniqueConstraint("event_id", "number"),
        sa.CheckConstraint("closes_at > opens_at", name="ck_event_form_window"),
        sa.CheckConstraint("state IN ('draft','published','archived')", name="ck_event_form_state"),
    )
    op.create_index("ix_event_forms_event_id", "event_forms", ["event_id"])
    op.create_table(
        "event_form_responses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("form_id", sa.Integer(), sa.ForeignKey("event_forms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("signup_id", sa.Integer(), sa.ForeignKey("signups.id"), nullable=False),
        sa.Column("questions", sa.JSON(), nullable=False),
        sa.Column("answers", sa.JSON(), nullable=False),
        sa.Column("form_revision", sa.Integer(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.UniqueConstraint("form_id", "signup_id"),
    )
    op.create_index("ix_event_form_responses_form_id", "event_form_responses", ["form_id"])
    op.create_index("ix_event_form_responses_signup_id", "event_form_responses", ["signup_id"])
    op.create_table(
        "event_form_sheets",
        sa.Column("form_id", sa.Integer(), sa.ForeignKey("event_forms.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("sheet_id", sa.Integer(), nullable=False),
        sa.Column("columns", sa.JSON(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
    )
    op.add_column("event_google_sheets", sa.Column("next_form_transition_at", sa.DateTime(timezone=True)))
    op.create_index("ix_event_google_sheets_next_form_transition_at", "event_google_sheets", ["next_form_transition_at"])


def downgrade():
    op.drop_column("event_google_sheets", "next_form_transition_at")
    op.drop_table("event_form_sheets")
    op.drop_table("event_form_responses")
    op.drop_table("event_forms")
    op.drop_column("signups", "registered_at")
    for name in ("kind", "title", "instructions", "required", "allow_late", "archived", "default_event_kinds"):
        op.drop_column("form_definitions", name)
