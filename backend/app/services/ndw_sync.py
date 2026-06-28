import gzip
import logging
import os
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import httpx
import ijson
from sqlalchemy import create_engine, delete, exists, func, or_, select, text
from sqlalchemy.orm import Session, sessionmaker, selectinload

from app.config import settings
from app.models import (
    Connector,
    Evse,
    Station,
    StatusDiff,
    SyncRun,
    Tariff,
    TariffPriceComponent,
    TariffRestriction,
)
from app.services.ndw_parser import make_tariff_id, parse_location, parse_tariff
from app.services.pricing import is_valid_energy_price
from app.services.tariff_join import resolve_connector_price

logger = logging.getLogger(__name__)

sync_engine = create_engine(settings.database_url_sync, pool_pre_ping=True)
SyncSession = sessionmaker(sync_engine)


@contextmanager
def _stream_json_items(url: str, keys: tuple[str, ...] = ("data", "items")) -> Iterator[Iterator]:
    """Download a gzipped OCPI JSON export to a temp file and yield an iterator
    over its items without loading the whole dataset into memory.

    The gz is streamed to disk (never held fully in RAM), decompressed
    incrementally via `gzip.open`, and parsed item-by-item with `ijson`.
    Handles both root-array exports and objects wrapping the array under a key.
    """
    tmp = tempfile.NamedTemporaryFile(suffix=".json.gz", delete=False)
    try:
        with httpx.Client(timeout=300.0, follow_redirects=True) as client:
            with client.stream("GET", url) as resp:
                resp.raise_for_status()
                for chunk in resp.iter_bytes(chunk_size=1 << 20):
                    tmp.write(chunk)
        tmp.close()

        prefix = _detect_array_prefix(tmp.name, keys)
        with gzip.open(tmp.name, "rb") as fileobj:
            yield ijson.items(fileobj, prefix)
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


def _detect_array_prefix(path: str, keys: tuple[str, ...]) -> str:
    """Find the ijson prefix for the array of records.

    Root array -> "item". Object wrapper -> "<key>.item", preferring a known
    wrapper key in `keys`, otherwise falling back to the first array-valued
    top-level key (mirrors the previous best-effort JSON shape handling).
    """
    fallback: str | None = None
    with gzip.open(path, "rb") as fileobj:
        for event_prefix, event, _ in ijson.parse(fileobj):
            if event == "start_array" and event_prefix == "":
                return "item"
            if event == "start_map" and event_prefix == "":
                continue
            # First array one level deep under the root object.
            if event == "start_array" and event_prefix and "." not in event_prefix:
                if event_prefix in keys:
                    return f"{event_prefix}.item"
                if fallback is None:
                    fallback = f"{event_prefix}.item"
            # Stop scanning once we are clearly past the top-level structure.
            if event_prefix.count(".") > 1:
                break
    if fallback is not None:
        return fallback
    return f"{keys[0]}.item" if keys else "item"


def _load_tariffs_map(session: Session, keys: set[str] | None = None) -> dict[str, dict]:
    tariffs: dict[str, dict] = {}
    q = select(Tariff).options(
        selectinload(Tariff.price_components),
        selectinload(Tariff.restrictions),
    )
    if keys:
        q = q.where(Tariff.id.in_(keys))
    for t in session.scalars(q).all():
        components = [
            {"type": c.type, "price": c.price, "vat": c.vat, "step_size": c.step_size}
            for c in t.price_components
        ]
        restrictions = [
            {
                "start_time": r.start_time,
                "end_time": r.end_time,
                "day_of_week": r.day_of_week,
                "min_duration": r.min_duration,
                "max_duration": r.max_duration,
            }
            for r in t.restrictions
        ]
        tariffs[t.id] = {
            "currency": t.currency,
            "price_components": components,
            "restrictions": restrictions,
        }
    return tariffs


def _record_diff(session: Session, evse_id: str, field: str, old: str | None, new: str | None) -> None:
    if old == new:
        return
    session.add(StatusDiff(evse_id=evse_id, field=field, old_value=old, new_value=new))


