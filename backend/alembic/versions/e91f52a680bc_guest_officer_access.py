"""Temporary, permission-limited officer access."""
from alembic import op
import sqlalchemy as sa

revision = "e91f52a680bc"
down_revision = "d4e61f9a720b"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "guest_officer_access",
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("members.id"), primary_key=True),
        sa.Column("permissions", sa.JSON(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("granted_by", sa.Integer(), sa.ForeignKey("members.id"), nullable=False),
        sa.Column("updated_by", sa.Integer(), sa.ForeignKey("members.id"), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
    )


def downgrade():
    op.drop_table("guest_officer_access")
