from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from app.services.ndw_parser import NL_TZ, make_tariff_id

DAY_MAP = {
    "MONDAY": 0, "TUESDAY": 1, "WEDNESDAY": 2, "THURSDAY": 3,
    "FRIDAY": 4, "SATURDAY": 5, "SUNDAY": 6,
}


def _time_in_window(now: datetime, start: str | None, end: str | None) -> bool:
    if not start and not end:
        return True
    t = now.time()
    if start:
        sh, sm = map(int, start.split(":")[:2])
        start_t = t.replace(hour=sh, minute=sm, second=0, microsecond=0)
        if t < start_t:
            return False
    if end:
        eh, em = map(int, end.split(":")[:2])
        end_t = t.replace(hour=eh, minute=em, second=0, microsecond=0)
        if t > end_t:
            return False
    return True


def _day_matches(now: datetime, days: list | None) -> bool:
    if not days:
        return True
    weekday = now.weekday()
    return any(DAY_MAP.get(str(d).upper(), -1) == weekday for d in days)


def tariff_matches_now(restrictions: list[dict], now: datetime | None = None) -> bool:
    now = now or datetime.now(NL_TZ)
    if not restrictions:
        return True
    return any(
        _time_in_window(now, r.get("start_time"), r.get("end_time"))
        and _day_matches(now, r.get("day_of_week"))
        for r in restrictions
    )


def resolve_connector_price(
    connector: dict[str, Any],
    tariffs: dict[str, dict],
    now: datetime | None = None,
) -> tuple[float | None, str | None, bool]:
    """Returns (energy_price, currency, tariff_matched)."""
    now = now or datetime.now(NL_TZ)
    tariff_ids = connector.get("tariff_ids") or []
    country = connector.get("country_code", "NL")
    party = connector.get("party_id", "")

    best_price: float | None = None
    best_currency: str | None = None
    fallback_price: float | None = None
    fallback_currency: str | None = None
    matched = False

    for tid in tariff_ids:
        key = make_tariff_id(country, party, tid)
        tariff = tariffs.get(key)
        if not tariff:
            continue
        matched = True
        energy_price = None
        energy_currency = None
        for pc in tariff.get("price_components") or []:
            if pc.get("type") == "ENERGY":
                energy_price = pc.get("price")
                energy_currency = tariff.get("currency")
                break
        if energy_price is None:
            continue
        if fallback_price is None:
            fallback_price = energy_price
            fallback_currency = energy_currency
        if tariff_matches_now(tariff.get("restrictions") or [], now):
            return energy_price, energy_currency, True

    if fallback_price is not None:
        return fallback_price, fallback_currency, matched

    return best_price, best_currency, matched


def get_tariff_fees(tariff: dict) -> dict[str, float | None]:
    fees: dict[str, float | None] = {
        "energy": None, "time": None, "parking_time": None, "flat": None,
    }
    for pc in tariff.get("price_components") or []:
        t = pc.get("type", "").lower()
        if t == "energy":
            fees["energy"] = pc.get("price")
        elif t == "time":
            fees["time"] = pc.get("price")
        elif t == "parking_time":
            fees["parking_time"] = pc.get("price")
        elif t == "flat":
            fees["flat"] = pc.get("price")
    return fees