def sync_locations() -> int:
    logger.info("Starting locations sync")
    count = 0
    try:
        with SyncSession() as session:
            tariffs_map = _load_tariffs_map(session)

            with _stream_json_items(settings.ndw_locations_url) as items:
                batch: list[dict] = []
                for raw_loc in items:
                    if isinstance(raw_loc, dict):
                        parsed = parse_location(raw_loc)
                        if parsed:
                            batch.append(parsed)
                    if len(batch) >= 200:
                        count += _upsert_locations_batch(session, batch, tariffs_map)
                        session.commit()
                        session.expire_all()
                        batch = []
                if batch:
                    count += _upsert_locations_batch(session, batch, tariffs_map)

            run = session.scalar(select(SyncRun).where(SyncRun.dataset == "locations"))
            if not run:
                run = SyncRun(dataset="locations")
                session.add(run)
            run.last_success_at = datetime.now(timezone.utc)
            run.records_processed = count
            run.error_message = None
            session.commit()

            # Only purge once tariffs exist; otherwise a fresh DB (no tariffs yet)
            # would have every just-synced station deleted.
            tariff_count = session.scalar(select(func.count()).select_from(Tariff)) or 0
            if tariff_count > 0:
                purge_priceless_stations()
        logger.info("Locations sync complete: %d stations", count)
        return count
    except Exception as e:
        logger.exception("Locations sync failed")
        with SyncSession() as session:
            run = session.scalar(select(SyncRun).where(SyncRun.dataset == "locations"))
            if not run:
                run = SyncRun(dataset="locations")
                session.add(run)
            run.error_message = str(e)
            session.commit()
        raise


def _upsert_locations_batch(
    session: Session, locations: list[dict], tariffs_map: dict[str, dict]
) -> int:
    count = 0
    for loc in locations:
        station = session.get(Station, loc["id"])
        if not station:
            station = Station(id=loc["id"])
            session.add(station)

        station.country_code = loc["country_code"]
        station.party_id = loc["party_id"]
        station.location_id = loc["location_id"]
        station.name = loc["name"]
        station.address = loc["address"]
        station.city = loc["city"]
        station.latitude = loc["latitude"]
        station.longitude = loc["longitude"]
        station.geom = f"SRID=4326;POINT({loc['longitude']} {loc['latitude']})"
        station.operator_name = loc["operator_name"]
        station.owner_name = loc["owner_name"]
        station.parking_type = loc["parking_type"]
        station.facilities = loc["facilities"]
        station.publish = loc["publish"]
        station.access_class = loc["access_class"]
        station.last_updated = loc["last_updated"]
        station.fetched_at = datetime.now(timezone.utc)

        existing_evse_ids = {e.id for e in session.scalars(
            select(Evse).where(Evse.station_id == loc["id"])
        ).all()}

        for evse_data in loc.get("evses") or []:
            evse = session.get(Evse, evse_data["id"])
            old_status = evse.status if evse else None
            if not evse:
                evse = Evse(id=evse_data["id"], station_id=loc["id"])
                session.add(evse)
            evse.evse_uid = evse_data["evse_uid"]
            evse.status = evse_data["status"]
            evse.last_updated = evse_data["last_updated"]
            _record_diff(session, evse_data["id"], "status", old_status, evse_data["status"])
            existing_evse_ids.discard(evse_data["id"])

            for conn_data in evse_data.get("connectors") or []:
                conn = session.get(Connector, conn_data["id"])
                old_price = str(conn.resolved_energy_price) if conn and conn.resolved_energy_price else None
                if not conn:
                    conn = Connector(
                        id=conn_data["id"],
                        evse_id=evse_data["id"],
                        station_id=loc["id"],
                    )
                    session.add(conn)
                conn.connector_id = conn_data["connector_id"]
                conn.standard = conn_data["standard"]
                conn.max_power_kw = conn_data["max_power_kw"]
                conn.tariff_ids = conn_data["tariff_ids"]
                conn.country_code = conn_data["country_code"]
                conn.party_id = conn_data["party_id"]

                price, currency, _ = resolve_connector_price(conn_data, tariffs_map)
                if is_valid_energy_price(price):
                    conn.resolved_energy_price = price
                    conn.resolved_currency = currency
                else:
                    conn.resolved_energy_price = None
                    conn.resolved_currency = None
                new_price = str(price) if is_valid_energy_price(price) else None
                _record_diff(session, evse_data["id"], "energy_price", old_price, new_price)

        count += 1
    session.flush()
    return count


