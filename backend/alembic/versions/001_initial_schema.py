"""initial schema

Revision ID: 001
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geography

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "stations",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("party_id", sa.String(3), nullable=False),
        sa.Column("location_id", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255)),
        sa.Column("address", sa.String(512)),
        sa.Column("city", sa.String(128)),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("geom", Geography(geometry_type="POINT", srid=4326), nullable=False),
        sa.Column("operator_name", sa.String(255)),
        sa.Column("owner_name", sa.String(255)),
        sa.Column("parking_type", sa.String(64)),
        sa.Column("facilities", sa.dialects.postgresql.JSONB()),
        sa.Column("publish", sa.Boolean(), default=True),
        sa.Column("access_class", sa.String(32), default="public"),
        sa.Column("last_updated", sa.DateTime(timezone=True)),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_stations_geom", "stations", ["geom"], postgresql_using="gist")
    op.create_index("ix_stations_operator", "stations", ["operator_name"])
    op.create_index("ix_stations_city", "stations", ["city"])

    op.create_table(
        "evses",
        sa.Column("id", sa.String(160), primary_key=True),
        sa.Column("station_id", sa.String(128), sa.ForeignKey("stations.id", ondelete="CASCADE")),
        sa.Column("evse_uid", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), default="UNKNOWN"),
        sa.Column("last_updated", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_evses_station_status", "evses", ["station_id", "status"])

    op.create_table(
        "connectors",
        sa.Column("id", sa.String(200), primary_key=True),
        sa.Column("evse_id", sa.String(160), sa.ForeignKey("evses.id", ondelete="CASCADE")),
        sa.Column("station_id", sa.String(128), sa.ForeignKey("stations.id", ondelete="CASCADE")),
        sa.Column("connector_id", sa.String(64), nullable=False),
        sa.Column("standard", sa.String(64)),
        sa.Column("max_power_kw", sa.Float()),
        sa.Column("tariff_ids", sa.dialects.postgresql.JSONB()),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("party_id", sa.String(3), nullable=False),
        sa.Column("resolved_energy_price", sa.Float()),
        sa.Column("resolved_currency", sa.String(3)),
    )

    op.create_table(
        "tariffs",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("party_id", sa.String(3), nullable=False),
        sa.Column("tariff_id", sa.String(64), nullable=False),
        sa.Column("currency", sa.String(3)),
        sa.Column("last_updated", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("country_code", "party_id", "tariff_id"),
    )
    op.create_index("ix_tariffs_key", "tariffs", ["country_code", "party_id", "tariff_id"])

    op.create_table(
        "tariff_price_components",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tariff_id", sa.String(128), sa.ForeignKey("tariffs.id", ondelete="CASCADE")),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("vat", sa.Float()),
        sa.Column("step_size", sa.Float()),
    )

    op.create_table(
        "tariff_restrictions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tariff_id", sa.String(128), sa.ForeignKey("tariffs.id", ondelete="CASCADE")),
        sa.Column("start_time", sa.String(8)),
        sa.Column("end_time", sa.String(8)),
        sa.Column("day_of_week", sa.dialects.postgresql.JSONB()),
        sa.Column("min_duration", sa.Integer()),
        sa.Column("max_duration", sa.Integer()),
    )

    op.create_table(
        "status_diffs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("evse_id", sa.String(160), nullable=False),
        sa.Column("field", sa.String(32), nullable=False),
        sa.Column("old_value", sa.Text()),
        sa.Column("new_value", sa.Text()),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_status_diffs_evse", "status_diffs", ["evse_id"])

    op.create_table(
        "sync_runs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("dataset", sa.String(32), nullable=False, unique=True),
        sa.Column("last_success_at", sa.DateTime(timezone=True)),
        sa.Column("records_processed", sa.Integer(), default=0),
        sa.Column("error_message", sa.Text()),
    )

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255)),
        sa.Column("stripe_customer_id", sa.String(128), unique=True),
        sa.Column("stripe_subscription_id", sa.String(128), unique=True),
        sa.Column("plan", sa.String(16), default="none"),
        sa.Column("status", sa.String(32), default="none"),
        sa.Column("current_period_end", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_subscriptions_email", "subscriptions", ["email"])

    op.create_table(
        "stripe_events",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    for t in [
        "stripe_events", "subscriptions", "sync_runs", "status_diffs",
        "tariff_restrictions", "tariff_price_components", "tariffs",
        "connectors", "evses", "stations",
    ]:
        op.drop_table(t)
