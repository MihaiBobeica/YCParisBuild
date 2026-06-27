from datetime import datetime, timezone
from typing import Any

from geoalchemy2 import Geography
from geoalchemy2.functions import ST_DWithin, ST_Intersects, ST_MakeEnvelope, ST_MakePoint, ST_SetSRID
from sqlalchemy import cast, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models import Connector, Evse, Station, Tariff, TariffPriceComponent
from app.services.confidence import compute_confidence
from app.services.pin_status import aggregate_pin_color, availability_summary
from app.services.ndw_parser import make_tariff_id
from app.services.spatial import spread_sample
from app.services.tariff_join import resolve_connector_price


def validate_bbox(min_lat: float, min_lon: float, max_lat: float, max_lon: float) -> None:
    if (
        min_lat < settings.nl_min_lat - 0.5
        or max_lat > settings.nl_max_lat + 0.5
        or min_lon < settings.nl_min_lon - 0.5
        or max_lon > settings.nl_max_lon + 0.5
    ):
        raise ValueError("Bounding box must be within the Netherlands")


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
    if connector.resolved_energy_price is not None:
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
) -> dict[str, Any]:
    statuses = [e.status for e in station.evses]
    connectors = [c for e in station.evses for c in e.connectors]
    prices: list[float] = []
    currency = None
    for c in connectors:
        price, cur = _connector_price_from_map(c, tariffs_map or {})
        if price is not None:
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
    tariff_matched = bool(prices) or any(c.tariff_ids for c in connectors)
    confidence, confidence_label = compute_confidence(statuses, energy_price is not None, last_updated, tariff_matched)
    has_partial = energy_price is None and bool(connectors)
    pin_color = aggregate_pin_color(statuses, confidence, has_partial)

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
        "confidence": confidence,
        "confidence_label": confidence_label,
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
) -> list[dict[str, Any]]:
    validate_bbox(min_lat, min_lon, max_lat, max_lon)
    filters = filters or {}

    envelope = ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
    q = (
        select(Station)
        .where(ST_Intersects(Station.geom, envelope))
        .options(selectinload(Station.evses).selectinload(Evse.connectors))
    )

    if filters.get("operator"):
        q = q.where(Station.operator_name.ilike(f"%{filters['operator']}%"))
    if filters.get("access_class"):
        q = q.where(Station.access_class == filters["access_class"])
    if filters.get("parking_type"):
        q = q.where(Station.parking_type == filters["parking_type"])

    stations = (await session.scalars(q)).all()

    # Collect tariff keys needed for connectors missing cached prices
    tariff_keys: set[str] = set()
    for station in stations:
        for evse in station.evses:
            for c in evse.connectors:
                if c.resolved_energy_price is None and c.tariff_ids:
                    for tid in c.tariff_ids:
                        tariff_keys.add(make_tariff_id(c.country_code, c.party_id, tid))

    tariffs_map = await load_tariffs_map(session, tariff_keys) if tariff_keys else {}
    results = [_station_summary(s, origin_lat, origin_lon, tariffs_map) for s in stations]

    if filters.get("availability") == "available":
        results = [r for r in results if r["pin_color"] == "green"]
    elif filters.get("availability") == "unavailable":
        results = [r for r in results if r["pin_color"] == "red"]
    if filters.get("known_price_only"):
        results = [r for r in results if r["energy_price"] is not None]
    if filters.get("max_price") is not None:
        results = [r for r in results if r["energy_price"] is not None and r["energy_price"] <= filters["max_price"]]
    if filters.get("min_kw"):
        results = [r for r in results if r["max_power_kw"] and r["max_power_kw"] >= filters["min_kw"]]
    if filters.get("connector_type"):
        ct = filters["connector_type"]
        results = [r for r in results if ct in (r.get("connector_types") or [])]
    if filters.get("min_confidence"):
        results = [r for r in results if r["confidence"] >= filters["min_confidence"]]

    return spread_sample(results, map_limit, min_lat, min_lon, max_lat, max_lon)


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
    return [_station_summary(s) for s in stations]


async def fetch_nearby(
    session: AsyncSession,
    lat: float,
    lon: float,
    radius_km: float = 10.0,
    limit: int = 50,
) -> list[dict[str, Any]]:
    point = cast(ST_SetSRID(ST_MakePoint(lon, lat), 4326), Geography)
    q = (
        select(Station)
        .where(ST_DWithin(cast(Station.geom, Geography), point, radius_km * 1000))
        .options(selectinload(Station.evses).selectinload(Evse.connectors))
        .limit(limit)
    )
    stations = (await session.scalars(q)).all()
    results = [_station_summary(s, lat, lon) for s in stations]
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
