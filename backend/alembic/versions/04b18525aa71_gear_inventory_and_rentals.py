"""gear inventory and rentals

Revision ID: 04b18525aa71
Revises: e91f52a680bc
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "04b18525aa71"
down_revision: Union[str, None] = "e91f52a680bc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gear_types",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "gear_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("type_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("rentable", sa.Boolean(), nullable=False),
        sa.Column("archived", sa.Boolean(), nullable=False),
        sa.Column("ownership", sa.String(length=10), nullable=False),
        sa.Column("owner", sa.String(length=100), nullable=False),
        sa.Column("loan_start", sa.Date(), nullable=True),
        sa.Column("loan_end", sa.Date(), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "(ownership = 'club' AND owner = '' AND loan_start IS NULL AND loan_end IS NULL) OR (ownership = 'officer' AND owner <> '' AND loan_start IS NOT NULL AND loan_end IS NOT NULL AND loan_end >= loan_start)"
        ),
        sa.CheckConstraint("quantity >= 0"),
        sa.ForeignKeyConstraint(
            ["type_id"],
            ["gear_types.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "gear_rentals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("start", sa.Date(), nullable=False),
        sa.Column("end", sa.Date(), nullable=False),
        sa.Column("activity", sa.Text(), nullable=False),
        sa.Column("comments", sa.Text(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.CheckConstraint('"end" >= start'),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["members.id"],
        ),
        sa.ForeignKeyConstraint(
            ["member_id"],
            ["members.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_gear_rentals_member_id"), "gear_rentals", ["member_id"], unique=False)
    op.create_table(
        "gear_lines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("rental_id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("type_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("type_name", sa.String(length=100), nullable=False),
        sa.Column("ownership", sa.String(length=10), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("picked_up_by", sa.Integer(), nullable=True),
        sa.Column("picked_up_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("returned_by", sa.Integer(), nullable=True),
        sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('pending','approved','denied','picked_up','returned','cancelled')"),
        sa.ForeignKeyConstraint(
            ["item_id"],
            ["gear_items.id"],
        ),
        sa.ForeignKeyConstraint(
            ["picked_up_by"],
            ["members.id"],
        ),
        sa.ForeignKeyConstraint(
            ["rental_id"],
            ["gear_rentals.id"],
        ),
        sa.ForeignKeyConstraint(
            ["returned_by"],
            ["members.id"],
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by"],
            ["members.id"],
        ),
        sa.ForeignKeyConstraint(
            ["type_id"],
            ["gear_types.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("rental_id", "type_id"),
    )
    op.create_index(op.f("ix_gear_lines_item_id"), "gear_lines", ["item_id"], unique=False)
    op.create_index(op.f("ix_gear_lines_rental_id"), "gear_lines", ["rental_id"], unique=False)

    op.bulk_insert(
        sa.table("gear_types", sa.column("name", sa.String), sa.column("revision", sa.Integer)),
        [
            {"name": name, "revision": 1}
            for name in ("Sleeping bag", "Sleeping pad", "Tent", "Portable camp toilet", "Camp stove")
        ],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_gear_lines_rental_id"), table_name="gear_lines")
    op.drop_index(op.f("ix_gear_lines_item_id"), table_name="gear_lines")
    op.drop_table("gear_lines")
    op.drop_index(op.f("ix_gear_rentals_member_id"), table_name="gear_rentals")
    op.drop_table("gear_rentals")
    op.drop_table("gear_items")
    op.drop_table("gear_types")
