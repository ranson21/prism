# PRISM — Hackathon TODO

## Infrastructure
- [x] PostgreSQL schema (geography, datasets, risk, prioritization, scenarios, auth)
- [x] Docker Compose (postgres + service networking)
- [x] Makefile targets (bootstrap, dev, db-up, db-reset, seed-counties, ingest)
- [x] `.gitignore` + `.env` setup

## Data Pipeline (Python / ML Engine)
- [x] Base connector interface
- [x] FEMA connector (disaster declarations)
- [x] NWS connector (weather alerts)
- [x] USGS connector (earthquakes)
- [x] Ingestion pipeline (deduplicate, write to raw_events, run logging)
- [x] County seeder (Census Bureau → geography.counties)
- [x] Feature engineering (`raw_events` → `risk.county_features`)
- [x] ML model training (random forest baseline → `risk.model_versions`)
- [x] Risk scoring (`county_features` → `risk.scores` with top_drivers)
- [x] `POST /score` endpoint to trigger feature + score run

## Go API
- [ ] Project scaffold (Gin, go.mod, cmd/main.go)
- [ ] DB connection (pgx pool)
- [ ] `GET /risk/summary` — top-level stats
- [ ] `GET /risk/rankings` — ranked county list with risk_level + top_drivers
- [ ] `GET /risk/explain/:fips` — full explainability breakdown for one county
- [ ] `POST /scenarios/simulate` — apply parameter overrides and return delta scores

## React Frontend
- [ ] Project scaffold (Vite + Tailwind + ShadCN)
- [ ] Map heatmap (county-level risk choropleth)
- [ ] Ranked table (sortable, color-coded by risk_level)
- [ ] Explainability panel (top_drivers for selected county)
- [ ] Scenario comparison view (baseline vs simulated)

## Polish / Demo Prep
- [ ] Seed realistic scenario definitions for demo
- [ ] End-to-end smoke test (ingest → score → API → UI)
- [ ] README with setup instructions and demo script
