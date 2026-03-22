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
- [x] Project scaffold (Gin, go.mod, cmd/main.go)
- [x] DB connection (pgx pool)
- [x] sqlc query generation (risk + scenarios domains)
- [x] `GET /risk/summary` — top-level stats
- [x] `GET /risk/rankings` — ranked county list with risk_level + top_drivers
- [x] `GET /risk/explain/:fips` — full explainability breakdown for one county
- [x] `POST /scenarios/simulate` — apply parameter overrides and return delta scores

## React Frontend
- [x] Project scaffold (Vite + Tailwind + RTK Query) — apps/ui
- [x] Map heatmap (county-level risk choropleth)
- [x] Ranked table (color-coded by risk_level)
- [x] Explainability panel (top_drivers bar chart + feature counts)
- [x] Scenario comparison view (baseline vs simulated)
- [x] Copy the PRISM logo from the root into its appropriate folder and remove from root

## Prompt Compliance Gaps
- [ ] **Economic impact proxy** — document `major_disaster_count` as economic proxy in InfoPanel (FEMA major declarations require $$ damage thresholds); add it to the feature list in ExplainPanel raw counts
- [ ] **Historical vs predicted comparison** — add a History tab or panel to the dashboard showing past model score runs per county so decision-makers can compare trend over time vs current prediction

## Polish / Demo Prep
- [ ] Seed realistic scenario definitions for demo
- [ ] End-to-end smoke test (ingest → score → API → UI)
- [ ] README with setup instructions and demo script
