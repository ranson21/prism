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
- [x] **Economic impact proxy** — Census ACS `B19013_001E` median household income fetched in seed_counties → stored in `geography.counties.median_household_income` → `economic_exposure = (income_thousands) × severity_weight_sum` in compute.py → column in `risk.county_features` → feature in train.py + score.py → surfaced in ExplainPanel + InfoPanel
- [x] **Historical vs predicted comparison** — History tab in ExplainPanel shows 6-month line chart with reference line at current score, Δ change summary, and monthly trend; backed by GET /risk/history/:fips and seed_history.py for demo data
- [x] **Confidence band** — random forest per-tree std → `confidence_lower` / `confidence_upper` in score.py → stored in `risk.scores` → surfaced in `GET /risk/explain/:fips` → ConfidenceBar component in ExplainPanel (range bar with shaded band + score tick)

## Polish / Demo Prep
- [ ] Seed realistic scenario definitions for demo
- [ ] End-to-end smoke test (ingest → score → API → UI)
- [ ] README with setup instructions and demo script
