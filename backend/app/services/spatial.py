import math
from typing import Any


def map_limit_for_zoom(zoom: int) -> int:
    """How many pins to return for a given map zoom level."""
    if zoom >= 15:
        return 180
    if zoom >= 13:
        return 140
    if zoom >= 11:
        return 100
    if zoom >= 9:
        return 70
    return 45


def _cell_size_for_zoom(zoom: int | None) -> float:
    """Grid cell size in degrees — depends on zoom only, not viewport."""
    z = zoom if zoom is not None else 10
    if z >= 15:
        return 0.006
    if z >= 13:
        return 0.01
    if z >= 11:
        return 0.022
    if z >= 9:
        return 0.04
    return 0.07


def _station_score(s: dict[str, Any]) -> tuple:
    color = s.get("pin_color", "gray")
    color_pri = {"green": 4, "red": 3, "orange": 2, "gray": 1}.get(color, 0)
    has_price = 1 if s.get("energy_price") is not None else 0
    return (color_pri, has_price, s.get("id", ""))


def _cell_key(lat: float, lon: float, cell_size: float) -> tuple[int, int]:
    return (math.floor(lat / cell_size), math.floor(lon / cell_size))


def _candidate_score(c: dict[str, Any]) -> tuple:
    return (1 if c.get("has_available") else 0, c.get("id", ""))


def select_candidate_ids(
    candidates: list[dict[str, Any]],
    limit: int,
    min_lat: float,
    min_lon: float,
    max_lat: float,
    max_lon: float,
    zoom: int | None = None,
) -> list[str]:
    """
    Grid-sample lightweight candidates (id/lat/lon/has_available) down to
    `limit` station ids, one representative per zoom cell, preferring stations
    that have an available EVSE. Mirrors `select_map_pins` but scores on the
    cheap `has_available` flag so we never need full pin colors here.
    """
    if len(candidates) <= limit:
        return [c["id"] for c in candidates]

    cell_size = _cell_size_for_zoom(zoom)
    best_per_cell: dict[tuple[int, int], dict[str, Any]] = {}

    for c in candidates:
        lat, lon = c["latitude"], c["longitude"]
        if lat < min_lat or lat > max_lat or lon < min_lon or lon > max_lon:
            continue
        key = _cell_key(lat, lon, cell_size)
        existing = best_per_cell.get(key)
        if existing is None or _candidate_score(c) > _candidate_score(existing):
            best_per_cell[key] = c

    picked = sorted(best_per_cell.values(), key=_candidate_score, reverse=True)
    return [c["id"] for c in picked[:limit]]


def select_map_pins(
    stations: list[dict[str, Any]],
    limit: int,
    min_lat: float,
    min_lon: float,
    max_lat: float,
    max_lon: float,
    zoom: int | None = None,
) -> list[dict[str, Any]]:
    """
    Pick up to `limit` stations using a zoom-stable grid.

    One representative per cell (best score, id tie-break) so the same
    geography always shows the same pins regardless of bbox shifts.
    """
    if len(stations) <= limit:
        return stations

    cell_size = _cell_size_for_zoom(zoom)
    best_per_cell: dict[tuple[int, int], dict[str, Any]] = {}

    for s in stations:
        lat, lon = s["latitude"], s["longitude"]
        if lat < min_lat or lat > max_lat or lon < min_lon or lon > max_lon:
            continue
        key = _cell_key(lat, lon, cell_size)
        existing = best_per_cell.get(key)
        if existing is None or _station_score(s) > _station_score(existing):
            best_per_cell[key] = s

    picked = sorted(best_per_cell.values(), key=_station_score, reverse=True)
    return picked[:limit]


# Backwards-compatible alias
def spread_sample(
    stations: list[dict[str, Any]],
    limit: int,
    min_lat: float,
    min_lon: float,
    max_lat: float,
    max_lon: float,
) -> list[dict[str, Any]]:
    return select_map_pins(stations, limit, min_lat, min_lon, max_lat, max_lon)

