import pytest

from app.services.ndw_parser import make_tariff_id, parse_location, parse_tariff
from app.services.pin_status import aggregate_pin_color, availability_summary
from app.services.pricing import is_valid_energy_price
from app.services.recommendation import build_recommendations, haversine_km
from app.services.station_query import _connector_price_from_map, _station_summary
from app.services.tariff_join import resolve_connector_price


SAMPLE_LOCATION = {
    "country_code": "NL",
    "party_id": "ABC",
    "id": "LOC001",
    "name": "Test Station",
    "address": "Damrak 1",
    "city": "Amsterdam",
    "coordinates": {"latitude": "52.3676", "longitude": "4.9041"},
    "operator": {"name": "Test Operator"},
    "publish": True,
    "last_updated": "2024-01-15T10:00:00Z",
    "evses": [
        {
            "uid": "EVSE1",
            "status": "AVAILABLE",
            "last_updated": "2024-01-15T10:00:00Z",
            "connectors": [
                {
                    "id": "1",
                    "standard": "IEC_62196_T2_COMBO",
                    "max_electric_power": 50000,
                    "tariff_ids": ["T1"],
                }
            ],
        }
    ],
}

SAMPLE_TARIFF = {
    "country_code": "NL",
    "party_id": "ABC",
    "id": "T1",
    "currency": "EUR",
    "last_updated": "2024-01-15T10:00:00Z",
    "elements": [
        {
            "price_components": [{"type": "ENERGY", "price": 0.42, "vat": 21.0}],
            "restrictions": {},
        }
    ],
}


def test_parse_location():
    loc = parse_location(SAMPLE_LOCATION)
    assert loc is not None
    assert loc["id"] == "NL:ABC:LOC001"
    assert loc["city"] == "Amsterdam"
    assert len(loc["evses"]) == 1
    assert loc["evses"][0]["status"] == "AVAILABLE"


def test_parse_tariff():
    t = parse_tariff(SAMPLE_TARIFF)
    assert t is not None
    assert t["id"] == "NL:ABC:T1"
    assert t["price_components"][0]["type"] == "ENERGY"


def test_tariff_join():
    connector = {
        "tariff_ids": ["T1"],
        "country_code": "NL",
        "party_id": "ABC",
    }
    tariffs = {
        make_tariff_id("NL", "ABC", "T1"): {
            "currency": "EUR",
            "price_components": [{"type": "ENERGY", "price": 0.42}],
            "restrictions": [],
        }
    }
    price, currency, matched = resolve_connector_price(connector, tariffs)
    assert price == 0.42
    assert currency == "EUR"
    assert matched is True


def test_is_valid_energy_price():
    assert not is_valid_energy_price(None)
    assert not is_valid_energy_price(0)
    assert not is_valid_energy_price(0.0)
    assert not is_valid_energy_price(0.004)
    assert is_valid_energy_price(0.42)
    assert is_valid_energy_price(0.01)


def test_resolve_connector_price_rejects_zero():
    connector = {
        "tariff_ids": ["T1"],
        "country_code": "NL",
        "party_id": "ABC",
    }
    tariffs = {
        make_tariff_id("NL", "ABC", "T1"): {
            "currency": "EUR",
            "price_components": [{"type": "ENERGY", "price": 0}],
            "restrictions": [],
        }
    }
    price, currency, matched = resolve_connector_price(connector, tariffs)
    assert price is None
    assert currency is None
    assert matched is True


def test_parse_tariff_missing_price():
    t = parse_tariff({
        "country_code": "NL",
        "party_id": "ABC",
        "id": "T2",
        "currency": "EUR",
        "last_updated": "2024-01-15T10:00:00Z",
        "elements": [{"price_components": [{"type": "ENERGY", "vat": 21.0}], "restrictions": {}}],
    })
    assert t is not None
    assert t["price_components"][0]["price"] is None


def test_connector_price_from_map_rejects_cached_zero():
    from unittest.mock import MagicMock

    conn = MagicMock()
    conn.resolved_energy_price = 0.0
    conn.resolved_currency = "EUR"
    conn.tariff_ids = []
    price, currency = _connector_price_from_map(conn, {})
    assert price is None
    assert currency is None


