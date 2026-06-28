"""Partner site bookings: slot generation, capacity, savings vs public chargers.

Savings are computed against the *average* energy price of nearby public
chargers offering a similar service (same connector, similar power) at booking
time, and snapshotted on the booking so historical numbers stay stable.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import PartnerBooking
from app.services.station_query import fetch_nearby

# Booking grid: 2-hour blocks between 06:00 and 22:00, for the next 3 days.
DAY_START_HOUR = 6
DAY_END_HOUR = 22
BLOCK_HOURS = 2
BOOKING_DAYS = 3
SESSION_KWH = 40.0
NEARBY_RADIUS_KM = 2.0
POWER_TOLERANCE = 0.2


def _tz() -> ZoneInfo:
    try:
        return ZoneInfo(settings.tz)
    except Exception:
        return ZoneInfo("UTC")


def generate_slots(now: datetime | None = None) -> list[tuple[datetime, datetime]]:
    """Canonical list of bookable (start, end) blocks. Past blocks are dropped."""
    tz = _tz()
    now_local = (now or datetime.now(timezone.utc)).astimezone(tz)
    slots: list[tuple[datetime, datetime]] = []
    for d in range(BOOKING_DAYS):
        day = (now_local + timedelta(days=d)).date()
        for hour in range(DAY_START_HOUR, DAY_END_HOUR, BLOCK_HOURS):
            start = datetime(day.year, day.month, day.day, hour, tzinfo=tz)
            end = start + timedelta(hours=BLOCK_HOURS)
            if end <= now_local:
                continue
            slots.append((start, end))
    return slots


async def compute_nearby_avg_price(
    session: AsyncSession,
    lat: float,
    lon: float,
    connector_type: str | None = None,
    target_kw: float | None = None,
    radius_km: float = NEARBY_RADIUS_KM,
) -> float | None:
    """Average €/kWh of nearby public chargers with a comparable service."""
    nearby = await fetch_nearby(
        session, lat, lon, radius_km=radius_km, limit=100, connector_type=connector_type
    )

    def known_public(s: dict) -> bool:
        return (
            s.get("access_class") == "public"
            and s.get("energy_price") is not None
            and s.get("energy_price", 0) > 0
        )

    candidates = [s for s in nearby if known_public(s)]
    if not candidates:
        return None

    # Prefer chargers within +/-20% of the partner power; fall back to all
    # connector-matched public chargers if the power band is empty.
    if target_kw:
        lo, hi = target_kw * (1 - POWER_TOLERANCE), target_kw * (1 + POWER_TOLERANCE)
        power_matched = [
            s for s in candidates if s.get("max_power_kw") and lo <= s["max_power_kw"] <= hi
        ]
        if power_matched:
            candidates = power_matched

    prices = [s["energy_price"] for s in candidates if s.get("energy_price") is not None]
    if not prices:
        return None
    return round(sum(prices) / len(prices), 4)


def compute_session_savings(
    nearby_avg: float | None,
    partner_price: float,
    session_kwh: float = SESSION_KWH,
) -> float | None:
    """€ saved for one session vs the nearby public average (never negative)."""
    if nearby_avg is None:
        return None
    return round(max(0.0, nearby_avg - partner_price) * session_kwh, 2)


async def slot_availability(session: AsyncSession, site: dict) -> list[dict]:
    """Remaining capacity per upcoming block for a partner site."""
    slots = generate_slots()
    if not slots:
        return []

    window_start = slots[0][0]
    window_end = slots[-1][1]
    # The booked-count query can fail if migration 003 hasn't been applied yet
    # (partner_bookings table missing). Degrade gracefully so the site always
    # shows its full grid (every block free) instead of an empty "no slots".
    try:
        rows = (
            await session.execute(
                select(PartnerBooking.slot_start, func.count())
                .where(
                    PartnerBooking.partner_site_id == site["id"],
                    PartnerBooking.slot_start >= window_start,
                    PartnerBooking.slot_start < window_end,
                )
                .group_by(PartnerBooking.slot_start)
            )
        ).all()
        booked_by_start = {_as_utc(r[0]): r[1] for r in rows}
    except SQLAlchemyError:
        await session.rollback()
        booked_by_start = {}

    total = int(site.get("total_slots", 0))
    out: list[dict] = []
    for start, end in slots:
        booked = booked_by_start.get(_as_utc(start), 0)
        out.append(
            {
                "slot_start": start,
                "slot_end": end,
                "total_slots": total,
                "booked": booked,
                "remaining": max(0, total - booked),
            }
        )
    return out


async def create_bookings(
    session: AsyncSession,
    email: str,
    site: dict,
    slots: list[tuple[datetime, datetime]],
) -> list[PartnerBooking]:
    """Create one booking per slot, enforcing per-block capacity."""
    partner_price = float(site["energy_price"])
    currency = site.get("currency", "EUR")
    total = int(site.get("total_slots", 0))

    nearby_avg = await compute_nearby_avg_price(
        session,
        site["latitude"],
        site["longitude"],
        connector_type=(site.get("connector_types") or [None])[0],
        target_kw=site.get("max_power_kw"),
    )
    savings_per_session = compute_session_savings(nearby_avg, partner_price)

    created: list[PartnerBooking] = []
    for start, end in slots:
        start_utc = _as_utc(start)
        booked = await session.scalar(
            select(func.count())
            .select_from(PartnerBooking)
            .where(
                PartnerBooking.partner_site_id == site["id"],
                PartnerBooking.slot_start == start_utc,
            )
        )
        if booked is not None and booked >= total:
            raise CapacityError(start)

        booking = PartnerBooking(
            id=uuid.uuid4(),
            email=email,
            partner_site_id=site["id"],
            slot_start=start_utc,
            slot_end=_as_utc(end),
            partner_price=partner_price,
            nearby_avg_price=nearby_avg,
            session_kwh=SESSION_KWH,
            session_savings=savings_per_session,
            currency=currency,
        )
        try:
            async with session.begin_nested():
                session.add(booking)
            created.append(booking)
        except IntegrityError:
            # Same email already holds this slot; skip without rolling back siblings.
            continue

    await session.commit()
    return created


async def list_bookings(session: AsyncSession, email: str) -> list[PartnerBooking]:
    rows = (
        await session.scalars(
            select(PartnerBooking)
            .where(PartnerBooking.email == email)
            .order_by(PartnerBooking.slot_start.desc())
        )
    ).all()
    return list(rows)


async def cancel_booking(session: AsyncSession, booking_id: str, email: str) -> bool:
    try:
        bid = uuid.UUID(booking_id)
    except ValueError:
        return False
    result = await session.execute(
        delete(PartnerBooking).where(
            PartnerBooking.id == bid, PartnerBooking.email == email
        )
    )
    await session.commit()
    return result.rowcount > 0


async def savings_ytd(session: AsyncSession, email: str) -> tuple[float, int, int]:
    """Sum of session savings for bookings whose slot falls in the current year."""
    year = datetime.now(_tz()).year
    year_start = datetime(year, 1, 1, tzinfo=_tz())
    year_end = datetime(year + 1, 1, 1, tzinfo=_tz())
    rows = (
        await session.execute(
            select(
                func.coalesce(func.sum(PartnerBooking.session_savings), 0.0),
                func.count(),
            ).where(
                PartnerBooking.email == email,
                PartnerBooking.slot_start >= year_start,
                PartnerBooking.slot_start < year_end,
            )
        )
    ).one()
    total = round(float(rows[0] or 0.0), 2)
    return total, int(rows[1] or 0), year


def booking_to_dict(b: PartnerBooking, site_name: str | None = None) -> dict:
    return {
        "id": str(b.id),
        "partner_site_id": b.partner_site_id,
        "partner_site_name": site_name,
        "slot_start": b.slot_start,
        "slot_end": b.slot_end,
        "partner_price": b.partner_price,
        "nearby_avg_price": b.nearby_avg_price,
        "session_kwh": b.session_kwh,
        "session_savings": b.session_savings,
        "currency": b.currency,
        "created_at": b.created_at,
    }


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class CapacityError(Exception):
    def __init__(self, slot_start: datetime):
        self.slot_start = slot_start
        super().__init__(f"Slot {slot_start.isoformat()} is fully booked")
