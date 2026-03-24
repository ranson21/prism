# PRISM — Prioritization of Risk & Incident Support Model

An AI-powered disaster risk intelligence platform that helps emergency planners prioritize limited resources using explainable, continuously updated county-level risk scores derived from public hazard data.

> "Where should we act right now, and why?"

| | |
|---|---|
| **Live demo** | https://prod.d3vtja5wfwepyp.amplifyapp.com |
| **Live dashboard** | https://prod.d3vtja5wfwepyp.amplifyapp.com/app |
| **Documentation** | https://prod.d3vtja5wfwepyp.amplifyapp.com/docs/agency-pilot |

---

## The Real-World Problem

Every major disaster reveals the same gap: emergency management agencies have more data than ever — FEMA disaster declarations, weather alerts, earthquake feeds, Census demographics — but that data lives in siloed systems with no unified picture of where risk is actually highest *right now*.

The result is reactive decision-making under pressure. When a storm makes landfall, it is too late to ask where the most vulnerable counties were. Resource pre-positioning decisions — which directly determine response times and outcomes — are made without a shared operating picture or an auditable rationale.

PRISM was built to close that gap. It is designed around the specific operational question every Emergency Operations Center faces before a disaster: *"Where should we send resources, and how do we defend that decision?"*

The design is grounded in three constraints that govern real government adoption:

- **Explainability is non-negotiable.** A risk score that cannot be explained to a stakeholder or a congressional oversight committee cannot be used. Every PRISM output traces directly to named public data sources.
- **Uncertainty must be visible.** Emergency managers need to know how much to trust a score. PRISM surfaces a confidence band on every estimate — wide bands flag low-confidence inputs so analysts know when to rely on local knowledge instead.
- **Human judgment stays in the loop.** PRISM informs decisions. It does not automate them. The scenario simulator surfaces resource gaps and recommends priorities; the final call belongs to the incident commander.

---

## How AI Powers PRISM

PRISM uses a two-layer AI architecture designed for unlabeled hazard data — a domain where ground-truth labels are sparse, lagged, and systematically biased toward wealthier counties that receive faster federal declarations.

**Layer 1 — Explainable Risk Index.** Eight features engineered from four public data sources (FEMA, NWS, USGS, Census) are normalized via MinMaxScaler and combined with expert-calibrated weights drawn from FEMA's own National Risk Index methodology. This produces a 0–100 composite score with direct feature attribution — every score is fully decomposable into its inputs.

**Layer 2 — K-Means Risk Tier Assignment.** Unsupervised K-Means clustering (scikit-learn, k=5) groups all 3,220 counties by their full normalized feature profile into risk tiers. This adds a peer-benchmarking dimension: a county is not just scored in isolation but placed in context relative to counties with similar hazard profiles nationally. A supervised classifier was evaluated and rejected — FEMA major disaster declarations in a 90-day window yield a near-zero positive label rate (<1%), making classifier probability calibration unreliable. The methodology section of [`docs/ml_pipeline.md`](docs/ml_pipeline.md) documents this decision.

**Confidence bands** are derived from the weighted standard deviation of normalized feature values per county. A county with consistent signals across all eight features receives a tight band; a county with mixed signals (high earthquake exposure, low weather activity) receives a wide band — communicating model uncertainty directly in the UI.

The architecture is designed for the next step: connecting to real-time agency feeds, federating with agency SSO (SAML 2.0 / OIDC), and deploying on FedRAMP-authorized infrastructure. The full agency adoption path is documented in [`docs/agency_pilot_brief.md`](docs/agency_pilot_brief.md).

---

## What PRISM Produces

- **0–100 risk scores** for all 3,220 US counties, updated on demand
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
  FEMA OpenFEMA · NOAA Weather API · USGS Earthquake Catalog · US Census ACS
