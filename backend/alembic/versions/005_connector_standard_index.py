"""connector (station_id, standard) composite index

Speeds up the bbox query's connector_type filter, which runs
EXISTS(SELECT 1 FROM connectors WHERE station_id = :id AND standard = :type).
The existing single-column ix_connectors_station can't satisfy the standard
predicate, forcing a heap lookup per candidate station.

Revision ID: 005
"""
from typing import Sequence, Union

from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_connectors_station_standard",
        "connectors",
        ["station_id", "standard"],
    )


def downgrade() -> None:
    op.drop_index("ix_connectors_station_standard", table_name="connectors")
