"""Event Google Sheets configuration and transactional sync queue."""
from alembic import op
import sqlalchemy as sa

revision = "f2e88b6d9a10"
down_revision = "d47b21a8cf90"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "google_sheets_connection",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("subject", sa.String(200)), sa.Column("email", sa.String(254)),
        sa.Column("refresh_token", sa.Text()), sa.Column("generation", sa.Integer(), nullable=False),
        sa.Column("error", sa.String(500), nullable=False),
        sa.Column("worker_seen_at", sa.DateTime(timezone=True)), sa.CheckConstraint("id = 1"),
    )
    op.create_table(
        "google_sheets_oauth_flows",
        sa.Column("state_hash", sa.String(64), primary_key=True),
        sa.Column("officer_id", sa.Integer(), sa.ForeignKey("members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("return_to", sa.String(500), nullable=False),
    )
    op.create_table(
        "event_google_sheets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("events.id", ondelete="SET NULL"), unique=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("provision_key", sa.String(32), unique=True, nullable=False),
        sa.Column("provision_started_at", sa.DateTime(timezone=True)),
        sa.Column("spreadsheet_id", sa.String(200), unique=True), sa.Column("sheet_id", sa.Integer()),
        sa.Column("columns", sa.JSON(), nullable=False), sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("requested", sa.Integer(), nullable=False), sa.Column("completed", sa.Integer(), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True)), sa.Column("pending_since", sa.DateTime(timezone=True)),
        sa.Column("last_synced_at", sa.DateTime(timezone=True)),
        sa.Column("error", sa.String(500), nullable=False), sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("blocked", sa.Boolean(), nullable=False),
        sa.Column("access_requested", sa.Integer(), nullable=False),
        sa.Column("access_completed", sa.Integer(), nullable=False),
        sa.Column("access_due_at", sa.DateTime(timezone=True)),
        sa.Column("access_error", sa.String(500), nullable=False),
        sa.Column("access_attempts", sa.Integer(), nullable=False),
        sa.Column("access_blocked", sa.Boolean(), nullable=False),
        sa.Column("claim_token", sa.String(32)), sa.Column("claimed_until", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_event_google_sheets_due", "event_google_sheets", ["due_at", "access_due_at"])
    op.create_table(
        "google_sheet_permissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sheet_id", sa.Integer(), sa.ForeignKey("event_google_sheets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(254), nullable=False), sa.Column("permission_id", sa.String(200)),
        sa.UniqueConstraint("sheet_id", "email"),
    )
    op.create_index("ix_google_sheet_permissions_sheet_id", "google_sheet_permissions", ["sheet_id"])


def downgrade():
    for table in ("google_sheet_permissions", "event_google_sheets", "google_sheets_oauth_flows",
                  "google_sheets_connection"):
        op.drop_table(table)
