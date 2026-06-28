import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Station(Base):
    __tablename__ = "stations"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False)
    party_id: Mapped[str] = mapped_column(String(3), nullable=False)
    location_id: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(String(512))
    city: Mapped[str | None] = mapped_column(String(128))
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    geom = mapped_column(Geography(geometry_type="POINT", srid=4326), nullable=False)
    operator_name: Mapped[str | None] = mapped_column(String(255))
    owner_name: Mapped[str | None] = mapped_column(String(255))
    parking_type: Mapped[str | None] = mapped_column(String(64))
    facilities: Mapped[list | None] = mapped_column(JSONB, default=list)
    publish: Mapped[bool] = mapped_column(Boolean, default=True)
    access_class: Mapped[str] = mapped_column(String(32), default="public")
    last_updated: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    evses: Mapped[list["Evse"]] = relationship(back_populates="station", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_stations_geom", "geom", postgresql_using="gist"),
        Index("ix_stations_operator", "operator_name"),
        Index("ix_stations_city", "city"),
    )


class Evse(Base):
    __tablename__ = "evses"

    id: Mapped[str] = mapped_column(String(160), primary_key=True)
    station_id: Mapped[str] = mapped_column(ForeignKey("stations.id", ondelete="CASCADE"))
    evse_uid: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="UNKNOWN")
    last_updated: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    station: Mapped["Station"] = relationship(back_populates="evses")
    connectors: Mapped[list["Connector"]] = relationship(
        back_populates="evse", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_evses_station_status", "station_id", "status"),)


class Connector(Base):
    __tablename__ = "connectors"

    id: Mapped[str] = mapped_column(String(200), primary_key=True)
    evse_id: Mapped[str] = mapped_column(ForeignKey("evses.id", ondelete="CASCADE"))
    station_id: Mapped[str] = mapped_column(ForeignKey("stations.id", ondelete="CASCADE"))
    connector_id: Mapped[str] = mapped_column(String(64), nullable=False)
    standard: Mapped[str | None] = mapped_column(String(64))
    max_power_kw: Mapped[float | None] = mapped_column(Float)
    tariff_ids: Mapped[list | None] = mapped_column(JSONB, default=list)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False)
    party_id: Mapped[str] = mapped_column(String(3), nullable=False)
    resolved_energy_price: Mapped[float | None] = mapped_column(Float)
    resolved_currency: Mapped[str | None] = mapped_column(String(3))

    evse: Mapped["Evse"] = relationship(back_populates="connectors")

    __table_args__ = (
        Index("ix_connectors_evse", "evse_id"),
        Index("ix_connectors_station", "station_id"),
        Index("ix_connectors_station_standard", "station_id", "standard"),
    )


class Tariff(Base):
    __tablename__ = "tariffs"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False)
    party_id: Mapped[str] = mapped_column(String(3), nullable=False)
    tariff_id: Mapped[str] = mapped_column(String(64), nullable=False)
    currency: Mapped[str | None] = mapped_column(String(3))
    last_updated: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    price_components: Mapped[list["TariffPriceComponent"]] = relationship(
        back_populates="tariff", cascade="all, delete-orphan"
    )
    restrictions: Mapped[list["TariffRestriction"]] = relationship(
        back_populates="tariff", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("country_code", "party_id", "tariff_id"),
        Index("ix_tariffs_key", "country_code", "party_id", "tariff_id"),
    )


class TariffPriceComponent(Base):
    __tablename__ = "tariff_price_components"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tariff_id: Mapped[str] = mapped_column(ForeignKey("tariffs.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    vat: Mapped[float | None] = mapped_column(Float)
    step_size: Mapped[float | None] = mapped_column(Float)

    tariff: Mapped["Tariff"] = relationship(back_populates="price_components")


class TariffRestriction(Base):
    __tablename__ = "tariff_restrictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tariff_id: Mapped[str] = mapped_column(ForeignKey("tariffs.id", ondelete="CASCADE"))
    start_time: Mapped[str | None] = mapped_column(String(8))
    end_time: Mapped[str | None] = mapped_column(String(8))
    day_of_week: Mapped[list | None] = mapped_column(JSONB)
    min_duration: Mapped[int | None] = mapped_column(Integer)
    max_duration: Mapped[int | None] = mapped_column(Integer)

    tariff: Mapped["Tariff"] = relationship(back_populates="restrictions")


class StatusDiff(Base):
    __tablename__ = "status_diffs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    evse_id: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    field: Mapped[str] = mapped_column(String(32), nullable=False)
    old_value: Mapped[str | None] = mapped_column(Text)
    new_value: Mapped[str | None] = mapped_column(Text)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class SyncRun(Base):
    __tablename__ = "sync_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dataset: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    records_processed: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)


class PartnerBooking(Base):
    __tablename__ = "partner_bookings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    partner_site_id: Mapped[str] = mapped_column(String(64), nullable=False)
    slot_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    slot_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    partner_price: Mapped[float | None] = mapped_column(Float)
    nearby_avg_price: Mapped[float | None] = mapped_column(Float)
    session_kwh: Mapped[float] = mapped_column(Float, default=40.0)
    session_savings: Mapped[float | None] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("email", "partner_site_id", "slot_start", name="uq_partner_booking_slot"),
        Index("ix_partner_bookings_site_slot", "partner_site_id", "slot_start"),
        Index("ix_partner_bookings_email", "email"),
    )
