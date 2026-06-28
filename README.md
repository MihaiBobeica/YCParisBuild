# paxor

Netherlands EV charging assistant built on [NDW DOT-NL](https://opendata.ndw.nu/) OCPI open data. Helps drivers find the best charging station based on availability, price, distance, charging speed, and connector type — plus discounted partner sites you can reserve.

**All V1 features are free.** Optional Stripe subscriptions support development but unlock nothing.

## Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy, PostGIS, Redis
- **Frontend:** React 18, TypeScript, Vite, Leaflet (CartoDB Positron)
- **UI theme:** iOS-inspired (Mobbin references in `frontend/docs/ui-references.md`)

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
| GET | `/api/partner-sites` | Discounted partner charging sites |
| GET | `/api/partner-sites/{id}/availability` | Remaining capacity per 2h block (next 3 days) |
| POST | `/api/partner-bookings` | Reserve one or more 2h slots |
| GET | `/api/partner-bookings?email=` | List a user's bookings |
| DELETE | `/api/partner-bookings/{id}?email=` | Cancel a booking |
| GET | `/api/partner-bookings/savings?email=` | Calendar-YTD savings vs public rates |

## Partner sites & savings

paxor surfaces a small set of manually onboarded **partner sites** (gold pulsing
pins) that offer a discounted €/kWh rate. Tap one to reserve a 2-hour charging
block; the backend snapshots the average price of nearby public chargers of a
comparable service (same connector, similar power, within 2 km) and records how
much each session saves. Your Account shows the running calendar-year total.

Partner data lives in `backend/app/data/partner_sites.py` (mirror:
`frontend/src/data/partnerSites.ts`). Bookings are persisted in the
`partner_bookings` table; a profile email is the user identity until auth lands.

## Deploy to Render

This repo ships a [`render.yaml`](render.yaml) Blueprint that provisions the full
stack: managed Postgres (with PostGIS), a Key Value (Redis) instance, the
Dockerized FastAPI backend, and the static frontend.

1. Push this repo to GitHub/GitLab.
2. In Render: **New → Blueprint**, select the repo. Render reads `render.yaml`.
3. Set the backend secrets (marked `sync: false`) in the dashboard if you use
   Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`,
   `STRIPE_PRICE_YEARLY`. They can stay blank — billing is optional.
4. Click **Apply**. On first deploy the backend `preDeployCommand`
   (`alembic upgrade head`) creates the schema and the PostGIS extension.
5. (Optional) seed sample stations with a one-off shell on the backend service:
   `python scripts/seed_sample_data.py`. Otherwise the APScheduler job syncs NDW
   data in the background.

**Wiring notes**

- `DATABASE_URL` comes from the managed DB; `config.py` normalizes it into the
  async (app) and sync (Alembic) URLs automatically.
- `VITE_API_URL` is wired to the backend host; the API client prepends `https://`
  when the value is a bare host.
- CORS allows `*.onrender.com`, so the static site works without hardcoding its
  generated URL.
- The free Postgres plan expires after ~30 days — upgrade the plan for anything
  beyond a demo. APScheduler runs in-process on the single backend instance; if
  you scale out, designate a single scheduler owner.
