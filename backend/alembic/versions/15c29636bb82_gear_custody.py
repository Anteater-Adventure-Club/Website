"""Track current custody by numbered inventory copy."""

from alembic import op
import sqlalchemy as sa

revision = "15c29636bb82"
down_revision = "04b18525aa71"
branch_labels = None
depends_on = None


def upgrade():
    # Take the same lock as gear writers before the first table lock of the upgrade.
    op.execute("SELECT pg_advisory_xact_lock(759)")
    op.create_table(
        "gear_custodians",
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("gear_items.id"), primary_key=True),
        sa.Column("copy_number", sa.Integer(), primary_key=True),
        sa.Column("officer_id", sa.Integer(), sa.ForeignKey("members.id"), nullable=False),
        sa.CheckConstraint("copy_number >= 1"),
    )
    op.add_column("gear_lines", sa.Column("copy_number", sa.Integer(), nullable=True))
    op.create_check_constraint("ck_gear_lines_copy_number", "gear_lines", "copy_number >= 1")
    op.execute("""
        UPDATE gear_lines AS line SET copy_number = numbered.number
        FROM (
            SELECT id, row_number() OVER (PARTITION BY item_id ORDER BY picked_up_at, id) AS number
            FROM gear_lines WHERE status = 'picked_up'
        ) AS numbered WHERE line.id = numbered.id
    """)
    op.create_index("uq_gear_copy_checked_out", "gear_lines", ["item_id", "copy_number"],
                    unique=True, postgresql_where=sa.text("status = 'picked_up'"))


def downgrade():
    op.drop_index("uq_gear_copy_checked_out", table_name="gear_lines")
    op.drop_column("gear_lines", "copy_number")
    op.drop_table("gear_custodians")
