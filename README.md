# paxor

Netherlands EV charging assistant built on [NDW DOT-NL](https://opendata.ndw.nu/) OCPI open data. Find the best charging station by availability, price, distance, speed, and connector type — plus discounted partner sites you can reserve. **All V1 features are free.**

## Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy, PostGIS, Redis
- **Frontend:** React 18, TypeScript, Vite, Leaflet (CartoDB Positron)

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:8000/api/health · docs: http://localhost:8000/docs

Seed sample data without waiting for the NDW sync:

```bash
docker compose exec backend alembic upgrade head
docker compose exec backend python scripts/seed_sample_data.py
```

## Local dev (no Docker)

```bash
# backend
cd backend && pip install -r requirements.txt
alembic upgrade head && uvicorn app.main:app --reload

# frontend
cd frontend && npm install && npm run dev
```

Run tests with `cd backend && pytest`.

## API

- `GET /api/health` — health check
- `GET /api/stations` · `GET /api/stations/{id}` — bbox query + filters / detail
- `GET /api/search` — text + geocode search
- `POST /api/recommendations` — 2–3 recommended chargers
- `GET /api/partner-sites` · `GET /api/partner-sites/{id}/availability` — discounted sites + capacity
- `POST|GET|DELETE /api/partner-bookings` — reserve, list, cancel 2h slots
- `GET /api/partner-bookings/savings` — calendar-YTD savings vs public rates

## Notes

- Partner sites (gold pins) offer a discounted €/kWh rate; reserving a 2h block snapshots nearby public rates to track savings. Data lives in `backend/app/data/partner_sites.py` (mirror: `frontend/src/data/partnerSites.ts`).
- NDW prices may differ from your charging card; unknown price/status is shown explicitly and `UNKNOWN` never means available.
- Deploy via the [`render.yaml`](render.yaml) Blueprint: Render → New → Blueprint → select the repo → Apply.
