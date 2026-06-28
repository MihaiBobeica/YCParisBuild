import logging
import threading
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler

from app.config import settings
from app.services.bootstrap import bootstrap_ndw_data
from app.services.ndw_sync import (
    purge_old_diffs,
    sync_locations,
    sync_tariffs,
)

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()


def _bootstrap_sync() -> None:
    bootstrap_ndw_data(strict=False)


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
