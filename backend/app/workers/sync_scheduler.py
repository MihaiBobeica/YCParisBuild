import logging
import threading
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import func, select

from app.config import settings
from app.models import Connector, Station, Tariff
from app.services.ndw_sync import (
    SyncSession,
    backfill_connector_prices,
    purge_old_diffs,
    sync_locations,
    sync_tariffs,
)

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()


def _bootstrap_sync() -> None:
    """Ensure tariffs and locations are loaded before serving queries."""
    try:
        with SyncSession() as session:
            station_count = session.scalar(select(func.count()).select_from(Station)) or 0
        # Load locations first so map pins appear while tariffs sync in the background.
        if station_count == 0:
            logger.info("No stations in DB — running initial locations sync")
            sync_locations()

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
                    .where(Connector.resolved_energy_price.is_(None))
                )
            if missing and missing > 0:
                backfill_connector_prices()
    except Exception:
        logger.exception("Bootstrap sync failed")


def start_scheduler() -> None:
    if scheduler.running:
        return
    threading.Thread(target=_bootstrap_sync, daemon=True).start()
    scheduler.add_job(
        sync_tariffs,
        "interval",
        minutes=settings.sync_tariffs_interval_min,
        id="sync_tariffs",
        replace_existing=True,
        next_run_time=datetime.now() + timedelta(minutes=settings.sync_tariffs_interval_min),
    )
    scheduler.add_job(
        sync_locations,
        "interval",
        minutes=settings.sync_locations_interval_min,
        id="sync_locations",
        replace_existing=True,
        next_run_time=datetime.now() + timedelta(minutes=2),
    )
    scheduler.add_job(
        purge_old_diffs,
        "interval",
        hours=24,
        id="purge_diffs",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Sync scheduler started")
