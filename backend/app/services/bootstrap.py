"""Initial NDW data load when the database is empty."""

import logging

from sqlalchemy import func, or_, select

from app.models import Connector, Station, Tariff
from app.services.ndw_sync import (
    SyncSession,
    backfill_connector_prices,
    refresh_station_pins,
    sync_locations,
    sync_tariffs,
)

logger = logging.getLogger(__name__)


def bootstrap_ndw_data(*, strict: bool = False) -> None:
    """Load locations (then tariffs) when tables are empty.

    When ``strict`` is True, failures propagate so deploy scripts can fail visibly.
    """
    try:
        with SyncSession() as session:
            station_count = session.scalar(select(func.count()).select_from(Station)) or 0
        if station_count == 0:
            logger.info("No stations in DB — running initial locations sync")
            sync_locations()
        else:
            logger.info("Skipping locations sync (%d stations present)", station_count)

        with SyncSession() as session:
            tariff_count = session.scalar(select(func.count()).select_from(Tariff)) or 0
        if tariff_count == 0:
            logger.info("No tariffs in DB — running initial tariff sync")
            sync_tariffs()
        else:
            with SyncSession() as session:
                missing = session.scalar(
                    select(func.count())
                    .select_from(Connector)
                    .where(
                        or_(
                            Connector.resolved_energy_price.is_(None),
                            Connector.resolved_energy_price <= 0,
                        )
                    )
                )
            if missing and missing > 0:
                backfill_connector_prices()

        # Ensure denormalized pin summaries exist even when no sync ran this
        # deploy (e.g. an already-populated DB getting the feature for the
        # first time). Runs before traffic via the predeploy command.
        refresh_station_pins()
    except Exception:
        logger.exception("Bootstrap NDW sync failed")
        if strict:
            raise
