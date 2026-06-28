from datetime import datetime, timezone
from typing import Any

from geoalchemy2 import Geography
from geoalchemy2.functions import ST_DWithin, ST_Intersects, ST_MakeEnvelope, ST_MakePoint, ST_SetSRID
from sqlalchemy import cast, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models import Connector, Evse, Station, Tariff, TariffPriceComponent
from app.services.pricing import is_valid_energy_price
from app.services.pin_status import aggregate_pin_color, availability_summary
from app.services.ndw_parser import make_tariff_id
from app.services.spatial import select_candidate_ids, select_map_pins
from app.services.tariff_join import resolve_connector_price


def clamp_bbox(min_lat: float, min_lon: float, max_lat: float, max_lon: float) -> tuple[float, float, float, float]:
    """Clip bbox to NL extent; raise if no overlap."""
    min_lat = max(min_lat, settings.nl_min_lat)
    max_lat = min(max_lat, settings.nl_max_lat)
    min_lon = max(min_lon, settings.nl_min_lon)
    max_lon = min(max_lon, settings.nl_max_lon)
    if min_lat >= max_lat or min_lon >= max_lon:
        raise ValueError("Map view does not overlap the Netherlands")
    return min_lat, min_lon, max_lat, max_lon


def validate_bbox(min_lat: float, min_lon: float, max_lat: float, max_lon: float) -> None:
    """Legacy check — prefer clamp_bbox for API tolerance."""
    clamp_bbox(min_lat, min_lon, max_lat, max_lon)


from app.services.recommendation import haversine_km

MAP_PIN_LIMIT = 250


async def load_tariffs_map(session: AsyncSession, keys: set[str]) -> dict[str, dict]:
    """Load tariffs into a lookup dict for the given tariff IDs."""
    if not keys:
        return {}
    q = select(Tariff).where(Tariff.id.in_(keys)).options(
        selectinload(Tariff.price_components),
        selectinload(Tariff.restrictions),
    )
    tariffs: dict[str, dict] = {}
    for t in (await session.scalars(q)).all():
        tariffs[t.id] = {
            "currency": t.currency,
            "price_components": [
                {"type": c.type, "price": c.price, "vat": c.vat, "step_size": c.step_size}
                for c in t.price_components
            ],
            "restrictions": [
                {
                    "start_time": r.start_time,
                    "end_time": r.end_time,
                    "day_of_week": r.day_of_week,
                    "min_duration": r.min_duration,
                    "max_duration": r.max_duration,
                }
                for r in t.restrictions
            ],
        }
    return tariffs


def _connector_price_from_map(connector, tariffs_map: dict[str, dict]) -> tuple[float | None, str | None]:
    if is_valid_energy_price(connector.resolved_energy_price):
        return connector.resolved_energy_price, connector.resolved_currency
    if not connector.tariff_ids:
        return None, None
    conn_data = {
        "tariff_ids": connector.tariff_ids,
        "country_code": connector.country_code,
        "party_id": connector.party_id,
    }
    return resolve_connector_price(conn_data, tariffs_map)[:2]


def _station_summary(
    station: Station,
    origin_lat: float | None = None,
    origin_lon: float | None = None,
    tariffs_map: dict[str, dict] | None = None,
    connector_type: str | None = None,
) -> dict[str, Any] | None:
    statuses: list[str] = []
    connectors: list[Connector] = []
    for evse in station.evses:
        evse_connectors = [
            c for c in evse.connectors if not connector_type or c.standard == connector_type
        ]
        if connector_type and not evse_connectors:
            continue
        statuses.append(evse.status)
        connectors.extend(evse_connectors)

    if connector_type and not connectors:
        return None

    prices: list[float] = []
    currency = None
    for c in connectors:
        price, cur = _connector_price_from_map(c, tariffs_map or {})
        if is_valid_energy_price(price):
            prices.append(price)
            currency = currency or cur
    energy_price = min(prices) if prices else None
    powers = [c.max_power_kw for c in connectors if c.max_power_kw]
    max_power = max(powers) if powers else None
    standards = list({c.standard for c in connectors if c.standard})
    last_updated = max(
        (e.last_updated for e in station.evses if e.last_updated),
        default=station.last_updated,
    )
    pin_color = aggregate_pin_color(statuses)

    summary: dict[str, Any] = {
        "id": station.id,
        "name": station.name,
        "address": station.address,
        "city": station.city,
        "latitude": station.latitude,
        "longitude": station.longitude,
        "operator": station.operator_name,
        "owner": station.owner_name,
        "parking_type": station.parking_type,
        "facilities": station.facilities or [],
        "access_class": station.access_class,
        "statuses": statuses,
        "availability_label": availability_summary(statuses),
        "energy_price": energy_price,
        "currency": currency,
        "max_power_kw": max_power,
        "connector_types": standards,
        "pin_color": pin_color,
        "last_updated": last_updated.isoformat() if last_updated else None,
    }
    if origin_lat is not None and origin_lon is not None:
        summary["distance_km"] = round(
            haversine_km(origin_lat, origin_lon, station.latitude, station.longitude), 2
        )
    return summary


