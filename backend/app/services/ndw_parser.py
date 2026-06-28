from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

NL_TZ = ZoneInfo("Europe/Amsterdam")


def make_station_id(country_code: str, party_id: str, location_id: str) -> str:
    return f"{country_code}:{party_id}:{location_id}"


def make_evse_id(country_code: str, party_id: str, location_id: str, evse_uid: str) -> str:
    return f"{country_code}:{party_id}:{location_id}:{evse_uid}"


def make_connector_id(
    country_code: str, party_id: str, location_id: str, evse_uid: str, connector_id: str
) -> str:
    return f"{country_code}:{party_id}:{location_id}:{evse_uid}:{connector_id}"


def make_tariff_id(country_code: str, party_id: str, tariff_id: str) -> str:
    return f"{country_code}:{party_id}:{tariff_id}"


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def classify_access(publish: bool, parking_type: str | None) -> str:
    if not publish:
        return "private-like"
    if parking_type and parking_type.upper() in {"ON_DRIVEWAY", "ALONG_MOTORWAY", "PARKING_GARAGE"}:
        return "semi-public"
    return "public"


def parse_location(loc: dict[str, Any]) -> dict[str, Any] | None:
    country = loc.get("country_code", "NL")
    party = loc.get("party_id", "")
    loc_id = loc.get("id", "")
    if not party or not loc_id:
        return None

    coords = loc.get("coordinates") or {}
    lat = coords.get("latitude")
    lon = coords.get("longitude")
    if lat is None or lon is None:
        return None

    operator = loc.get("operator") or {}
    owner = loc.get("owner") or {}
    parking = loc.get("parking_type")

    return {
        "id": make_station_id(country, party, loc_id),
        "country_code": country,
        "party_id": party,
        "location_id": loc_id,
        "name": loc.get("name") or loc.get("address"),
        "address": loc.get("address"),
        "city": loc.get("city"),
        "latitude": float(lat),
        "longitude": float(lon),
        "operator_name": operator.get("name") if isinstance(operator, dict) else None,
        "owner_name": owner.get("name") if isinstance(owner, dict) else None,
        "parking_type": parking,
        "facilities": loc.get("facilities") or [],
        "publish": loc.get("publish", True),
        "access_class": classify_access(loc.get("publish", True), parking),
        "last_updated": parse_datetime(loc.get("last_updated")),
        "evses": [parse_evse(country, party, loc_id, e) for e in loc.get("evses") or []],
    }


def parse_evse(country: str, party: str, loc_id: str, evse: dict[str, Any]) -> dict[str, Any]:
    uid = evse.get("uid", "")
    return {
        "id": make_evse_id(country, party, loc_id, uid),
        "evse_uid": uid,
        "status": evse.get("status") or "UNKNOWN",
        "last_updated": parse_datetime(evse.get("last_updated")),
        "connectors": [
            parse_connector(country, party, loc_id, uid, c)
            for c in evse.get("connectors") or []
        ],
    }


def parse_connector(
    country: str, party: str, loc_id: str, evse_uid: str, conn: dict[str, Any]
) -> dict[str, Any]:
    cid = conn.get("id", "")
    max_power = conn.get("max_electric_power")
    if max_power is not None:
        max_power_kw = float(max_power) / 1000.0
    else:
        max_power_kw = None

    return {
        "id": make_connector_id(country, party, loc_id, evse_uid, cid),
        "connector_id": cid,
        "standard": conn.get("standard"),
        "max_power_kw": max_power_kw,
        "tariff_ids": conn.get("tariff_ids") or [],
        "country_code": country,
        "party_id": party,
    }


def parse_tariff(t: dict[str, Any]) -> dict[str, Any] | None:
    country = t.get("country_code", "NL")
    party = t.get("party_id", "")
    tid = t.get("id", "")
    if not party or not tid:
        return None

    components = []
    restrictions = []
    for el in t.get("elements") or []:
        for pc in el.get("price_components") or []:
            raw = pc.get("price")
            components.append({
                "type": pc.get("type", ""),
                "price": float(raw) if raw is not None else None,
                "vat": pc.get("vat"),
                "step_size": pc.get("step_size"),
            })
        r = el.get("restrictions")
        if r:
            restrictions.append({
                "start_time": r.get("start_time"),
                "end_time": r.get("end_time"),
                "day_of_week": r.get("day_of_week"),
                "min_duration": r.get("min_duration"),
                "max_duration": r.get("max_duration"),
            })

    return {
        "id": make_tariff_id(country, party, tid),
        "country_code": country,
        "party_id": party,
        "tariff_id": tid,
        "currency": t.get("currency"),
        "last_updated": parse_datetime(t.get("last_updated")),
        "price_components": components,
        "restrictions": restrictions,
    }
