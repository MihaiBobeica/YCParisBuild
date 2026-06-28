import json
import logging
from typing import Any

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)
_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def cache_get(key: str) -> Any | None:
    try:
        r = await get_redis()
        val = await r.get(key)
        if val is None:
            return None
        return json.loads(val)
    except Exception:
        logger.warning("Redis cache_get failed for %s", key, exc_info=True)
        return None


async def cache_set(key: str, value: Any, ttl: int) -> None:
    try:
        r = await get_redis()
        await r.set(key, json.dumps(value, default=str), ex=ttl)
    except Exception:
        logger.warning("Redis cache_set failed for %s", key, exc_info=True)


async def cache_get_raw(key: str) -> str | None:
    """Return the stored JSON string verbatim (no `json.loads`).

    Hot endpoints (the map-pin bbox query) cache an already-serialized JSON
    payload and stream it straight back to the client, so they never pay to
    deserialize into Python objects and then re-serialize. This removes a large
    transient allocation per cache hit on the 1-CPU / 2GB box.
    """
    try:
        r = await get_redis()
        return await r.get(key)
    except Exception:
        logger.warning("Redis cache_get_raw failed for %s", key, exc_info=True)
        return None


async def cache_set_raw(key: str, raw: str, ttl: int) -> None:
    """Store an already-serialized JSON string (companion to ``cache_get_raw``)."""
    try:
        r = await get_redis()
        await r.set(key, raw, ex=ttl)
    except Exception:
        logger.warning("Redis cache_set_raw failed for %s", key, exc_info=True)


async def cache_delete_pattern(pattern: str) -> None:
    r = await get_redis()
    async for key in r.scan_iter(match=pattern):
        await r.delete(key)
