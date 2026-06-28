import math
from typing import Any


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def estimate_travel_minutes(distance_km: float) -> int:
    return max(1, int(distance_km / 40 * 60))


def availability_score(statuses: list[str]) -> float:
    if any(s == "AVAILABLE" for s in statuses):
        return 1.0
    if all(s in {"CHARGING", "RESERVED", "OUTOFORDER", "INOPERATIVE"} for s in statuses if s):
        return 0.0
    if all(s == "UNKNOWN" or not s for s in statuses):
        return 0.0
    return 0.3


def build_recommendations(
    stations: list[dict[str, Any]],
    origin_lat: float,
    origin_lon: float,
    max_distance_km: float = 15.0,
    connector_filter: str | None = None,
) -> list[dict[str, Any]]:
    if not stations:
        return []

    for s in stations:
        s["distance_km"] = haversine_km(origin_lat, origin_lon, s["latitude"], s["longitude"])
        s["travel_minutes"] = estimate_travel_minutes(s["distance_km"])
        s["_avail"] = availability_score(s.get("statuses") or [])

    nearby = [s for s in stations if s["distance_km"] <= max_distance_km and s["_avail"] > 0]
    if not nearby:
        nearby = sorted(stations, key=lambda x: x["distance_km"])[:5]

    priced = [s for s in nearby if s.get("energy_price") is not None]
    max_power = max((s.get("max_power_kw") or 0 for s in nearby), default=1) or 1
    max_dist = max((s["distance_km"] for s in nearby), default=1) or 1

    def connector_match(s: dict) -> float:
        if not connector_filter:
            return 0.5
        standards = s.get("connector_types") or []
        if connector_filter in standards:
            return 1.0
        return 0.0

    def overall_score(s: dict) -> float:
        price_score = 0.0
        if s.get("energy_price") is not None and priced:
            prices = [p["energy_price"] for p in priced]
            mn, mx = min(prices), max(prices)
            if mx > mn:
                price_score = 1 - (s["energy_price"] - mn) / (mx - mn)
            else:
                price_score = 1.0
        dist_score = 1 - s["distance_km"] / max_dist
        power_score = (s.get("max_power_kw") or 0) / max_power
        return (
            0.35 * s["_avail"]
            + 0.20 * price_score
            + 0.20 * dist_score
            + 0.15 * power_score
            + 0.10 * connector_match(s)
        )

    results: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add_rec(station: dict, rec_type: str, reason: str) -> None:
        if station["id"] in seen:
            return
        seen.add(station["id"])
        results.append({
            "station_id": station["id"],
            "type": rec_type,
            "name": station.get("name") or station.get("address"),
            "distance_km": round(station["distance_km"], 1),
            "travel_minutes": station["travel_minutes"],
            "availability": station.get("availability_label"),
            "energy_price": station.get("energy_price"),
            "currency": station.get("currency"),
            "max_power_kw": station.get("max_power_kw"),
            "connector_types": station.get("connector_types") or [],
            "pin_color": station.get("pin_color"),
            "reason": reason,
            "latitude": station["latitude"],
            "longitude": station["longitude"],
        })

    best = max(nearby, key=overall_score, default=None)
    if best:
        price_str = f"€{best['energy_price']:.2f}/kWh" if best.get("energy_price") else "price unknown"
        add_rec(
            best,
            "best_overall",
            f"Best overall: {best['travel_minutes']} min away, {best.get('availability_label', 'unknown')}, "
            f"{price_str}, {best.get('max_power_kw') or '?'} kW.",
        )

    cheap_candidates = [
        s for s in nearby
        if s.get("energy_price") is not None and s["_avail"] > 0
    ]
    if cheap_candidates:
        cheapest = min(cheap_candidates, key=lambda x: x["energy_price"])
        add_rec(
            cheapest,
            "cheapest",
            f"Cheapest: {cheapest['travel_minutes']} min away, €{cheapest['energy_price']:.2f}/kWh, "
            f"{cheapest.get('max_power_kw') or '?'} kW.",
        )

    fast_candidates = [
        s for s in nearby
        if s["_avail"] == 1.0 and s.get("max_power_kw")
    ]
    if fast_candidates:
        def safe_score(s: dict) -> float:
            return (s.get("max_power_kw") or 0) * s["_avail"]

        fastest = max(fast_candidates, key=safe_score)
        add_rec(
            fastest,
            "fastest",
            f"Fastest / safest bet: {fastest['travel_minutes']} min away, available, "
            f"{fastest.get('max_power_kw')} kW.",
        )

    return results[:3]