async def fetch_stations_in_bbox(
    session: AsyncSession,
    min_lat: float,
    min_lon: float,
    max_lat: float,
    max_lon: float,
    filters: dict[str, Any] | None = None,
    origin_lat: float | None = None,
    origin_lon: float | None = None,
    map_limit: int = MAP_PIN_LIMIT,
    zoom: int | None = None,
) -> list[dict[str, Any]]:
    min_lat, min_lon, max_lat, max_lon = clamp_bbox(min_lat, min_lon, max_lat, max_lon)
    if zoom is not None:
        zoom = int(round(zoom))
    filters = filters or {}
    connector_type = filters.get("connector_type")

    envelope = ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)

    # ---- Phase 1: lightweight candidate selection over the whole bbox ----
    # Aggregate availability in SQL; no ORM EVSE/connector objects are built, so
    # this stays cheap even when the bbox covers all of NL.
    has_available_expr = func.bool_or(Evse.status == "AVAILABLE")
    cand_q = (
        select(
            Station.id,
            Station.latitude,
            Station.longitude,
            has_available_expr.label("has_available"),
        )
        .select_from(Station)
        .outerjoin(Evse, Evse.station_id == Station.id)
        .where(ST_Intersects(Station.geom, envelope))
        .group_by(Station.id, Station.latitude, Station.longitude)
    )

    # Cheap filters that don't require building summaries belong in Phase 1 so
    # the candidate set is already correct before sampling.
    if connector_type:
        cand_q = cand_q.where(
            exists(
                select(1)
                .select_from(Connector)
                .where(Connector.station_id == Station.id, Connector.standard == connector_type)
            )
        )
    if filters.get("operator"):
        cand_q = cand_q.where(Station.operator_name.ilike(f"%{filters['operator']}%"))
    if filters.get("access_class"):
        cand_q = cand_q.where(Station.access_class == filters["access_class"])
    if filters.get("parking_type"):
        cand_q = cand_q.where(Station.parking_type == filters["parking_type"])
    cand_q = cand_q.where(
        exists(
            select(1)
            .select_from(Connector)
            .where(
                Connector.station_id == Station.id,
                Connector.resolved_energy_price.isnot(None),
                Connector.resolved_energy_price > 0,
            )
        )
    )
    if filters.get("availability") == "available":
        cand_q = cand_q.having(has_available_expr.is_(True))

    cand_rows = (await session.execute(cand_q)).all()
    if not cand_rows:
        return []

    candidates = [
        {
            "id": r.id,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "has_available": bool(r.has_available),
        }
        for r in cand_rows
    ]
    chosen_ids = select_candidate_ids(
        candidates, map_limit, min_lat, min_lon, max_lat, max_lon, zoom
    )
    if not chosen_ids:
        return []

    # ---- Phase 2: full load only for the chosen ids (bounded by map_limit) ----
    stations = (
        await session.scalars(
            select(Station)
            .where(Station.id.in_(chosen_ids))
            .options(selectinload(Station.evses).selectinload(Evse.connectors))
        )
    ).all()

    # Collect tariff keys needed for connectors missing cached prices
    tariff_keys: set[str] = set()
    for station in stations:
        for evse in station.evses:
            for c in evse.connectors:
                if c.resolved_energy_price is None and c.tariff_ids:
                    for tid in c.tariff_ids:
                        tariff_keys.add(make_tariff_id(c.country_code, c.party_id, tid))

    tariffs_map = await load_tariffs_map(session, tariff_keys) if tariff_keys else {}
    results: list[dict[str, Any]] = []
    for s in stations:
        summary = _station_summary(s, origin_lat, origin_lon, tariffs_map, connector_type)
        if summary and is_valid_energy_price(summary.get("energy_price")):
            results.append(summary)

    if filters.get("availability") == "available":
        results = [r for r in results if r["pin_color"] == "green"]
    elif filters.get("availability") == "unavailable":
        results = [r for r in results if r["pin_color"] == "red"]
    if filters.get("max_price") is not None:
        results = [r for r in results if r["energy_price"] is not None and r["energy_price"] <= filters["max_price"]]
    if filters.get("min_kw"):
        results = [r for r in results if r["max_power_kw"] and r["max_power_kw"] >= filters["min_kw"]]

    return select_map_pins(results, map_limit, min_lat, min_lon, max_lat, max_lon, zoom)


