import hashlib

import httpx

from app.config import settings
from app.db.redis import cache_get, cache_set


def _in_nl(lat: float, lon: float) -> bool:
    return (
        settings.nl_min_lat <= lat <= settings.nl_max_lat
        and settings.nl_min_lon <= lon <= settings.nl_max_lon
    )


async def geocode_query(query: str) -> list[dict]:
    cache_key = f"geocode:{hashlib.md5(query.lower().encode()).hexdigest()}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    results: list[dict] = []
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            settings.photon_url,
            params={"q": query, "limit": 5, "lang": "en"},
        )
        if resp.status_code == 200:
            for f in resp.json().get("features") or []:
                props = f.get("properties") or {}
                coords = f.get("geometry", {}).get("coordinates") or []
                if len(coords) < 2:
                    continue
                lon, lat = coords[0], coords[1]
                if props.get("countrycode", "").lower() != "nl" and not _in_nl(lat, lon):
                    continue
                if not _in_nl(lat, lon):
                    continue
                results.append({
                    "label": props.get("name") or query,
                    "address": ", ".join(
                        filter(None, [props.get("street"), props.get("city"), props.get("country")])
                    ),
                    "latitude": lat,
                    "longitude": lon,
                })

    if not results:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                settings.nominatim_url,
                params={"q": query, "format": "json", "countrycodes": "nl", "limit": 5},
                headers={"User-Agent": settings.app_name},
            )
            if resp.status_code == 200:
                for item in resp.json():
                    lat = float(item["lat"])
                    lon = float(item["lon"])
                    if not _in_nl(lat, lon):
                        continue
                    results.append({
                        "label": item.get("display_name", query).split(",")[0],
                        "address": item.get("display_name", ""),
                        "latitude": lat,
                        "longitude": lon,
                    })

    await cache_set(cache_key, results, 86400)
    return results
