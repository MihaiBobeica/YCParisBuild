from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://evcharge:evcharge@localhost:5432/evcharge"
    database_url_sync: str = "postgresql://evcharge:evcharge@localhost:5432/evcharge"
    redis_url: str = "redis://localhost:6379/0"

    @model_validator(mode="after")
    def _normalize_database_urls(self):
        """Accept a single managed `DATABASE_URL` (e.g. Render's `postgres://…`)
        and derive both the async (app) and sync (Alembic) URLs from it."""
        url = self.database_url
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        # asyncpg cannot parse libpq's `sslmode` query arg; drop it for the
        # async engine (Render's internal connection string omits it anyway).
        if url.startswith("postgresql://"):
            async_url = "postgresql+asyncpg://" + url[len("postgresql://") :]
        else:
            async_url = url
        self.database_url = async_url
        self.database_url_sync = async_url.replace("postgresql+asyncpg://", "postgresql://")
        return self

    ndw_locations_url: str = "https://opendata.ndw.nu/charging_point_locations_ocpi.json.gz"
    ndw_tariffs_url: str = "https://opendata.ndw.nu/charging_point_tariffs_ocpi.json.gz"
    sync_locations_interval_min: int = 15
    sync_tariffs_interval_min: int = 45

    photon_url: str = "https://photon.komoot.io/api/"
    nominatim_url: str = "https://nominatim.openstreetmap.org/search"

    frontend_url: str = "http://localhost:5173"
    app_name: str = "paxor"
    tz: str = "Europe/Amsterdam"

    # Shared secret guarding the manual sync admin endpoints. Empty = disabled.
    admin_sync_token: str = ""

    # NL bounds
    nl_min_lat: float = 50.75
    nl_max_lat: float = 53.70
    nl_min_lon: float = 3.20
    nl_max_lon: float = 7.30

    diff_retention_days: int = 7


settings = Settings()
