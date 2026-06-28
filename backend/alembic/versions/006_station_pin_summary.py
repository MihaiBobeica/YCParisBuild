"""station pin summary columns

Denormalized map-pin summary on `stations`, refreshed at sync time so the map
endpoint serves pins from a single spatial query with no EVSE/connector
aggregation. `pin_by_standard` holds exact per-connector-type values.

Revision ID: 006
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("stations", sa.Column("pin_energy_price", sa.Float(), nullable=True))
    op.add_column("stations", sa.Column("pin_currency", sa.String(3), nullable=True))
    op.add_column("stations", sa.Column("pin_max_power_kw", sa.Float(), nullable=True))
    op.add_column("stations", sa.Column("pin_color", sa.String(8), nullable=True))
    op.add_column("stations", sa.Column("pin_availability_label", sa.String(48), nullable=True))
    op.add_column("stations", sa.Column("pin_standards", JSONB(), nullable=True))
    op.add_column("stations", sa.Column("pin_by_standard", JSONB(), nullable=True))


def downgrade() -> None:
    for col in (
        "pin_by_standard",
        "pin_standards",
        "pin_availability_label",
        "pin_color",
        "pin_max_power_kw",
        "pin_currency",
        "pin_energy_price",
    ):
        op.drop_column("stations", col)
