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