```

| Service              | Language           | Role                                         |
| -------------------- | ------------------ | -------------------------------------------- |
| `apps/ui`            | React + TypeScript | Dashboard, map heatmap, scenario UI          |
| `services/api`       | Go (Gin)           | REST API, query orchestration, rankings      |
| `services/ml-engine` | Python (FastAPI)   | Data ingestion, feature engineering, scoring |
| `environments/local` | Docker Compose     | Local orchestration, PostgreSQL, migrations  |

---

## Data Sources

| Dataset               | Source                                                                                  | Used For                                  |
| --------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------- |
| Disaster declarations | [FEMA OpenFEMA API](https://www.fema.gov/about/openfema/api)                            | Disaster counts, major disaster flags     |
| Severe weather alerts | [NOAA / National Weather Service API](https://api.weather.gov)                          | Alert counts weighted by severity         |
| Earthquake events     | [USGS Earthquake Catalog](https://earthquake.usgs.gov/fdsnws/event/1/)                  | Earthquake count, max magnitude           |
| Population & income   | [US Census Bureau ACS](https://www.census.gov/data/developers/data-sets/acs-1year.html) | Population exposure, income vulnerability |

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
make ingest    # pull latest FEMA/NOAA/USGS events
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

| Method | Path                  | Description                                     |
| ------ | --------------------- | ----------------------------------------------- |
| `GET`  | `/risk/summary`       | Distribution of risk levels + top 5 counties    |
| `GET`  | `/risk/rankings`      | All counties ranked by risk score (paginated)   |
| `GET`  | `/risk/explain/:fips` | Full score breakdown for one county             |
| `GET`  | `/risk/history/:fips` | 90-day score history for one county             |
| `POST` | `/scenarios/simulate` | Apply severity multiplier + resource allocation |

---

## Demo Script

The live system is deployed at **https://prod.d3vtja5wfwepyp.amplifyapp.com** — no local setup required.

1. **Open the landing site** — scroll through the problem framing, then click "Open Live Dashboard."
2. **The map loads** with all 3,220 counties colored by risk level (green → yellow → orange → red).
3. **Click a high-risk county** — the Explain panel opens showing the risk score, confidence band, top risk drivers chart, and K-Means tier.
4. **Switch to History tab** — see the 6-month score trend for that county.
5. **Open the Scenario Simulator** — select "Category 5 Hurricane", set Resource Units to 50, click Run. Results show which counties spike to critical, which 50 receive a resource team (DEPLOYED), and which have unmet need (UNMET).
6. **Click "About / Agency Pilot"** in the header — methodology, scoring approach, and adoption roadmap.
7. **Browse the docs site** at `/docs/agency-pilot` — full technical documentation including architecture, ML pipeline, responsible AI commitments, and agency SSO integration design.

Full presenter talking points: [`docs/demo_script.md`](docs/demo_script.md)

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

## Cloud Deployment (AWS)

PRISM deploys to AWS using Terragrunt with three environments:

| Environment | Region          | Notes                                       |
| ----------- | --------------- | ------------------------------------------- |
| `dev`       | `us-east-1`     | Single-AZ, Fargate Spot, micro sizing       |
| `test`      | `us-east-1`     | Multi-AZ, on-demand Fargate, small sizing   |
| `stable`    | `us-gov-west-1` | GovCloud, 3-AZ HA, FedRAMP Moderate aligned |

### Step 1 — Get your AWS credentials from the Console

1. Sign in to [console.aws.amazon.com](https://console.aws.amazon.com)
2. Click your name in the **top-right corner** — your 12-digit **Account ID** is displayed in the dropdown
3. Click **Security credentials** → scroll to **Access keys** → **Create access key**
4. Select **Command Line Interface (CLI)** → Next → **Create access key**
5. Copy the **Access key ID** and **Secret access key** — the secret is only shown once

### Step 2 — Install dependencies (Ubuntu)

```bash
make aws-install-deps
```

Installs Terraform, Terragrunt, and AWS CLI v2.

### Step 3 — Configure AWS CLI

```bash
aws configure
# AWS Access Key ID:     AKIA...        ← paste from Step 1
# AWS Secret Access Key: xxxxxxxx       ← paste from Step 1
# Default region:        us-east-1
# Default output:        json
```

Verify credentials are working:

```bash
make aws-check
# Expected output: your Account ID, UserId, and ARN
```

### Step 4 — Bootstrap state backend (once per AWS account)

Creates the S3 bucket and DynamoDB table Terragrunt uses to store and lock state:

```bash
make aws-bootstrap
```

Override the default names if needed:

```bash
make aws-bootstrap BUCKET=my-bucket TABLE=my-lock-table
```

### Step 5 — Plan (preview without making changes)

```bash
make infra-plan-dev
```

### Step 6 — Apply the dev environment

Applies resources in dependency order (vpc → s3/ecr → rds → alb → waf → ecs):

```bash
make infra-apply-dev
```

### Step 7 — Push container images to ECR

```bash
make ecr-push-dev
```

### Step 8 — Get the load balancer URL

```bash
aws elbv2 describe-load-balancers \
  --query 'LoadBalancers[?LoadBalancerName==`prism-dev`].DNSName' \
  --output text
```

Open that URL in your browser. HTTP redirects automatically to HTTPS.

### Tear down (to avoid charges)

```bash
make infra-destroy-dev
```

### Infrastructure layout

```
environments/
├── terragrunt.hcl          # Root: S3 state backend, AWS provider, default tags
├── dev/
│   ├── env.hcl             # Dev locals (single-AZ, Fargate Spot, micro sizing)
│   ├── vpc/                # terraform-aws-modules/vpc
│   ├── ecr/                # terraform-aws-modules/ecr
│   ├── s3/                 # terraform-aws-modules/s3-bucket (ML artifacts)
│   ├── rds/                # terraform-aws-modules/rds (PostgreSQL 16)
│   ├── alb/                # terraform-aws-modules/alb (HTTPS + HTTP→HTTPS redirect)
│   ├── waf/                # umotif-public/waf-webaclv2 (OWASP managed rules + rate limit)
│   └── ecs/                # terraform-aws-modules/ecs (api + ml-engine + ui on Fargate)
├── test/                   # Same structure — multi-AZ, on-demand Fargate
└── stable/                 # Same structure — GovCloud, 3-AZ HA, FedRAMP settings
```

---

## Project Structure

```
prism/
├── apps/
│   ├── ui/                  # React dashboard
│   └── site/                # Landing site
├── services/
│   ├── api/                 # Go REST API
│   └── ml-engine/           # Python ingestion + ML
├── environments/
│   ├── local/               # Docker Compose + migrations
│   ├── dev/                 # AWS dev environment (Terragrunt)
│   ├── test/                # AWS test environment (Terragrunt)
│   └── stable/              # AWS stable/prod environment (Terragrunt, GovCloud)
├── docs/                    # Architecture, ML pipeline, responsible AI
└── Makefile                 # Primary developer entrypoint
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Maintainers

- Please refer to each submodule's README for specific maintainer information
- For overall repository issues, contact [Abigail Ranson](mailto:abby@abbyranson.com)

