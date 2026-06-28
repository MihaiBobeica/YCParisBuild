"""Tiny bounded in-process TTL cache for hot, already-serialized payloads.

The map-pin endpoint is dominated by a small set of popular viewports (e.g.
central Amsterdam) requested over and over. Redis already caches those, but each
hit still pays a network round-trip plus a JSON decode. This module keeps the
last few raw JSON strings in process so the hottest viewports are served with no
I/O and no deserialization at all.

It is deliberately minimal and memory-bounded for the 1-CPU / 2GB production box:
- values are raw ``str`` (no Python object graphs retained),
- a hard cap on entry count with LRU eviction,
- a short TTL so it can never serve staler data than the Redis layer behind it.

All operations are synchronous and atomic within the asyncio event loop (no
``await`` between read/check/write), so no lock is needed for the single-worker
deployment.
"""

import time
from collections import OrderedDict

# ~200 entries × ~50KB max raw payload ≈ 10MB worst case — safe on a 2GB box.
_MAX_ENTRIES = 200

# (expires_at_monotonic, raw_json) keyed by cache key, ordered by recency.
_store: "OrderedDict[str, tuple[float, str]]" = OrderedDict()


def get(key: str) -> str | None:
    """Return the cached raw JSON for ``key`` if present and unexpired."""
    item = _store.get(key)
    if item is None:
        return None
    expires_at, raw = item
    if expires_at < time.monotonic():
        _store.pop(key, None)
        return None
    _store.move_to_end(key)
    return raw


def set(key: str, raw: str, ttl: int) -> None:
    """Cache ``raw`` under ``key`` for ``ttl`` seconds, evicting LRU if full."""
    _store[key] = (time.monotonic() + ttl, raw)
    _store.move_to_end(key)
    while len(_store) > _MAX_ENTRIES:
        _store.popitem(last=False)


def clear() -> None:
    _store.clear()
