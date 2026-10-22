"""Scheduled general retreat reservations and optional event activity logs."""
from alembic import op
import sqlalchemy as sa

revision = "e65c08a47d21"
down_revision = "f2e88b6d9a10"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("events", sa.Column("general_signup_opens_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("events", sa.Column("activity_logging", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column("events", "activity_logging")
    op.drop_column("events", "general_signup_opens_at")
