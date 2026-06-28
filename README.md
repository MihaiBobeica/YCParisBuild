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

## Local dev (no Docker)(if you really want to...)

```bash
# backend
cd backend && pip install -r requirements.txt
alembic upgrade head && uvicorn app.main:app --reload
pytest

# frontend
cd frontend && npm install && npm run dev
```

## API

Full schema at `/docs`. Endpoints cover station bbox queries + filters, text/geocode search, recommendations, partner sites & availability, partner bookings (2h slots), and YTD savings.

## Notes

- Partner sites (gold pins) offer a discounted €/kWh rate; reserving a 2h block snapshots nearby public rates to track savings. Data lives in `backend/app/data/partner_sites.py` (mirror: `frontend/src/data/partnerSites.ts`).
- NDW prices may differ from your charging card; unknown price/status is shown explicitly and `UNKNOWN` never means available.
- Deploy via the [`render.yaml`](render.yaml) Blueprint: Render → New → Blueprint → select the repo → Apply.
