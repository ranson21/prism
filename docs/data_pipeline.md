# PRISM — Data Pipeline

## Overview

The PRISM data pipeline is a modular ingestion and transformation system that converts raw public disaster and hazard data into normalized county-level features suitable for risk scoring. It runs inside the ML Engine service and is triggered on demand via FastAPI endpoints or Makefile targets.

```
External APIs          Ingestion Connectors        Normalization
─────────────          ────────────────────        ─────────────
FEMA OpenFEMA    ──►   FEMAConnector          ──►
NWS Alerts       ──►   NWSConnector           ──►   datasets.raw_events
USGS Earthquakes ──►   USGSConnector          ──►   (deduplicated, FIPS-aligned)
                                                           │
                                                           ▼
                                                   Feature Engineering
                                                   (90-day rolling window)
                                                           │
                                                           ▼
                                                   risk.county_features
```

---

## Layer 1 — Ingestion

### Connector Interface

All connectors implement a common async base:

```python
class BaseConnector:
    source_key: str           # "fema", "nws", "usgs"
    async def fetch(self, since: datetime | None) -> list[RawEvent]
```

Each connector is responsible for:
- Fetching from its upstream API (incremental via `since` timestamp)
- Normalizing events to the canonical `RawEvent` schema
- Mapping to a FIPS code (county-level geographic alignment)

### Active Connectors

| Connector | Source | Event Types | Key Fields |
|-----------|--------|-------------|------------|
| `FEMAConnector` | api.fema.gov | Disaster declarations | declaration type, incident type, state+county FIPS |
| `NWSConnector` | api.weather.gov | Severe weather alerts | event type, severity (minor/moderate/severe/extreme), affected zone → FIPS |
| `USGSConnector` | earthquake.usgs.gov | Earthquake catalog | magnitude, depth, lat/lon → nearest county FIPS |

### Canonical Event Schema (`datasets.raw_events`)

| Column | Type | Description |
|--------|------|-------------|
| `source` | TEXT | Connector key: `fema`, `nws`, `usgs` |
| `event_type` | TEXT | Source-specific event classification |
| `county_fips` | TEXT | 5-digit FIPS code (2-digit state + 3-digit county) |
| `severity` | NUMERIC | Normalized 0–1 severity estimate |
| `event_date` | DATE | Date the event occurred or was declared |
| `raw_payload` | JSONB | Original API response for auditability |
| `ingested_at` | TIMESTAMPTZ | When this record was written |

### Deduplication

The ingestion pipeline deduplicates on `(source, external_id)` using an `ON CONFLICT DO NOTHING` upsert. Re-running ingestion is safe and idempotent.

---

## Layer 2 — Normalization

### Geographic Alignment (FIPS)

Every event is aligned to a county FIPS code before storage:

- **FEMA**: declarations include state FIPS + county FIPS directly
- **NWS**: alerts reference NWS forecast zones — mapped to county via a zone → FIPS lookup table seeded from Census data
- **USGS**: earthquake coordinates are point data — mapped to the containing county polygon using a lat/lon → FIPS spatial lookup

All 3,220 counties in `geography.counties` are populated by the county seeder (`app.geography.seed_counties`) from the US Census Bureau TIGER dataset.

### Severity Normalization

Each source uses different severity scales. The pipeline normalizes to a `[0, 1]` severity float:

| Source | Raw Scale | Normalization |
|--------|-----------|---------------|
| NWS | minor / moderate / severe / extreme | 0.25 / 0.5 / 0.75 / 1.0 |
| USGS | Richter magnitude | `min(magnitude / 8.0, 1.0)` |
| FEMA | Declaration type (EM / DR / FM) | 0.5 / 1.0 / 0.75 |

---

## Layer 3 — Feature Engineering

Source: `services/ml-engine/app/features/compute.py`

Features are computed over a configurable rolling window (default: 90 days) from `datasets.raw_events`. A LEFT JOIN from `geography.counties` ensures all 3,220 counties receive a feature row — counties with no events receive structural features (population, income) but zero hazard counts.

See `docs/ml_pipeline.md` for the full feature specification and weights.

---

## Storage

| Table | Layer | Contents |
|-------|-------|----------|
| `geography.counties` | Reference | 3,220 counties: FIPS, name, state, population, median income |
| `datasets.sources` | Reference | Connector registry and last-fetched timestamps |
| `datasets.ingestion_runs` | Audit | Per-run logs: connector, record count, duration, errors |
| `datasets.raw_events` | Ingestion | All normalized events, deduplicated by source + external ID |
| `risk.county_features` | Features | Engineered feature vectors per county per window |

---

## Pipeline Execution

### On Demand (local)

```bash
make ingest     # POST /ingest   — fetch latest events from all connectors
make features   # POST /features — recompute feature vectors (window_days=90)
make train      # POST /train    — refit model and persist artifact
make score      # POST /score    — score all 3,220 counties
```

### On Demand (AWS, inside VPC)

```bash
make aws-seed-data ENV=dev    # runs full pipeline via ECS Exec (no public DB access)
```

### Recommended Production Cadence

| Step | Frequency | Rationale |
|------|-----------|-----------|
| Ingest | Daily | FEMA/NWS/USGS publish updates daily |
| Features | Daily | Rolling window shifts with each new day |
| Score | Daily | Keeps risk scores current |
| Train | Weekly | Re-fitting on a full week of fresh data is sufficient |

---

## Expansion Path

### Phase 1 — Real-Time Weather Feed Ingestion

The current `NWSConnector` polls the NWS REST API on a configurable schedule (incremental by `effective` date). The hook point for upgrading to a streaming feed is the `BaseConnector.fetch()` method — the interface is already async.

**Planned replacement:**

```
NWS CAP Alert Feed (ATOM/RSS) → Streaming ingest worker
  └─► Kafka / SQS topic: raw-alerts
         └─► Alert consumer → deduplicate → datasets.raw_events
```

NWS publishes the [Common Alerting Protocol (CAP)](https://www.weather.gov/media/documentation/docs/NWS_CAP_v12.pdf) atom feed at `https://alerts.weather.gov/cap/us.php?x=1` with updates every 1–2 minutes. A streaming consumer would replace the batch polling connector and drive near-real-time risk re-scoring during active severe weather events.

**What changes:**
- Add an async streaming worker alongside the existing connector
- The `raw_events` schema is unchanged — the consumer writes the same normalized records
- Add a trigger: on N new events for a county, re-run features + score for that county only (partial re-score)
- No changes to the API or UI — they read from `risk.scores` regardless of how it was produced

### Phase 2 — Cross-Agency Data Fusion

PRISM's connector architecture is designed for extension. Adding a new data source requires:

1. Implement `BaseConnector` with the new source's API
2. Normalize events to the canonical `raw_events` schema (FIPS alignment, severity normalization)
3. Register the connector in the ingestion pipeline

**Planned additional sources:**

| Source | Data | Integration Path |
|--------|------|-----------------|
| NOAA Storm Events | Historical storm records | REST connector (already partially stubbed) |
| CDC Social Vulnerability Index | SVI per county | One-time seeder → `geography.counties` columns |
| HUD Disaster Recovery data | Housing damage assessments | REST connector → raw_events |
| State EOC feeds | Local incident reports | Webhook receiver (see architecture.md) |
| FEMA Integrated Public Alert & Warning System (IPAWS) | Active emergency alerts | Streaming connector → raw_events |

The normalization layer handles source heterogeneity — as long as an event can be mapped to a county FIPS code, a date, and a severity estimate, it slots into the existing feature engineering pipeline without schema changes.
