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

- [x] Seed realistic scenario definitions for demo
- [x] End-to-end smoke test (ingest → score → API → UI)
- [x] Verify map heatmap renders with live scored data
- [x] Verify explainability panel loads correctly for top-ranked counties
- [x] Verify scenario simulation shows meaningful delta scores
- [x] Confirm confidence bands display on explain view

---

## Documentation & Methodology
_Required artifacts for judging on Technical Soundness and Explainability._

- [x] **README** — setup instructions, architecture summary, demo script, data sources cited
- [x] **Architecture diagram** — 3-tier network diagram (Mermaid) with government cloud deployment path, FedRAMP control mapping, and data flow; in `docs/architecture.md`
- [x] **Risk scoring methodology doc** — feature engineering, composite index + K-Means methodology, confidence band derivation, risk thresholds, why-not-classifier rationale; in `docs/ml_pipeline.md`
- [x] **Responsible AI section** — data sources and limitations, uncertainty communication, non-deterministic framing, equity-aware modeling, model auditability, human-in-the-loop requirement; in `docs/responsible_ai.md`

---

## Demo Assets
_Required for Demo Clarity and Mission Relevance judging._

- [x] **5-minute "Path to Agency Pilot" briefing** — problem statement, solution overview, 5-scene demo flow (site → dashboard → explain → scenario → back to site), adoption path, responsible AI commitments, technical credentials; `docs/agency_pilot_brief.md`
- [x] **Demo script / talking points** — 5-scene script with URLs, on-screen actions, talking points, Q&A prep, key numbers; opens on landing site (`http://localhost`), transitions to dashboard (`http://localhost:3000`); `docs/demo_script.md`

## UI — Agency Pilot & Responsible AI Gaps
_Site currently has no in-app narrative for agency adoption or visible responsible AI commitments._

- [x] **About / Mission modal or tab** — 1-screen in-app narrative covering: problem statement (agencies overwhelmed during disasters), how PRISM fits into FEMA/EOC workflow, and the path to agency pilot; should be accessible from the main nav/header
- [x] **Responsible AI callout** — visible banner or panel on the dashboard (not buried in simulator help modal) surfacing: data sources (FEMA, NWS, USGS, Census), uncertainty communication, and non-deterministic framing; directly supports Explainability & Responsible AI judging criterion
- [x] **Expansion path visibility** — at minimum a note in the About modal or footer linking to the Phase 1 → Phase 2 arc so judges see the scale path without leaving the app

---


## Additional Features

- [ ] Let users lasso parts of the map to select counties to generate simulations against
- [ ] Add  a dropdown to allow users to change the view from the default of county view to state and region (NE, NW, SE, etc.)
- [ ] Add a toggle to display or hide U.S. territories
- [ ] Add the ability to simulate multiple disasters on different counties as part of a scenario
- [ ] Add the ability to save simulations
- [ ] Make the risk levels at the top filter options so we can display onlt criticals, elevetated etc.
- [ ] Add filter dropdown to risk rankings to toggle the number and types of rankings shown
- [ ] Auto zoom selected county to a comfortable zoom level that shows surrounding counties but not the whole zoomed out map, this should also work when the app loads to zoom on the default

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

---

## ML Requirements Gap
_Must satisfy judging requirement: "Uses statistical or ML methods (logistic regression, gradient boosting, random forest)"._
_Dropping the random forest left us with a weighted composite index — valid statistically, but not one of the listed ML methods._

- [x] **K-Means clustering layer** — add unsupervised K-Means (sklearn) to the scoring pipeline; cluster all 3,220 counties by their normalized feature profile into K=5 risk tiers; use cluster assignment + distance from the highest-risk centroid as a ML-derived signal; store `cluster_id` per score row; surface "Risk Cluster" in the explain panel — satisfies the ML requirement with an algorithm genuinely appropriate for unlabeled hazard data
- [ ] **Update methodology doc** — update `docs/ml_pipeline.md` to reflect the Explainable Risk Index + K-Means approach; document why supervised classification was inappropriate (FEMA labels are lagging indicators, 90-day window yields ~0 positives) and why clustering fits unsupervised risk profiling

---

## Prioritization Framework Gap
_Must satisfy judging requirement: "Simulates pre-positioning of limited resources"._
_Current scenario simulator models risk change but does not allocate resources or show coverage gaps._

- [ ] **Resource pre-positioning model** — extend `POST /scenarios/simulate` to accept an optional `resource_units` parameter; apply greedy allocation (highest delta-risk counties first, capacity-constrained); return `allocated_resources` and `unmet_need` per county in the response
- [ ] **Resource allocation UI** — add a "Resource Units" input to ScenarioPanel (slider, e.g. 10–500 units); show allocated vs unmet need in the simulation results table; highlight counties that received allocation in a distinct color on the scenario map
