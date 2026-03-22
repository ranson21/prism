# PRISM
## Prioritization of Risk & Incident Support Model

**PRISM** is an AI-powered disaster risk intelligence platform that helps emergency planners prioritize limited response resources using explainable, data-driven insights.

> **PRISM — Prioritizing Risk for Intelligent Support & Mobilization**

---

## 🚨 Problem

Emergency agencies such as FEMA, NOAA, and USGS manage vast amounts of disaster and hazard data, but face a critical challenge:

> **How do we prioritize limited resources before and during disasters based on predictive risk signals?**

Current approaches often:
- rely on fragmented datasets
- lack standardized risk scoring
- provide limited explainability
- make proactive resource allocation difficult

---

## 🎯 Solution

PRISM transforms public disaster, weather, and demographic data into:

- **County-level disaster risk scores**
- **Ranked priority regions**
- **Explainable risk drivers**
- **Scenario-based resource allocation insights**
- **Operational decision-support dashboards**

PRISM is not designed to predict disasters with certainty.

It is designed to:
> **Make disaster risk measurable, transparent, and actionable for planners.**

---

## 🧠 AI Approach

PRISM uses machine learning to forecast near-term disaster risk and simulate resource allocation strategies.

### 🔍 Risk Prediction
- Model: Random Forest (baseline)
- Predicts: **county-level risk over 24–72 hours**
- Outputs:
  - `risk_score` (0–100)
  - `risk_level` (low → critical)
  - `confidence_band`

### 📊 Feature Inputs
- Historical disaster frequency (FEMA)
- Weather signals (NOAA)
- Geological hazards (USGS)
- Population exposure (Census)
- Severity and economic impact proxies

### 🔎 Explainability
PRISM emphasizes **transparent AI**:
- Feature importance per prediction
- Top risk drivers surfaced to users
- Clear assumptions and limitations

---

## ⚙️ Resource Prioritization Engine

PRISM converts risk into action.

### 📌 Capabilities
- Rank regions by composite risk
- Identify **top priority counties**
- Highlight **resource gaps**
- Recommend **pre-positioning strategies**

### 🔁 Scenario Simulation
PRISM supports “what-if” planning:
- Deploy resources to County A vs County B
- Compare expected risk reduction
- Evaluate constrained resource allocation

---

## 🗺️ Dashboard

PRISM provides a mission-focused operational dashboard:

### Key Views
- 🗺️ County-level heat map
- 📊 Risk ranking table
- 🧠 Explainability panel (risk drivers)
- 🚚 Resource allocation view
- 🔁 Scenario comparison mode
- 📈 Historical vs predicted comparison

---

## 🏗️ Architecture

```
[ React Frontend ]
        ↓
   [ Go API Layer ]
        ↓
[ Python ML Service ]
        ↓
   [ Public Datasets ]
```

---

## 📊 Data Sources

PRISM uses only **public datasets**:

- FEMA OpenFEMA
- NOAA / NCEI
- USGS
- U.S. Census (optional)

---

## 🔐 Security Model

- JWT-based authentication
- Role-based access control (RBAC)

---

## 📦 API Overview

Example endpoints:

```
GET  /risk/summary
GET  /risk/rankings
GET  /risk/explain
POST /scenarios/simulate
GET  /resources
POST /auth/login
```

---
## 🚀 Local Development

PRISM uses modern, language-appropriate tooling for local development:

- Python ML service uses Poetry for dependency management and virtual environments
- Go API uses standard Go modules
- Frontend uses npm
- Makefile provides the primary entry point for common developer workflows

The repository should prefer documented `make` commands over ad hoc per-service shell commands so local development stays consistent across contributors.

### Prerequisites

Install the following tools before starting:

- Python 3.11+
- Poetry
- Go 1.22+
- Node.js 20+
- make

### First-Time Setup

Bootstrap all local dependencies:

```bash
make bootstrap
```

### Start the Full Local Development Environment

```bash
make dev
```

This should start the core local services for development:

- the React frontend
- the Go API
- the Python ML service

### Run Individual Services

Start only the ML service:

```bash
make dev-ml
```

Start only the Go API:

```bash
make dev-api
```

Start only the frontend:

```bash
make dev-web
```

### Testing

Run all tests:

```bash
make test
```

Run service-specific tests:

```bash
make test-api
make test-ml
make test-web
```

### Formatting

Format all code:

```bash
make fmt
```

### Linting

Run all linters:

```bash
make lint
```

### Environment Configuration

Use `.env.example` files to document required environment variables for each service.

Recommended pattern:

- backend/api/.env.example
- backend/ml-service/.env.example
- frontend/.env.example

Copy these into `.env` files locally and update values as needed.
---

## ⚖️ Responsible AI

- Explainable outputs
- Transparent assumptions
- No overconfident predictions
- Human-in-the-loop decision support

---

## 🎥 Demo Narrative

“PRISM uses public disaster, weather, and population data to forecast county-level risk over the next 72 hours.  
It then ranks regions by priority and simulates resource allocation strategies to help emergency planners make faster, more informed decisions.”

---

## 👥 Team

Sky Solutions LLC
