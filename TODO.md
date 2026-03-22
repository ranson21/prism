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

---

## Working Prototype Checklist
_Ensures the demo is end-to-end functional and compelling._

- [ ] Seed realistic scenario definitions for demo
- [ ] End-to-end smoke test (ingest → score → API → UI)
- [ ] Verify map heatmap renders with live scored data
- [ ] Verify explainability panel loads correctly for top-ranked counties
- [ ] Verify scenario simulation shows meaningful delta scores
- [ ] Confirm confidence bands display on explain view

---

## Documentation & Methodology
_Required artifacts for judging on Technical Soundness and Explainability._

- [ ] **README** — setup instructions, architecture summary, demo script, data sources cited
- [ ] **Architecture diagram** — service boundaries (React → Go API → ML Engine → PostgreSQL), data flow, and ingestion sources (FEMA, NWS, USGS, Census); include in `docs/architecture.md` or as a diagram image
- [ ] **Risk scoring methodology doc** — document feature engineering logic, model choice (random forest), confidence band derivation, and risk level thresholds; add to `docs/ml_pipeline.md`
- [ ] **Responsible AI section** — document data sources and limitations, uncertainty communication (confidence bands), avoidance of deterministic claims, bias/equity considerations (economic exposure proxy), and model update cadence; add to `docs/responsible_ai.md`

---

## Demo Assets
_Required for Demo Clarity and Mission Relevance judging._

- [ ] **5-minute "Path to Agency Pilot" briefing** — slide deck or one-pager covering: problem statement, PRISM solution overview, live demo flow, agency adoption path, and responsible AI commitments; store in `docs/agency_pilot_brief.md` or `docs/pitch/`
- [ ] Demo script / talking points aligned to judging narrative: "Where should we act right now, and why?"

---

## Judging Criteria Alignment Checklist
_Verify each criterion is demonstrably addressed before submission._

- [ ] **Mission Relevance (High)** — demo shows improved disaster preparedness + proactive resource prioritization using real public data
- [ ] **Technical Soundness (High)** — architecture diagram reviewed, ML pipeline documented, API contracts match spec, all services run via Docker Compose
- [ ] **Explainability & Responsible AI (High)** — top_drivers visible in UI, confidence bands shown, responsible AI doc complete, no deterministic claims in UI copy
- [ ] **Feasibility for Agency Adoption (High)** — agency pilot briefing covers integration path, data source provenance documented, cloud-native architecture noted
- [ ] **Innovation (Medium)** — scenario simulation and geo-aware defaults highlighted in demo
- [ ] **Demo Clarity (Medium)** — demo script rehearsed, ranked table leads with highest-risk counties, explain panel tells a clear story

---

## Expansion Path
_Post-hackathon architecture decisions to note now so MVP design supports them._

### Phase 1 — Agency Pilot
- [ ] Document hook points for **real-time weather feed ingestion** (NWS WebSocket / streaming API replacement for polling connector)
- [ ] Document **state emergency operations center integration** interface (webhook receiver or API push endpoint in Go service)
- [ ] Note **logistics optimization modeling** as a future domain service in architecture diagram
- [ ] Note **cross-agency data fusion** pattern (additional connector + raw_events normalization) in data pipeline docs

### Phase 2 — Enterprise Disaster Intelligence Platform
- [ ] Note **satellite imagery integration** layer in architecture diagram (image ingest → feature extraction service)
- [ ] Note **infrastructure vulnerability modeling** as an additional ML feature domain
- [ ] Note **multi-hazard fusion engine** — current multi-source feature engineering is the seed of this
- [ ] Note **predictive seasonal outlook modeling** — extend scoring to forward-looking time horizons
- [ ] Note **secure cloud deployment** path (containerized services → Kubernetes / managed cloud)