def sync_tariffs() -> int:
    logger.info("Starting tariffs sync")
    count = 0
    try:
        with SyncSession() as session:
            with _stream_json_items(
                settings.ndw_tariffs_url, keys=("data", "tariffs", "items")
            ) as items:
                for raw_tariff in items:
                    if not isinstance(raw_tariff, dict):
                        continue
                    parsed = parse_tariff(raw_tariff)
                    if not parsed:
                        continue

                    tariff = session.get(Tariff, parsed["id"])
                    if not tariff:
                        tariff = Tariff(id=parsed["id"])
                        session.add(tariff)
                    tariff.country_code = parsed["country_code"]
                    tariff.party_id = parsed["party_id"]
                    tariff.tariff_id = parsed["tariff_id"]
                    tariff.currency = parsed["currency"]
                    tariff.last_updated = parsed["last_updated"]

                    session.execute(
                        delete(TariffPriceComponent).where(TariffPriceComponent.tariff_id == parsed["id"])
                    )
                    session.execute(
                        delete(TariffRestriction).where(TariffRestriction.tariff_id == parsed["id"])
                    )
                    for pc in parsed["price_components"]:
                        session.add(TariffPriceComponent(
                            tariff_id=parsed["id"],
                            type=pc["type"],
                            price=pc["price"],
                            vat=pc.get("vat"),
                            step_size=pc.get("step_size"),
                        ))
                    for r in parsed["restrictions"]:
                        session.add(TariffRestriction(
                            tariff_id=parsed["id"],
                            start_time=r.get("start_time"),
                            end_time=r.get("end_time"),
                            day_of_week=r.get("day_of_week"),
                            min_duration=r.get("min_duration"),
                            max_duration=r.get("max_duration"),
                        ))
                    count += 1
                    if count % 2000 == 0:
                        session.commit()
                        logger.info("Tariffs sync progress: %d", count)

            run = session.scalar(select(SyncRun).where(SyncRun.dataset == "tariffs"))
            if not run:
                run = SyncRun(dataset="tariffs")
                session.add(run)
            run.last_success_at = datetime.now(timezone.utc)
            run.records_processed = count
            run.error_message = None
            session.commit()

        logger.info("Tariffs sync complete: %d tariffs", count)
        backfill_connector_prices()
        return count
    except Exception as e:
        logger.exception("Tariffs sync failed")
        with SyncSession() as session:
            run = session.scalar(select(SyncRun).where(SyncRun.dataset == "tariffs"))
            if not run:
                run = SyncRun(dataset="tariffs")
                session.add(run)
            run.error_message = str(e)
            session.commit()
        raise


def backfill_connector_prices() -> int:
    """Resolve and cache energy prices on all connectors from synced tariffs."""
    logger.info("Backfilling connector prices")
    updated = 0
    with SyncSession() as session:
        last_id = ""
        while True:
            q = select(Connector).order_by(Connector.id).limit(2000)
            if last_id:
                q = q.where(Connector.id > last_id)
            batch = session.scalars(q).all()
            if not batch:
                break

            tariff_keys: set[str] = set()
            for conn in batch:
                if conn.tariff_ids:
                    for tid in conn.tariff_ids:
                        tariff_keys.add(make_tariff_id(conn.country_code, conn.party_id, tid))

            tariffs_map = _load_tariffs_map(session, tariff_keys) if tariff_keys else {}

            for conn in batch:
                conn_data = {
                    "tariff_ids": conn.tariff_ids or [],
                    "country_code": conn.country_code,
                    "party_id": conn.party_id,
                }
                price, currency, _ = resolve_connector_price(conn_data, tariffs_map)
                if is_valid_energy_price(price):
                    if conn.resolved_energy_price != price or conn.resolved_currency != currency:
                        conn.resolved_energy_price = price
                        conn.resolved_currency = currency
                        updated += 1
                elif conn.resolved_energy_price is not None:
                    conn.resolved_energy_price = None
                    conn.resolved_currency = None
                    updated += 1
            session.commit()
            last_id = batch[-1].id
            logger.info("Price backfill progress: last_id=%s updated=%d", last_id, updated)

    logger.info("Connector price backfill complete: %d updated", updated)
    purge_priceless_stations()
    return updated


def purge_priceless_stations() -> int:
    """Delete connectors with no resolved electricity price, then any EVSEs and
    stations left without connectors. We never store chargers whose price is
    unknown, so the app only ever deals with priced stations.

    Returns the number of stations removed.
    """
    logger.info("Purging priceless stations")
    with SyncSession() as session:
        session.execute(
            delete(Connector).where(
                or_(
                    Connector.resolved_energy_price.is_(None),
                    Connector.resolved_energy_price <= 0,
                )
            )
        )
        session.execute(
            delete(Evse).where(
                ~exists(select(1).where(Connector.evse_id == Evse.id))
            )
        )
        result = session.execute(
            delete(Station).where(
                ~exists(select(1).where(Connector.station_id == Station.id))
            )
        )
        session.commit()
        removed = result.rowcount or 0
    logger.info("Purged %d priceless stations", removed)
    return removed


def purge_old_diffs() -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.diff_retention_days)
    with SyncSession() as session:
        result = session.execute(
            text("DELETE FROM status_diffs WHERE changed_at < :cutoff"),
            {"cutoff": cutoff},
        )
        session.commit()
        return result.rowcount or 0
