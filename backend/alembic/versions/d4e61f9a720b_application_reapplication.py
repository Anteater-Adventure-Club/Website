"""Preserve denied applications when an officer allows reapplication."""
from alembic import op
import sqlalchemy as sa

revision = "d4e61f9a720b"
down_revision = "c83f219a06bd"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "approval_application_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("members.id"), nullable=False),
        sa.Column("form_revision", sa.Integer(), nullable=False),
        sa.Column("questions", sa.JSON(), nullable=False),
        sa.Column("answers", sa.JSON(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("members.id")),
        sa.Column("message", sa.String(1000), nullable=False),
        sa.Column("reopened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reopened_by", sa.Integer(), sa.ForeignKey("members.id"), nullable=False),
    )
    op.create_index("ix_approval_application_history_member_id", "approval_application_history", ["member_id"])


def downgrade():
    op.drop_table("approval_application_history")
