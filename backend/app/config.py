from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://evcharge:evcharge@localhost:5432/evcharge"
    database_url_sync: str = "postgresql://evcharge:evcharge@localhost:5432/evcharge"
    redis_url: str = "redis://localhost:6379/0"

    ndw_locations_url: str = "https://opendata.ndw.nu/charging_point_locations_ocpi.json.gz"
    ndw_tariffs_url: str = "https://opendata.ndw.nu/charging_point_tariffs_ocpi.json.gz"
    sync_locations_interval_min: int = 10
    sync_tariffs_interval_min: int = 45

    photon_url: str = "https://photon.komoot.io/api/"
    nominatim_url: str = "https://nominatim.openstreetmap.org/search"

    frontend_url: str = "http://localhost:5173"
    app_name: str = "NL EV Charging Assistant"
    tz: str = "Europe/Amsterdam"

    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_monthly: str = ""
    stripe_price_yearly: str = ""

    # NL bounds
    nl_min_lat: float = 50.75
    nl_max_lat: float = 53.70
    nl_min_lon: float = 3.20
    nl_max_lon: float = 7.30

    diff_retention_days: int = 7


settings = Settings()
