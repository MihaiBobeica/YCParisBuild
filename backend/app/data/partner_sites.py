"""Hardcoded partner charging sites.

Partner sites are manually onboarded locations that offer a discounted energy
price compared to nearby public chargers. They are not part of the NDW dataset;
they live here as a small static list until a proper partner backend exists.

Keep this list in sync with the frontend mirror at
``frontend/src/data/partnerSites.ts`` (same ids / coordinates).
"""
from __future__ import annotations

PARTNER_SITES: list[dict] = [
    {
        "id": "partner-asr-utrecht",
        "name": "a.s.r. headquarters",
        "address": "Archimedeslaan 10, 3584 BA Utrecht",
        "latitude": 52.081617,
        "longitude": 5.1337008,
        "energy_price": 0.20,
        "currency": "EUR",
        "max_power_kw": 22.0,
        "connector_types": ["IEC_62196_T2"],
        "total_slots": 50,
    },
]

PARTNER_SITES_BY_ID: dict[str, dict] = {s["id"]: s for s in PARTNER_SITES}


def get_partner_site(site_id: str) -> dict | None:
    return PARTNER_SITES_BY_ID.get(site_id)
