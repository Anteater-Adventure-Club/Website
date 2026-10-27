"""Member signup bans, independent of authentication and paid status."""
from alembic import op
import sqlalchemy as sa

revision = "a7c92d184ef0"
down_revision = "e65c08a47d21"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "member_bans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("members.id"), nullable=False),
        sa.Column("all_events", sa.Boolean(), nullable=False),
        sa.Column("event_kinds", sa.JSON(), nullable=False),
        sa.Column("events", sa.JSON(), nullable=False),
        sa.Column("membership", sa.Boolean(), nullable=False),
        sa.Column("reason", sa.String(2000), nullable=False),
        sa.Column("message", sa.String(1000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("members.id"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("lifted_at", sa.DateTime(timezone=True)),
        sa.Column("lifted_by", sa.Integer(), sa.ForeignKey("members.id")),
        sa.Column("lift_reason", sa.String(2000), nullable=False),
        sa.Column("request_id", sa.String(80), nullable=False, unique=True),
        sa.CheckConstraint("expires_at IS NULL OR expires_at > created_at", name="ck_member_ban_expiry"),
    )
    op.create_index("ix_member_bans_member_id", "member_bans", ["member_id"])


def downgrade():
    op.drop_table("member_bans")
