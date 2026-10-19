"""Event signup caps and scheduled quarter membership pauses."""

from alembic import op
import sqlalchemy as sa

revision = "d47b21a8cf90"
down_revision = "b51e773a08fd"
branch_labels = None
depends_on = None


def upgrade():
    for role in ("total", "ride", "driver", "own"):
        op.add_column("events", sa.Column(f"signup_cap_{role}", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_events_signup_caps",
        "events",
        "signup_cap_total >= 0 AND signup_cap_ride >= 0 AND signup_cap_driver >= 0 AND signup_cap_own >= 0",
    )
    for name in ("starts", "ends"):
        op.add_column(
            "quarters", sa.Column(f"membership_pause_{name}_at", sa.DateTime(timezone=True), nullable=True)
        )
    op.add_column(
        "quarters", sa.Column("membership_pause_message", sa.String(500), nullable=False, server_default="")
    )
    op.create_check_constraint(
        "ck_quarters_membership_pause",
        "quarters",
        "(membership_pause_starts_at IS NULL AND membership_pause_ends_at IS NULL) OR "
        "(membership_pause_starts_at IS NOT NULL AND membership_pause_ends_at IS NOT NULL "
        "AND membership_pause_ends_at > membership_pause_starts_at)",
    )


def downgrade():
    op.drop_constraint("ck_quarters_membership_pause", "quarters", type_="check")
    for name in ("membership_pause_starts_at", "membership_pause_ends_at", "membership_pause_message"):
        op.drop_column("quarters", name)
    op.drop_constraint("ck_events_signup_caps", "events", type_="check")
    for role in ("total", "ride", "driver", "own"):
        op.drop_column("events", f"signup_cap_{role}")