async def fetch_station_detail(session: AsyncSession, station_id: str) -> dict[str, Any] | None:
    station = await session.scalar(
        select(Station)
        .where(Station.id == station_id)
        .options(selectinload(Station.evses).selectinload(Evse.connectors))
    )
    if not station:
        return None

    tariff_keys: set[str] = set()
    for evse in station.evses:
        for c in evse.connectors:
            if c.tariff_ids:
                for tid in c.tariff_ids:
                    tariff_keys.add(make_tariff_id(c.country_code, c.party_id, tid))
    tariffs_map = await load_tariffs_map(session, tariff_keys)

    summary = _station_summary(station, tariffs_map=tariffs_map)
    if not summary or not is_valid_energy_price(summary.get("energy_price")):
        return None
    evses_detail = []
    time_fee = parking_fee = flat_fee = None
    session_fee_currency = summary.get("currency")

    for evse in station.evses:
        conn_details = []
        for c in evse.connectors:
            price, currency = _connector_price_from_map(c, tariffs_map)
            conn_details.append({
                "connector_id": c.connector_id,
                "standard": c.standard,
                "max_power_kw": c.max_power_kw,
                "energy_price": price,
                "currency": currency,
            })
            if c.tariff_ids:
                for tid in c.tariff_ids:
                    tariff_key = make_tariff_id(c.country_code, c.party_id, tid)
                    tariff = tariffs_map.get(tariff_key)
                    if not tariff:
                        continue
                    for pc in tariff.get("price_components", []):
                        t = pc.get("type")
                        if t == "TIME" and time_fee is None:
                            time_fee = pc.get("price")
                        elif t == "PARKING_TIME" and parking_fee is None:
                            parking_fee = pc.get("price")
                        elif t == "FLAT" and flat_fee is None:
                            flat_fee = pc.get("price")
                    session_fee_currency = tariff.get("currency") or session_fee_currency

        evses_detail.append({
            "evse_uid": evse.evse_uid,
            "status": evse.status,
            "last_updated": evse.last_updated.isoformat() if evse.last_updated else None,
            "connectors": conn_details,
        })

    summary.update({
        "evses": evses_detail,
        "time_fee": time_fee,
        "parking_fee": parking_fee,
        "session_fee": flat_fee,
        "fee_currency": session_fee_currency,
        "price_disclaimer": "NDW price may differ from your charging card tariff.",
    })
    return summary


async def search_stations_text(
    session: AsyncSession,
    query: str,
    limit: int = 50,
) -> list[dict[str, Any]]:
    pattern = f"%{query}%"
    stations = (
        await session.scalars(
            select(Station)
            .where(
                or_(
                    Station.name.ilike(pattern),
                    Station.address.ilike(pattern),
                    Station.city.ilike(pattern),
                    Station.operator_name.ilike(pattern),
                )
            )
            .options(selectinload(Station.evses).selectinload(Evse.connectors))
            .limit(limit)
        )
    ).all()
    return [
        summary
        for s in stations
        if (summary := _station_summary(s)) and is_valid_energy_price(summary.get("energy_price"))
    ]


async def fetch_nearby(
    session: AsyncSession,
    lat: float,
    lon: float,
    radius_km: float = 10.0,
    limit: int = 50,
    connector_type: str | None = None,
) -> list[dict[str, Any]]:
    point = cast(ST_SetSRID(ST_MakePoint(lon, lat), 4326), Geography)
    q = (
        select(Station)
        .where(ST_DWithin(cast(Station.geom, Geography), point, radius_km * 1000))
        .options(selectinload(Station.evses).selectinload(Evse.connectors))
    )
    if connector_type:
        q = q.where(
            exists(
                select(1)
                .select_from(Connector)
                .where(Connector.station_id == Station.id, Connector.standard == connector_type)
            )
        )
    q = q.limit(limit)
    stations = (await session.scalars(q)).all()
    results: list[dict[str, Any]] = []
    for s in stations:
        summary = _station_summary(s, lat, lon, connector_type=connector_type)
        if summary and is_valid_energy_price(summary.get("energy_price")):
            results.append(summary)
    return sorted(results, key=lambda x: x.get("distance_km", 999))


async def fetch_alternatives(
    session: AsyncSession,
    station_id: str,
    limit: int = 3,
) -> list[dict[str, Any]]:
    station = await session.get(Station, station_id)
    if not station:
        return []
    nearby = await fetch_nearby(session, station.latitude, station.longitude, radius_km=5.0, limit=20)
    return [n for n in nearby if n["id"] != station_id][:limit]


async def fetch_operators(session: AsyncSession) -> list[str]:
    rows = await session.scalars(
        select(Station.operator_name)
        .where(Station.operator_name.isnot(None))
        .distinct()
        .order_by(Station.operator_name)
    )
    return [r for r in rows if r]
