"""partner bookings

Stores reservations for manually onboarded discounted partner sites, plus a
snapshot of the price comparison used to compute savings at booking time.

Revision ID: 003
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "partner_bookings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("partner_site_id", sa.String(64), nullable=False),
        sa.Column("slot_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("slot_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("partner_price", sa.Float()),
        sa.Column("nearby_avg_price", sa.Float()),
        sa.Column("session_kwh", sa.Float(), server_default="40"),
        sa.Column("session_savings", sa.Float()),
        sa.Column("currency", sa.String(3), server_default="EUR"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("email", "partner_site_id", "slot_start", name="uq_partner_booking_slot"),
    )
    op.create_index("ix_partner_bookings_site_slot", "partner_bookings", ["partner_site_id", "slot_start"])
    op.create_index("ix_partner_bookings_email", "partner_bookings", ["email"])


def downgrade() -> None:
    op.drop_index("ix_partner_bookings_email", table_name="partner_bookings")
    op.drop_index("ix_partner_bookings_site_slot", table_name="partner_bookings")
    op.drop_table("partner_bookings")
