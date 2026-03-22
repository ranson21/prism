# CLAUDE.md

# PRISM — Core Development Constitution

## Project Context
PRISM (Prioritization of Risk & Incident Support Model) is an AI-powered disaster risk intelligence platform for FEMA-style decision support.

PRISM:
- aggregates public disaster & hazard datasets (FEMA, NOAA, USGS)
- produces explainable county-level risk scores
- ranks regions for resource prioritization
- supports scenario-based planning
- visualizes results in an operational dashboard

PRISM is NOT a deterministic prediction system.
It is a decision-support system focused on:
- explainability
- transparency
- operational usefulness

---

## Mission Framing

Always optimize outputs toward this narrative:

“PRISM uses public disaster, weather, and population data to forecast county-level risk and support proactive, explainable resource prioritization.”

Outputs should clearly communicate:
1. What is happening
2. Where to act
3. Why it matters
4. How confident we are
5. What to do next

---

## Architecture Overview

Frontend: React (Vite, Tailwind, ShadCN)
API: Go (Gin)
ML Engine: Python (FastAPI, scikit-learn)
DB: PostgreSQL
Orchestration: Makefile + Docker Compose

---

## Architecture Principles

- Modular monolith with clear service boundaries
- Domain-driven structure (Labra-style discipline)
- Avoid premature microservices
- Design for future extraction into services

### Repo Structure

/apps/ui
/services/api
/services/ml-engine
/environments/local (docker-compose)

/docs (deep specs)

---

## Domain Discipline

Domains include:
- risk
- prioritization
- resources
- geography
- datasets
- scenarios
- auth

Rules:
- no generic utils dumping ground
- isolate domain logic
- clean boundaries

---

## Responsibility Boundaries

React:
- UI + interaction

Go:
- orchestration
- prioritization logic
- API + auth

Python:
- ingestion
- feature engineering
- ML
- explainability

Never mix these concerns.

---

## Product Expectations

Every feature must answer:

“Where should we act right now, and why?”

Default UX:
- ranked outputs first
- explainability visible
- actionable insights
- minimal clutter

---

## Semantic Design

Background: #0F172A
Panels: #111827
Cards: #1F2937

Risk colors:
- green → low
- yellow → moderate
- orange → elevated
- red → critical

Color must encode meaning, not decoration.

---

## Coding Standards

General:
- explicit > clever
- small functions
- consistent naming
- minimal dependencies

Go:
- thin handlers
- domain services
- explicit wiring

Python:
- type hints
- clear pipelines
- no hidden preprocessing

React:
- typed props
- composable components
- simple state

---

## Local Development

Use:
- Poetry (Python)
- Go modules
- npm
- Makefile as entrypoint

Commands:
- make bootstrap
- make dev
- make test
- make lint
- make fmt

---

## Containerization

- All services Dockerized
- docker-compose for orchestration
- service-name networking (no localhost)
- Makefile wraps Docker commands

---

## API Expectations

Endpoints:
- /risk/summary
- /risk/rankings
- /risk/explain
- /scenarios/simulate

Responses must include:
- risk_score
- risk_level
- top_drivers
- confidence_band

---

## Dashboard Expectations

Must include:
- map heatmap
- ranked table
- explainability panel
- scenario comparison

Default view must prioritize:
- highest risk areas
- why they matter
- recommended action

---

## Responsible AI

Always:
- document sources
- explain outputs
- show uncertainty
- avoid deterministic claims

Never say:
- “guarantee”
- “will happen”

---

## Assistant Behavior

When generating:
1. Design first
2. Show structure
3. Then code

Always:
- state assumptions
- explain tradeoffs
- keep outputs practical

---

## Hackathon Heuristics

Optimize for:
- clarity
- explainability
- strong demo
- believable scale path

Winning narrative:

“PRISM combines public data into an explainable risk score and helps prioritize limited resources through scenario-based decision support.”

---

## References

See docs for implementation details:
- docs/data_pipeline.md
- docs/ml_pipeline.md
- docs/architecture.md
- docs/containerization.md
