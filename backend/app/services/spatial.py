import math
from typing import Any


def spread_sample(
    stations: list[dict[str, Any]],
    limit: int,
    min_lat: float,
    min_lon: float,
    max_lat: float,
    max_lon: float,
) -> list[dict[str, Any]]:
    """Pick up to `limit` stations spread evenly across the viewport using a grid."""
    if len(stations) <= limit:
        return stations

    cols = max(1, int(math.ceil(math.sqrt(limit))))
    rows = max(1, int(math.ceil(limit / cols)))
    lat_step = (max_lat - min_lat) / rows if max_lat > min_lat else 1.0
    lon_step = (max_lon - min_lon) / cols if max_lon > min_lon else 1.0

    def score(s: dict[str, Any]) -> tuple:
        has_price = 1 if s.get("energy_price") is not None else 0
        return (has_price, s.get("confidence") or 0)

    buckets: dict[tuple[int, int], dict[str, Any]] = {}
    for s in stations:
        ri = min(int((s["latitude"] - min_lat) / lat_step), rows - 1) if lat_step else 0
        ci = min(int((s["longitude"] - min_lon) / lon_step), cols - 1) if lon_step else 0
        key = (ri, ci)
        if key not in buckets or score(s) > score(buckets[key]):
            buckets[key] = s

    result = list(buckets.values())
    if len(result) < limit:
        used = {s["id"] for s in result}
        for s in sorted(stations, key=score, reverse=True):
            if len(result) >= limit:
                break
            if s["id"] not in used:
                result.append(s)
                used.add(s["id"])

    return result[:limit]
