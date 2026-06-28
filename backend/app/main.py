import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.routes import router
from app.config import settings
from app.workers.sync_scheduler import start_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _run_migrations() -> None:
    """Apply Alembic migrations (sync; run in a worker thread at startup)."""
    backend_root = Path(__file__).resolve().parent.parent
    cfg = Config(str(backend_root / "alembic.ini"))
    command.upgrade(cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s", settings.app_name)
    try:
        await asyncio.to_thread(_run_migrations)
        logger.info("Database migrations applied")
    except Exception:
        logger.exception("Failed to apply database migrations on startup")
    start_scheduler()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
# Compress JSON responses (station/recommendation payloads can be large). Must be
# added before CORS so the gzip layer wraps the CORS-handled response.
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173", "http://localhost:80"],
    # Allow the paxor.ai custom domain (apex + subdomains) and Render-hosted
    # static frontends (*.onrender.com) without hardcoding generated URLs.
    allow_origin_regex=r"https://([a-z0-9-]+\.)*(onrender\.com|paxor\.ai)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
