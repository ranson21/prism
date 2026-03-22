# PRISM — Prioritization of Risk & Incident Support Model

An AI-powered disaster risk intelligence platform that helps emergency planners prioritize limited resources using explainable, continuously updated county-level risk scores derived from public hazard data.

> "Where should we act right now, and why?"

---

## What PRISM Does

PRISM ingests public data from FEMA, NWS, USGS, and the US Census Bureau and produces:

- **0–100 risk scores** for all 3,200+ US counties, updated on demand
- **Ranked county list** sorted by risk level with top risk drivers per county
- **Explainability panel** showing exactly which factors are driving each score
- **K-Means risk tiers** (Tier 1 — Minimal Activity through Tier 5 — High-Risk Composite)
- **Confidence bands** communicating uncertainty in each score
- **Scenario simulator** to model hypothetical disaster events and pre-position resources

PRISM is a decision-support tool, not a deterministic predictor. Outputs are probabilistic estimates to inform — not replace — domain expertise.

---

## Architecture

```
[ React Dashboard (Vite + Tailwind) ]
              ↓  HTTP / REST
      [ Go API (Gin) — port 8080 ]
              ↓  pgx
         [ PostgreSQL ]
              ↑  psycopg3
  [ Python ML Engine (FastAPI) — port 8001 ]
              ↑
  FEMA OpenFEMA · NWS API · USGS Earthquake Catalog · US Census ACS
```

| Service | Language | Role |
|---|---|---|
| `apps/ui` | React + TypeScript | Dashboard, map heatmap, scenario UI |
| `services/api` | Go (Gin) | REST API, query orchestration, rankings |
| `services/ml-engine` | Python (FastAPI) | Data ingestion, feature engineering, scoring |
| `environments/local` | Docker Compose | Local orchestration, PostgreSQL, migrations |

---

## Data Sources

| Dataset | Source | Used For |
|---|---|---|
| Disaster declarations | [FEMA OpenFEMA API](https://www.fema.gov/about/openfema/api) | Disaster counts, major disaster flags |
| Severe weather alerts | [NWS API](https://api.weather.gov) | Alert counts weighted by severity |
| Earthquake events | [USGS Earthquake Catalog](https://earthquake.usgs.gov/fdsnws/event/1/) | Earthquake count, max magnitude |
| Population & income | [US Census Bureau ACS](https://www.census.gov/data/developers/data-sets/acs-1year.html) | Population exposure, income vulnerability |

All data is public and free to access. No proprietary feeds are required.

---

## Quick Start (Docker)

Prerequisites: Docker Desktop or Docker Engine + `make`.

```bash
# 1. Clone and enter the repo
git clone <repo-url> && cd prism

# 2. Start all services (builds images if needed)
make docker-up

# 3. Open the dashboard
open http://localhost:3000

# 4. (Optional) Trigger a fresh data run
make ingest    # pull latest FEMA/NWS/USGS events
make features  # compute county feature vectors
make train     # fit the risk index model
make score     # score all 3,220 counties
```

The database is seeded with county geography and demo scenario definitions automatically on first `docker-up`. Historical scores for the past 6 months are seeded via `make seed-history`.

---

## Local Development (without Docker)

Prerequisites: Python 3.11+, Poetry, Go 1.22+, Node.js 20+, PostgreSQL.

```bash
# Install all dependencies
make bootstrap

# Start each service in a separate terminal
make dev-api   # Go API on :8080
make dev-ml    # Python ML engine on :8001
make dev-web   # React UI on :5173
```

Copy `environments/local/.env.example` to `environments/local/.env` and set `DATABASE_URL` before starting.

---

## Key API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/risk/summary` | Distribution of risk levels + top 5 counties |
| `GET` | `/risk/rankings` | All counties ranked by risk score (paginated) |
| `GET` | `/risk/explain/:fips` | Full score breakdown for one county |
| `GET` | `/risk/history/:fips` | 90-day score history for one county |
| `POST` | `/scenarios/simulate` | Apply severity multiplier + resource allocation |

---

## Demo Script

1. **Open the dashboard** — the map loads with all 3,220 counties colored by risk level (green → yellow → orange → red).
2. **Click a high-risk county** (red/orange on the map) — the Explain panel opens showing the risk score, confidence band, top risk drivers chart, and K-Means tier.
3. **Switch to History tab** — see the 6-month score trend for that county.
4. **Open the Scenario Simulator** — select "Category 5 Hurricane", set Resource Units to 50, click Run. The results show which counties' risk spikes, which 50 get resources deployed, and which have unmet need.
5. **Click "About / Agency Pilot"** in the header — explains the methodology, scoring approach, and path to agency adoption.

---

## Methodology Summary

See [`docs/ml_pipeline.md`](docs/ml_pipeline.md) for full detail. In brief:

- Features are normalized to [0, 1] via MinMaxScaler and combined with expert-calibrated weights (FEMA NRI methodology).
- Scores are rank-normalized to a right-skewed 0–100 distribution.
- K-Means (k=5) clusters counties into risk tiers based on their full feature profile.
- A supervised classifier was evaluated but FEMA major disaster declarations in a 90-day window yield near-zero positive labels, making probability calibration unreliable.

---

## Responsible AI

See [`docs/responsible_ai.md`](docs/responsible_ai.md) for full detail.

- **Public data only** — no proprietary or real-time emergency feeds
- **Uncertainty shown** — every score includes a confidence band
- **Explainable** — top drivers surface which factors drove each score
- **Not deterministic** — scores are relative risk estimates, not predictions of specific events
- **Equity-aware** — income vulnerability is modeled as a risk amplifier, not excluded

---

## Project Structure

```
prism/
├── apps/
│   └── ui/                  # React dashboard
├── services/
│   ├── api/                 # Go REST API
│   └── ml-engine/           # Python ingestion + ML
├── environments/
│   └── local/               # Docker Compose + migrations
├── docs/                    # Architecture, ML pipeline, responsible AI
└── Makefile                 # Primary developer entrypoint
```

---

Built by Sky Solutions LLC
