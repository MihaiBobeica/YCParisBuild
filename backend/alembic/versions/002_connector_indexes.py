"""connector lookup indexes

Speeds up the bbox query's Phase 2 selectinload of connectors and the
connector_type exists() filter, which previously seq-scanned the 156k-row
connectors table.

Revision ID: 002
"""
from typing import Sequence, Union

from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_connectors_evse", "connectors", ["evse_id"])
    op.create_index("ix_connectors_station", "connectors", ["station_id"])


def downgrade() -> None:
    op.drop_index("ix_connectors_station", table_name="connectors")
    op.drop_index("ix_connectors_evse", table_name="connectors")
