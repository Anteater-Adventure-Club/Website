"""Support incomplete historical records in the website schema.

Revision ID: b51e773a08fd
Revises: 922533d3d862
"""

from alembic import op
import sqlalchemy as sa

revision = "b51e773a08fd"
down_revision = "922533d3d862"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "quarters",
        sa.Column("reimbursement_data_available", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.alter_column("signups", "seats", existing_type=sa.Integer(), nullable=True)
    op.alter_column("signups", "joined_at", existing_type=sa.DateTime(timezone=True), nullable=True)
    for check in sa.inspect(op.get_bind()).get_check_constraints("signups"):
        if "role" in check["sqltext"]:
            op.drop_constraint(check["name"], "signups", type_="check")
    op.create_check_constraint("ck_signups_role", "signups", "role IN ('ride','driver','own','unknown')")


def downgrade():
    incomplete = op.get_bind().scalar(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM signups WHERE role = 'unknown' OR seats IS NULL OR joined_at IS NULL)"
        )
    )
    if incomplete:
        raise RuntimeError("Remove or resolve historical signups before downgrading this schema")
    op.drop_constraint("ck_signups_role", "signups", type_="check")
    op.create_check_constraint("signups_role_check", "signups", "role IN ('ride','driver','own')")
    op.alter_column("signups", "seats", existing_type=sa.Integer(), nullable=False)
    op.alter_column("signups", "joined_at", existing_type=sa.DateTime(timezone=True), nullable=False)
    op.drop_column("quarters", "reimbursement_data_available")
