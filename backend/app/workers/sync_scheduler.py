import logging
import multiprocessing
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

# Use a "spawn" context so each sync runs in a fresh interpreter with its own
# GIL and its own DB engine — never sharing the API process's event loop or
# connection pool. This is what keeps the heavy ijson parse + bulk upserts from
# stalling request handling. The scheduler worker thread blocks on join(), but
# that thread is separate from the asyncio event loop, so the API stays
# responsive throughout the sync.
_mp = multiprocessing.get_context("spawn")


def _bootstrap_sync() -> None:
    bootstrap_ndw_data(strict=False)


def _run_in_process(func, name: str) -> None:
    """Run a (CPU/GIL-heavy) sync callable in an isolated child process."""
    proc = _mp.Process(target=func, name=name, daemon=False)
    proc.start()
    proc.join()
    if proc.exitcode not in (0, None):
        logger.warning("Sync job %s exited with code %s", name, proc.exitcode)


def _run_sync_locations() -> None:
    _run_in_process(sync_locations, "sync_locations")


def _run_sync_tariffs() -> None:
    _run_in_process(sync_tariffs, "sync_tariffs")


def _run_purge_old_diffs() -> None:
    _run_in_process(purge_old_diffs, "purge_old_diffs")


def start_scheduler() -> None:
    if scheduler.running:
        return
    threading.Thread(
        target=_run_in_process,
        args=(_bootstrap_sync, "bootstrap_ndw"),
        daemon=True,
    ).start()
    scheduler.add_job(
        _run_sync_tariffs,
        "interval",
        minutes=settings.sync_tariffs_interval_min,
        id="sync_tariffs",
        replace_existing=True,
        next_run_time=datetime.now() + timedelta(minutes=settings.sync_tariffs_interval_min),
    )
    scheduler.add_job(
        _run_sync_locations,
        "interval",
        minutes=settings.sync_locations_interval_min,
        id="sync_locations",
        replace_existing=True,
        next_run_time=datetime.now() + timedelta(minutes=2),
    )
    scheduler.add_job(
        _run_purge_old_diffs,
        "interval",
        hours=24,
        id="purge_diffs",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Sync scheduler started")
