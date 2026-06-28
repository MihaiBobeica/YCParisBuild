# NL EV Charging Assistant

Netherlands EV charging assistant built on [NDW DOT-NL](https://opendata.ndw.nu/) OCPI open data. Helps drivers find the best charging station based on availability, price, distance, charging speed, and connector type.

**All V1 features are free.** Optional Stripe subscriptions support development but unlock nothing.

## Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy, PostGIS, Redis
- **Frontend:** React 18, TypeScript, Vite, Leaflet (CartoDB Positron)
- **UI theme:** Pangea Charging-inspired (Mobbin references in `frontend/docs/ui-references.md`)

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/health
- API docs: http://localhost:8000/docs

### Seed sample data (without waiting for NDW sync)

```bash
docker compose exec backend alembic upgrade head
docker compose exec backend python scripts/seed_sample_data.py
```

### Run NDW sync manually

```bash
docker compose exec backend python -c "from app.services.ndw_sync import sync_locations, sync_tariffs; sync_tariffs(); sync_locations()"
```

## Local development (without Docker)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
alembic upgrade head
python scripts/seed_sample_data.py
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Stripe (optional)

1. Create products/prices in Stripe Dashboard ($20/mo, $200/yr)
2. Set env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`
3. Forward webhooks locally: `stripe listen --forward-to localhost:8000/api/billing/webhook`

Checkout is available at `/support`. No features are gated behind payment.

## Tests

```bash
cd backend
pytest
```

## Data disclaimer

- NDW prices may differ from your charging card tariff
- Unknown price/status is shown explicitly — never inferred
- `UNKNOWN` status does not mean available

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/stations` | Bbox query + filters |
| GET | `/api/stations/{id}` | Station detail |
| GET | `/api/search` | Text + geocode search |
| POST | `/api/recommendations` | 2–3 recommended chargers |
| GET | `/api/monitor` | Availability polling bundle |
| POST | `/api/billing/checkout` | Stripe Checkout |
