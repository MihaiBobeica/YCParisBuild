from datetime import datetime, timezone
from typing import Any

from geoalchemy2 import Geography
from geoalchemy2.functions import ST_DWithin, ST_MakeEnvelope, ST_MakePoint, ST_SetSRID
from sqlalchemy import Float, and_, cast, distinct, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models import Connector, Evse, Station, Tariff, TariffPriceComponent
from app.services.pricing import is_valid_energy_price
from app.services.pin_status import BLOCKING, aggregate_pin_color, availability_summary
from app.services.ndw_parser import make_tariff_id
from app.services.spatial import _cell_size_for_zoom
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


def _collect_tariff_keys(stations: list[Station]) -> set[str]:
    """Tariff IDs needed to resolve prices not already cached on connectors."""
    keys: set[str] = set()
    for station in stations:
        for evse in station.evses:
            for c in evse.connectors:
                if not is_valid_energy_price(c.resolved_energy_price) and c.tariff_ids:
                    for tid in c.tariff_ids:
                        keys.add(make_tariff_id(c.country_code, c.party_id, tid))
    return keys


def _priced_summaries(
    stations: list[Station],
    tariffs_map: dict[str, dict],
    origin_lat: float | None = None,
    origin_lon: float | None = None,
    connector_type: str | None = None,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for s in stations:
        summary = _station_summary(s, origin_lat, origin_lon, tariffs_map, connector_type)
        if summary and is_valid_energy_price(summary.get("energy_price")):
            results.append(summary)
    return results


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


async def _aggregated_bbox_summaries(
    session: AsyncSession,
    station_ids: list[str],
    origin_lat: float | None,
    origin_lon: float | None,
    connector_type: str | None,
) -> list[dict[str, Any]]:
    """Build map summaries for the chosen station ids via grouped SQL aggregation
    instead of hydrating EVSE/connector ORM objects.

    Map stations always have a cached, already-validated `resolved_energy_price`
    (priceless connectors/stations are purged on sync), so prices come straight
    from the connectors table — no tariff resolution needed here. Status pins use
    the real status multiset so `aggregate_pin_color`/`availability_summary`
    behave identically to the ORM path.
    """
    if not station_ids:
        return []

    station_rows = (
        await session.execute(
            select(
                Station.id,
                Station.name,
                Station.address,
                Station.city,
                Station.latitude,
                Station.longitude,
                Station.operator_name,
                Station.owner_name,
                Station.parking_type,
                Station.facilities,
                Station.access_class,
                Station.last_updated,
            ).where(Station.id.in_(station_ids))
        )
    ).all()

    # EVSE status multiset per station. When filtering by connector_type, only
    # statuses of EVSEs exposing that standard are counted (matching the ORM
    # path); last_updated still spans all EVSEs.
    statuses_agg = func.array_agg(Evse.status)
    if connector_type:
        statuses_agg = statuses_agg.filter(
            exists(
                select(1)
                .select_from(Connector)
                .where(
                    Connector.evse_id == Evse.id,
                    Connector.standard == connector_type,
                )
            )
        )
    evse_rows = (
        await session.execute(
            select(
                Evse.station_id,
                statuses_agg.label("statuses"),
                func.max(Evse.last_updated).label("last_updated"),
            )
            .where(Evse.station_id.in_(station_ids))
            .group_by(Evse.station_id)
        )
    ).all()
    evse_by_station = {r.station_id: r for r in evse_rows}

    # Connector aggregates: cheapest valid price, its currency, peak power, and
    # the distinct standards. Stored resolved_energy_price values are already
    # validated at sync time, so `> 0` selects exactly the valid prices.
    conn_q = (
        select(
            Connector.station_id,
            func.min(Connector.resolved_energy_price)
            .filter(Connector.resolved_energy_price > 0)
            .label("energy_price"),
            func.max(Connector.resolved_currency)
            .filter(Connector.resolved_energy_price > 0)
            .label("currency"),
            func.max(Connector.max_power_kw).label("max_power_kw"),
            func.array_agg(distinct(Connector.standard))
            .filter(Connector.standard.isnot(None))
            .label("standards"),
        )
        .where(Connector.station_id.in_(station_ids))
        .group_by(Connector.station_id)
    )
    if connector_type:
        conn_q = conn_q.where(Connector.standard == connector_type)
    conn_rows = (await session.execute(conn_q)).all()
    conn_by_station = {r.station_id: r for r in conn_rows}

    results: list[dict[str, Any]] = []
    for s in station_rows:
        conn = conn_by_station.get(s.id)
        energy_price = conn.energy_price if conn else None
        if not is_valid_energy_price(energy_price):
            continue
        evse = evse_by_station.get(s.id)
        statuses = list(evse.statuses) if evse and evse.statuses else []
        if connector_type and not statuses:
            continue
        last_updated = evse.last_updated if (evse and evse.last_updated) else s.last_updated
        standards = list(conn.standards) if (conn and conn.standards) else []

        summary: dict[str, Any] = {
            "id": s.id,
            "name": s.name,
            "address": s.address,
            "city": s.city,
            "latitude": s.latitude,
            "longitude": s.longitude,
            "operator": s.operator_name,
            "owner": s.owner_name,
            "parking_type": s.parking_type,
            "facilities": s.facilities or [],
            "access_class": s.access_class,
            "statuses": statuses,
            "availability_label": availability_summary(statuses),
            "energy_price": energy_price,
            "currency": conn.currency if conn else None,
            "max_power_kw": conn.max_power_kw if conn else None,
            "connector_types": standards,
            "pin_color": aggregate_pin_color(statuses),
            "last_updated": last_updated.isoformat() if last_updated else None,
        }
        if origin_lat is not None and origin_lon is not None:
            summary["distance_km"] = round(
                haversine_km(origin_lat, origin_lon, s.latitude, s.longitude), 2
            )
        results.append(summary)
    return results


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

    # Bbox overlap on the geography GiST index. For point geometries an
    # axis-aligned envelope overlap (`&&`) is exact, so we skip the per-row
    # `ST_Intersects` recheck the previous path paid on every heap tuple.
    envelope = cast(ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326), Geography)

    # Pin fields are precomputed at sync time (see ndw_sync.refresh_station_pins),
    # so the whole map view is served by a single spatial query with no EVSE/
    # connector joins or aggregation. When a connector_type filter is active we
    # read the exact per-standard snapshot from `pin_by_standard`; otherwise the
    # station's overall summary columns.
    if connector_type:
        j = Station.pin_by_standard[connector_type]
        price = cast(j["price"].astext, Float)
        currency = j["currency"].astext
        max_power = cast(j["kw"].astext, Float)
        pin_color = j["color"].astext
        availability_label = j["label"].astext
    else:
        price = Station.pin_energy_price
        currency = Station.pin_currency
        max_power = Station.pin_max_power_kw
        pin_color = Station.pin_color
        availability_label = Station.pin_availability_label

    cell = _cell_size_for_zoom(zoom)
    grid_lat = func.floor(Station.latitude / cell)
    grid_lon = func.floor(Station.longitude / cell)

    # One representative per grid cell, picking the max id (matches the
    # color-agnostic id tie-break of the previous Python/SQL selection). Only the
    # fields the frontend `StationPin` actually renders are selected; address/
    # city/owner/parking_type/facilities/access_class are intentionally omitted
    # (the detail sheet fetches those per-station) to keep the payload — and the
    # per-request serialization memory on the 1-CPU / 2GB box — small.
    inner = (
        select(
            Station.id,
            Station.name,
            Station.latitude,
            Station.longitude,
            Station.operator_name,
            price.label("energy_price"),
            currency.label("currency"),
            max_power.label("max_power_kw"),
            pin_color.label("pin_color"),
            availability_label.label("availability_label"),
            Station.pin_standards.label("connector_types"),
        )
        .where(Station.geom.op("&&")(envelope))
        .where(price > 0)
        .distinct(grid_lat, grid_lon)
        .order_by(grid_lat, grid_lon, Station.id.desc())
    )

    if connector_type:
        inner = inner.where(Station.pin_by_standard.has_key(connector_type))
    if filters.get("availability") == "available":
        inner = inner.where(pin_color == "green")
    elif filters.get("availability") == "unavailable":
        inner = inner.where(pin_color == "red")
    if filters.get("max_price") is not None:
        inner = inner.where(price <= filters["max_price"])
    if filters.get("min_kw"):
        inner = inner.where(max_power >= filters["min_kw"])
    if filters.get("operator"):
        inner = inner.where(Station.operator_name.ilike(f"%{filters['operator']}%"))
    if filters.get("access_class"):
        inner = inner.where(Station.access_class == filters["access_class"])
    if filters.get("parking_type"):
        inner = inner.where(Station.parking_type == filters["parking_type"])

    # Cap to `map_limit` cell representatives, ordered by id desc. The inner grid
    # DISTINCT ON already declutters to one pin per cell, so no Python sampling.
    sub = inner.subquery()
    rows = (
        await session.execute(select(sub).order_by(sub.c.id.desc()).limit(map_limit))
    ).mappings().all()

    has_origin = origin_lat is not None and origin_lon is not None
    results: list[dict[str, Any]] = []
    for r in rows:
        summary: dict[str, Any] = {
            "id": r["id"],
            "name": r["name"],
            "latitude": r["latitude"],
            "longitude": r["longitude"],
            "operator": r["operator_name"],
            "availability_label": r["availability_label"],
            "energy_price": r["energy_price"],
            "currency": r["currency"],
            "max_power_kw": r["max_power_kw"],
            "connector_types": r["connector_types"] or [],
            "pin_color": r["pin_color"],
        }
        if has_origin:
            summary["distance_km"] = round(
                haversine_km(origin_lat, origin_lon, r["latitude"], r["longitude"]), 2
            )
        results.append(summary)
    return results


async def fetch_station_detail(session: AsyncSession, station_id: str) -> dict[str, Any] | None:
    station = await session.scalar(
        select(Station)
        .where(Station.id == station_id)
        .options(selectinload(Station.evses).selectinload(Evse.connectors))
    )
    if not station:
        return None

    tariff_keys = _collect_tariff_keys([station])
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
    tariff_keys = _collect_tariff_keys(list(stations))
    tariffs_map = await load_tariffs_map(session, tariff_keys) if tariff_keys else {}
    return _priced_summaries(list(stations), tariffs_map)


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
    tariff_keys = _collect_tariff_keys(list(stations))
    tariffs_map = await load_tariffs_map(session, tariff_keys) if tariff_keys else {}
    results = _priced_summaries(
        list(stations), tariffs_map, lat, lon, connector_type
    )
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
