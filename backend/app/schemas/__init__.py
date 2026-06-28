from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class StationPin(BaseModel):
    id: str
    name: str | None
    latitude: float
    longitude: float
    operator: str | None = None
    energy_price: float | None = None
    currency: str | None = None
    max_power_kw: float | None = None
    connector_types: list[str] = []
    availability_label: str
    pin_color: str
    distance_km: float | None = None


class RecommendationCard(BaseModel):
    station_id: str
    type: str
    name: str | None
    distance_km: float
    travel_minutes: int
    availability: str | None
    energy_price: float | None
    currency: str | None
    max_power_kw: float | None
    connector_types: list[str]
    pin_color: str | None
    reason: str
    latitude: float
    longitude: float


class RecommendationRequest(BaseModel):
    origin_lat: float
    origin_lon: float
    radius_km: float = 15.0
    connector_type: str | None = None
    filters: dict[str, Any] = Field(default_factory=dict)


class CheckoutRequest(BaseModel):
    plan: str = Field(pattern="^(monthly|yearly)$")
    email: str | None = None


class PortalRequest(BaseModel):
    email: str


class MonitorResponse(BaseModel):
    stations: list[dict[str, Any]]
    best_alternative: dict[str, Any] | None = None


class PartnerSite(BaseModel):
    id: str
    name: str
    address: str
    latitude: float
    longitude: float
    energy_price: float
    currency: str = "EUR"
    max_power_kw: float
    connector_types: list[str] = []
    total_slots: int


class BookingSlot(BaseModel):
    start: datetime
    end: datetime


class BookingRequest(BaseModel):
    email: str = Field(min_length=3)
    partner_site_id: str
    slots: list[BookingSlot] = Field(min_length=1)


class BookingOut(BaseModel):
    id: str
    partner_site_id: str
    partner_site_name: str | None = None
    slot_start: datetime
    slot_end: datetime
    partner_price: float | None = None
    nearby_avg_price: float | None = None
    session_kwh: float
    session_savings: float | None = None
    currency: str = "EUR"
    created_at: datetime


class SlotAvailability(BaseModel):
    slot_start: datetime
    slot_end: datetime
    total_slots: int
    booked: int
    remaining: int


class SavingsSummary(BaseModel):
    ytd_savings: float
    currency: str = "EUR"
    bookings_count: int
    year: int