def test_station_summary_excludes_zero_prices():
    from datetime import datetime, timezone
    from unittest.mock import MagicMock

    conn = MagicMock()
    conn.resolved_energy_price = 0.0
    conn.resolved_currency = "EUR"
    conn.tariff_ids = []
    conn.standard = "IEC_62196_T2"
    conn.max_power_kw = 50.0
    evse = MagicMock()
    evse.status = "AVAILABLE"
    evse.connectors = [conn]
    evse.last_updated = datetime(2024, 1, 15, tzinfo=timezone.utc)
    station = MagicMock()
    station.id = "NL:ABC:LOC001"
    station.name = "Zero Price"
    station.address = "Test 1"
    station.city = "Amsterdam"
    station.latitude = 52.37
    station.longitude = 4.90
    station.operator_name = "Op"
    station.owner_name = None
    station.parking_type = None
    station.facilities = []
    station.access_class = "public"
    station.last_updated = datetime(2024, 1, 15, tzinfo=timezone.utc)
    station.evses = [evse]

    summary = _station_summary(station)
    assert summary is not None
    assert not is_valid_energy_price(summary["energy_price"])


def test_purge_priceless_stations_removes_zero_prices():
    from unittest.mock import MagicMock, patch

    from app.services.ndw_sync import purge_priceless_stations

    session = MagicMock()
    station_delete = MagicMock(rowcount=2)
    session.execute = MagicMock(side_effect=[MagicMock(), MagicMock(), station_delete])
    session.commit = MagicMock()

    with patch("app.services.ndw_sync.SyncSession") as sync_session:
        sync_session.return_value.__enter__ = MagicMock(return_value=session)
        sync_session.return_value.__exit__ = MagicMock(return_value=False)
        removed = purge_priceless_stations()

    assert removed == 2
    assert session.execute.call_count == 3
    session.commit.assert_called_once()


def test_pin_color_green():
    assert aggregate_pin_color(["AVAILABLE"]) == "green"


def test_pin_color_red():
    assert aggregate_pin_color(["CHARGING", "CHARGING"]) == "red"


def test_availability_summary():
    assert "Available" in availability_summary(["AVAILABLE", "CHARGING"])


def test_haversine():
    d = haversine_km(52.3676, 4.9041, 52.0907, 5.1214)
    assert 30 < d < 45


def test_recommendations():
    stations = [
        {
            "id": "s1",
            "name": "A",
            "latitude": 52.37,
            "longitude": 4.90,
            "statuses": ["AVAILABLE"],
            "energy_price": 0.50,
            "currency": "EUR",
            "max_power_kw": 50,
            "connector_types": ["IEC_62196_T2_COMBO"],
            "availability_label": "Available (1/1)",
            "pin_color": "green",
        },
        {
            "id": "s2",
            "name": "B",
            "latitude": 52.38,
            "longitude": 4.91,
            "statuses": ["AVAILABLE"],
            "energy_price": 0.35,
            "currency": "EUR",
            "max_power_kw": 22,
            "connector_types": ["IEC_62196_T2"],
            "availability_label": "Available (1/1)",
            "pin_color": "green",
        },
    ]
    recs = build_recommendations(stations, 52.36, 4.89)
    assert len(recs) >= 2
    types = {r["type"] for r in recs}
    assert "best_overall" in types
    assert types & {"cheapest", "fastest"}


