import hashlib

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import stripe

from app.config import settings
from app.data.partner_sites import PARTNER_SITES, PARTNER_SITES_BY_ID, get_partner_site
from app.db.redis import cache_get, cache_set
from app.db.session import get_db
from app.models import Subscription
from app.schemas import BookingRequest, CheckoutRequest, PortalRequest, RecommendationRequest
from app.services import partner_bookings as partner_booking_service
from app.services.geocode import geocode_query
from app.services.recommendation import build_recommendations
from app.services.station_query import (
    fetch_alternatives,
    fetch_nearby,
    fetch_operators,
    fetch_station_detail,
    fetch_stations_in_bbox,
    search_stations_text,
)
from app.services.stripe_billing import create_checkout_session, create_portal_session
from app.services.stripe_webhooks import handle_webhook_event

router = APIRouter(prefix="/api")


@router.get("/health")
async def health():
    return {"status": "ok", "app": settings.app_name}


@router.get("/stations")
async def list_stations(
    min_lat: float = Query(...),
    min_lon: float = Query(...),
    max_lat: float = Query(...),
    max_lon: float = Query(...),
    origin_lat: float | None = None,
    origin_lon: float | None = None,
    availability: str | None = None,
    max_price: float | None = None,
    connector_type: str | None = None,
    min_kw: float | None = None,
    operator: str | None = None,
    parking_type: str | None = None,
    access_class: str | None = None,
    known_price_only: bool = False,
    map_limit: int = Query(250, ge=1, le=500),
    zoom: float | None = Query(None, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    zoom_int = int(round(zoom)) if zoom is not None else None
    cache_key = hashlib.md5(
        f"{min_lat}:{min_lon}:{max_lat}:{max_lon}:{availability}:{max_price}:{connector_type}:"
        f"{min_kw}:{operator}:{known_price_only}:{map_limit}:{zoom_int}".encode()
    ).hexdigest()
    cached = await cache_get(f"map:bbox:v3:{cache_key}")
    if cached:
        return cached

    filters = {
        "availability": availability,
        "max_price": max_price,
        "connector_type": connector_type,
        "min_kw": min_kw,
        "operator": operator,
        "parking_type": parking_type,
        "access_class": access_class,
        "known_price_only": known_price_only,
    }
    try:
        results = await fetch_stations_in_bbox(
            db, min_lat, min_lon, max_lat, max_lon, filters, origin_lat, origin_lon, map_limit, zoom_int
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    await cache_set(f"map:bbox:v3:{cache_key}", results, 180)
    return results


@router.get("/stations/{station_id}")
async def get_station(station_id: str, db: AsyncSession = Depends(get_db)):
    cached = await cache_get(f"station:{station_id}")
    if cached:
        return cached
    detail = await fetch_station_detail(db, station_id)
    if not detail:
        raise HTTPException(404, "Station not found")
    await cache_set(f"station:{station_id}", detail, 45)
    return detail


@router.get("/stations/{station_id}/alternatives")
async def get_alternatives(station_id: str, db: AsyncSession = Depends(get_db)):
    cached = await cache_get(f"backups:{station_id}")
    if cached:
        return cached
    alts = await fetch_alternatives(db, station_id)
    await cache_set(f"backups:{station_id}", alts, 60)
    return alts


@router.get("/search")
async def search(q: str = Query(..., min_length=2), db: AsyncSession = Depends(get_db)):
    geo = await geocode_query(q)
    db_results = await search_stations_text(db, q)
    return {"geocode": geo, "stations": db_results}


@router.get("/search/near")
async def search_near(
    lat: float = Query(...),
    lon: float = Query(...),
    radius_km: float = Query(10.0),
    db: AsyncSession = Depends(get_db),
):
    if not (
        settings.nl_min_lat <= lat <= settings.nl_max_lat
        and settings.nl_min_lon <= lon <= settings.nl_max_lon
    ):
        raise HTTPException(400, "Location must be within the Netherlands")
    return await fetch_nearby(db, lat, lon, radius_km)


@router.post("/recommendations")
async def recommendations(body: RecommendationRequest, db: AsyncSession = Depends(get_db)):
    connector_type = body.connector_type or (body.filters or {}).get("connector_type")
    stations = await fetch_nearby(
        db,
        body.origin_lat,
        body.origin_lon,
        body.radius_km,
        limit=100,
        connector_type=connector_type,
    )
    cards = build_recommendations(
        stations,
        body.origin_lat,
        body.origin_lon,
        body.radius_km,
        connector_type,
    )
    return cards


@router.get("/monitor")
async def monitor(
    ids: str = Query(..., description="Comma-separated station IDs"),
    db: AsyncSession = Depends(get_db),
):
    station_ids = [s.strip() for s in ids.split(",") if s.strip()]
    cache_key = f"monitor:{','.join(sorted(station_ids))}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    stations = []
    for sid in station_ids:
        detail = await fetch_station_detail(db, sid)
        if detail:
            stations.append({
                "id": detail["id"],
                "name": detail.get("name"),
                "statuses": detail.get("statuses"),
                "availability_label": detail.get("availability_label"),
                "pin_color": detail.get("pin_color"),
                "energy_price": detail.get("energy_price"),
                "latitude": detail["latitude"],
                "longitude": detail["longitude"],
            })

    best_alternative = None
    if station_ids:
        alts = await fetch_alternatives(db, station_ids[0])
        degraded = {"CHARGING", "RESERVED", "OUTOFORDER", "INOPERATIVE", "UNKNOWN"}
        primary = stations[0] if stations else None
        if primary and any(s in degraded for s in (primary.get("statuses") or [])):
            available = [a for a in alts if a.get("pin_color") == "green"]
            best_alternative = available[0] if available else (alts[0] if alts else None)

    result = {"stations": stations, "best_alternative": best_alternative}
    await cache_set(cache_key, result, 45)
    return result


@router.get("/filters/operators")
async def operators(db: AsyncSession = Depends(get_db)):
    return await fetch_operators(db)


@router.get("/partner-sites")
async def partner_sites():
    return PARTNER_SITES


@router.get("/partner-sites/{site_id}/availability")
async def partner_site_availability(site_id: str, db: AsyncSession = Depends(get_db)):
    site = get_partner_site(site_id)
    if not site:
        raise HTTPException(404, "Partner site not found")
    return await partner_booking_service.slot_availability(db, site)


@router.post("/partner-bookings")
async def create_partner_bookings(body: BookingRequest, db: AsyncSession = Depends(get_db)):
    site = get_partner_site(body.partner_site_id)
    if not site:
        raise HTTPException(404, "Partner site not found")
    slots = [(s.start, s.end) for s in body.slots]
    try:
        created = await partner_booking_service.create_bookings(db, body.email, site, slots)
    except partner_booking_service.CapacityError as e:
        raise HTTPException(409, str(e))
    return [partner_booking_service.booking_to_dict(b, site["name"]) for b in created]


@router.get("/partner-bookings")
async def get_partner_bookings(email: str = Query(...), db: AsyncSession = Depends(get_db)):
    bookings = await partner_booking_service.list_bookings(db, email)
    return [
        partner_booking_service.booking_to_dict(
            b, PARTNER_SITES_BY_ID.get(b.partner_site_id, {}).get("name")
        )
        for b in bookings
    ]


@router.delete("/partner-bookings/{booking_id}")
async def delete_partner_booking(
    booking_id: str, email: str = Query(...), db: AsyncSession = Depends(get_db)
):
    ok = await partner_booking_service.cancel_booking(db, booking_id, email)
    if not ok:
        raise HTTPException(404, "Booking not found")
    return {"ok": True}


@router.get("/partner-bookings/savings")
async def get_partner_savings(email: str = Query(...), db: AsyncSession = Depends(get_db)):
    total, count, year = await partner_booking_service.savings_ytd(db, email)
    return {"ytd_savings": total, "currency": "EUR", "bookings_count": count, "year": year}


@router.post("/billing/checkout")
async def billing_checkout(body: CheckoutRequest):
    try:
        url = create_checkout_session(body.plan, body.email)
        return {"url": url}
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@router.post("/billing/portal")
async def billing_portal(body: PortalRequest, db: AsyncSession = Depends(get_db)):
    sub = await db.scalar(select(Subscription).where(Subscription.email == body.email))
    if not sub or not sub.stripe_customer_id:
        raise HTTPException(404, "No subscription found for this email")
    try:
        url = create_portal_session(sub.stripe_customer_id)
        return {"url": url}
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@router.get("/billing/status")
async def billing_status(email: str = Query(...), db: AsyncSession = Depends(get_db)):
    sub = await db.scalar(select(Subscription).where(Subscription.email == email))
    if not sub:
        return {"status": "none", "plan": "none"}
    return {
        "status": sub.status,
        "plan": sub.plan,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
    }


@router.post("/billing/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    if not settings.stripe_webhook_secret:
        raise HTTPException(503, "Webhook secret not configured")
    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        raise HTTPException(400, str(e))
    await handle_webhook_event(db, event)
    return {"received": True}