def test_select_map_pins_respects_limit():
    from app.services.spatial import select_map_pins

    stations = [
        {"id": f"s{i}", "latitude": 52.0 + (i % 20) * 0.01, "longitude": 4.0 + (i // 20) * 0.01, "pin_color": "green"}
        for i in range(200)
    ]
    picked = select_map_pins(stations, 40, 52.0, 4.0, 52.2, 4.2, zoom=11)
    assert len(picked) == 40
    assert len({s["id"] for s in picked}) == 40


def test_select_map_pins_stable_across_bbox_shift():
    from app.services.spatial import select_map_pins

    stations = [
        {
            "id": f"s{i}",
            "latitude": 51.9 + (i % 30) * 0.008,
            "longitude": 4.4 + (i // 30) * 0.008,
            "pin_color": "green" if i % 3 == 0 else "red",
        }
        for i in range(300)
    ]
    bbox_a = select_map_pins(stations, 50, 51.9, 4.4, 52.15, 4.65, zoom=12)
    bbox_b = select_map_pins(stations, 50, 51.92, 4.42, 52.17, 4.67, zoom=12)
    ids_a = {s["id"] for s in bbox_a}
    ids_b = {s["id"] for s in bbox_b}
    overlap = len(ids_a & ids_b)
    assert overlap >= len(ids_a) * 0.65


def test_map_limit_for_zoom():
    from app.services.spatial import map_limit_for_zoom

    assert map_limit_for_zoom(8) == 45
    assert map_limit_for_zoom(13) == 170
    assert map_limit_for_zoom(15) == 240
    assert map_limit_for_zoom(16) == 320


def test_compute_session_savings():
    from app.services.partner_bookings import compute_session_savings

    # Partner cheaper than nearby average: 40 kWh * (0.41 - 0.20) = 8.40
    assert compute_session_savings(0.41, 0.20, 40) == 8.40
    # No nearby average known -> savings unknown
    assert compute_session_savings(None, 0.20, 40) is None
    # Partner not cheaper -> clamped to zero
    assert compute_session_savings(0.15, 0.20, 40) == 0.0


def test_generate_slots_shape():
    from datetime import datetime, timezone

    from app.services.partner_bookings import (
        BLOCK_HOURS,
        DAY_END_HOUR,
        DAY_START_HOUR,
        generate_slots,
    )

    # Anchor before the booking window so all blocks for the day are returned.
    now = datetime(2026, 6, 1, 0, 0, tzinfo=timezone.utc)
    slots = generate_slots(now)
    assert len(slots) > 0
    blocks_per_day = (DAY_END_HOUR - DAY_START_HOUR) // BLOCK_HOURS
    assert len(slots) == blocks_per_day * 3  # 3 days, no past blocks dropped
    for start, end in slots:
        assert (end - start).total_seconds() == BLOCK_HOURS * 3600
        assert start < end


async def test_slot_availability_full_grid_when_no_bookings():
    from unittest.mock import AsyncMock, MagicMock

    from app.services.partner_bookings import slot_availability

    result = MagicMock()
    result.all = MagicMock(return_value=[])
    session = MagicMock()
    session.execute = AsyncMock(return_value=result)

    site = {"id": "partner-asr-utrecht", "total_slots": 50}
    out = await slot_availability(session, site)

    assert len(out) > 0
    assert all(s["remaining"] == 50 and s["booked"] == 0 for s in out)


async def test_slot_availability_resilient_to_missing_table():
    from unittest.mock import AsyncMock, MagicMock

    from sqlalchemy.exc import ProgrammingError

    from app.services.partner_bookings import slot_availability

    session = MagicMock()
    session.execute = AsyncMock(side_effect=ProgrammingError("stmt", {}, Exception("no table")))
    session.rollback = AsyncMock()

    site = {"id": "partner-asr-utrecht", "total_slots": 50}
    out = await slot_availability(session, site)

    # Missing partner_bookings table must degrade to a full free grid, not empty.
    assert len(out) > 0
    assert all(s["remaining"] == 50 for s in out)
    session.rollback.assert_awaited()


async def test_create_bookings_skips_duplicate_without_dropping_siblings():
    from datetime import datetime, timezone
    from unittest.mock import AsyncMock, MagicMock, patch

    from sqlalchemy.exc import IntegrityError

    from app.services.partner_bookings import create_bookings

    site = {
        "id": "partner-asr-utrecht",
        "energy_price": 0.20,
        "currency": "EUR",
        "total_slots": 50,
        "latitude": 52.0,
        "longitude": 5.0,
        "connector_types": ["IEC_62196_T2"],
        "max_power_kw": 41.0,
    }
    slots = [
        (datetime(2026, 7, 1, 8, tzinfo=timezone.utc), datetime(2026, 7, 1, 10, tzinfo=timezone.utc)),
        (datetime(2026, 7, 1, 10, tzinfo=timezone.utc), datetime(2026, 7, 1, 12, tzinfo=timezone.utc)),
    ]

    session = MagicMock()
    session.scalar = AsyncMock(return_value=0)
    session.commit = AsyncMock()
    session.add = MagicMock()

    attempt = 0

    class NestedCM:
        async def __aenter__(self):
            nonlocal attempt
            attempt += 1
            if attempt == 2:
                raise IntegrityError("stmt", {}, Exception("duplicate slot"))
            return None

        async def __aexit__(self, *args):
            return False

    session.begin_nested = MagicMock(return_value=NestedCM())

    with patch(
        "app.services.partner_bookings.compute_nearby_avg_price",
        new=AsyncMock(return_value=0.41),
    ):
        created = await create_bookings(session, "test@example.com", site, slots)

    assert len(created) == 1
    session.commit.assert_awaited_once()


def test_generate_slots_drops_past_blocks():
    from datetime import datetime, timezone

    from app.services.partner_bookings import generate_slots

    early = generate_slots(datetime(2026, 6, 1, 0, 0, tzinfo=timezone.utc))
    # Anchoring later in the first day must yield fewer total slots.
    late = generate_slots(datetime(2026, 6, 1, 18, 0, tzinfo=timezone.utc))
    assert len(late) < len(early)

