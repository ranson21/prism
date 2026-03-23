# PRISM — ML Pipeline & Risk Scoring Methodology

## Overview

PRISM produces a 0–100 county-level risk score using a **domain-weighted composite index** with **percentile-rank normalization**, following the same methodology as the [FEMA National Risk Index](https://hazards.fema.gov/nri/). An unsupervised **K-Means clustering** layer groups counties into five risk tiers based on their full feature profile.

This approach was chosen over supervised classification after evaluating the available training data — see [Why Not a Classifier?](#why-not-a-classifier) below.

---

## Feature Engineering

Source: `services/ml-engine/app/features/compute.py`

Features are computed over a rolling **90-day window** from `datasets.raw_events`. All 3,220 US counties are included via a LEFT JOIN from `geography.counties` — counties with no events in the window receive structural features (population, income) but zero hazard counts.

| Feature | Source | Description |
|---|---|---|
| `major_disaster_count` | FEMA OpenFEMA | Count of events classified as major or extreme severity — the strongest available signal that a county required a major federal response |
| `severe_weather_count` | NOAA (NWS) | Alert count in the window; reflects ongoing atmospheric hazard activity |
| `earthquake_count` | USGS | Number of earthquake events in the county region |
| `max_earthquake_magnitude` | USGS | Maximum magnitude of any earthquake in the window |
| `hazard_frequency_score` | All sources | `severity_weight_sum / window_days × 30` — rate of weighted hazard events per 30-day equivalent, normalizing for window length |
| `population_exposure` | Census × hazards | `population × hazard_frequency_score` — people exposed at the current rate of hazard activity; rate-normalized so a county with 90 days of data does not inflate over one with 30 days of identical intensity |
| `economic_exposure` | Census × hazards | `(median_income / 1000) × ln(population + 1) × hazard_frequency_score` — total economic activity at risk, scaling both income level and county size; log-population prevents large metros from dominating on size alone |
| `log_population` | Census | `ln(population + 1)` — inherent exposure scale; differentiates counties even in quiet periods |
| `income_vulnerability` | Census | `max(0, 1 − income / 120,000)` — lower-income counties score higher, reflecting reduced recovery capacity |

Features are stored in `risk.county_features` with a `window_days` column (default: 90) and `feature_date` for versioning.

---

## Model Training

Source: `services/ml-engine/app/scoring/train.py`

### Step 1 — Normalize features

All 9 features are normalized to [0, 1] using `sklearn.preprocessing.MinMaxScaler` fit on the current county feature set.

### Step 2 — Weighted composite score

Each normalized feature is multiplied by its expert-calibrated weight:

| Feature | Weight | Rationale |
|---|---|---|
| `major_disaster_count` | 22% | Ground truth — a FEMA declaration is the strongest signal a county needed a major response |
| `population_exposure` | 20% | A hazard over 2M people is categorically different from the same hazard over 20k |
| `hazard_frequency_score` | 12% | Persistent multi-hazard rate captures ongoing elevated conditions |
| `max_earthquake_magnitude` | 10% | Magnitude is a direct measure of seismic energy release |
| `severe_weather_count` | 10% | Alert frequency; intentionally reduced to avoid over-weighting dense tornado-watch grids (Dixie Alley) relative to actual confirmed impact |
| `economic_exposure` | 10% | Economic activity at risk, scaled by both income and population size |
| `earthquake_count` | 8% | Frequency of seismic activity independent of magnitude |
| `log_population` | 5% | Structural baseline — inherent exposure scale for counties in quiet periods |
| `income_vulnerability` | 3% | Equity signal; intentionally low so rural poverty does not outrank dense urban exposure |

Weights sum to 1.0 and are calibrated so that FEMA-confirmed outcomes and population scale dominate, while raw alert volume (which NOAA issues freely in high-watch corridors) does not inflate scores for counties with low confirmed impact.

### Step 3 — K-Means clustering

`KMeans(n_clusters=5, random_state=42)` is fit on the normalized feature matrix. Clusters are ranked at scoring time by their mean composite score so that:

- **Tier 1 — Minimal Activity** (lowest mean composite)
- **Tier 2 — Low Hazard**
- **Tier 3 — Moderate Exposure**
- **Tier 4 — Elevated Multi-Hazard**
- **Tier 5 — High-Risk Composite** (highest mean composite)

Tier labels are assigned deterministically based on rank order, not arbitrary cluster IDs, so they remain stable across model retrains.

### Step 4 — Artifact persistence

The trained artifact (scaler, kmeans model, weights, feature column list) is saved to `/artifacts/model_composite.joblib` via `joblib`. The model version is registered in `risk.model_versions` with metrics and the artifact path.

---

## Scoring

Source: `services/ml-engine/app/scoring/score.py`

For each county:

1. Load features from `risk.county_features` (latest `feature_date`, `window_days=90`)
2. Scale with the saved MinMaxScaler
3. Compute weighted composite score
4. **Percentile-rank normalization**: counties are ranked by composite score, then mapped to [0, 1] via `ranks² `(power transform). This produces a right-skewed distribution — approximately 50% low, 21% moderate, 16% elevated, 13% critical — matching how real risk indices are distributed nationally.
5. Multiply by 100 → `risk_score` in [0, 100]
6. Assign K-Means cluster → map to Tier 1–5 label
7. Compute confidence band (see below)
8. Upsert into `risk.scores`

### Risk Level Thresholds

| Score | Level |
|---|---|
| ≥ 75 | critical |
| ≥ 50 | elevated |
| ≥ 25 | moderate |
| < 25 | low |

### Top Drivers

For each county, the top 3 features by `normalized_value × weight` are stored as JSON in `risk.scores.top_drivers`. This drives the bar chart in the Explain panel.

---

## Confidence Band

The confidence band reflects how consistently the weighted features point in the same direction for a given county.

```
score_std = std(weighted_features) / max(raw_composite) × percentile_score × 0.4

conf_lower = clamp((percentile − score_std) × 100, 0, 100)
conf_upper = clamp((percentile + score_std) × 100, 0, 100)
```

- A **narrow band** means the county's hazard profile is internally consistent — features agree on the risk level.
- A **wide band** means features pull in different directions (e.g. high earthquake exposure but low weather activity) — the score is a less certain estimate.

---

## Why Not a Classifier?

A supervised classifier (e.g. random forest, gradient boosting) was evaluated and rejected for the following reasons:

**Label sparsity**: FEMA major disaster declarations in a 90-day trailing window yield fewer than 1 positive label per county per year. In any given scoring run, fewer than 1% of counties have a positive label. A classifier trained on this data learns almost nothing useful and will predict "no disaster" for all counties with near-perfect accuracy while providing zero signal.

**Label lag**: FEMA declarations are often issued weeks to months after the event. The label date does not match the risk window being scored.

**Explainability requirement**: PRISM requires every score to be attributable to named, interpretable features. Black-box ensemble methods require post-hoc explanation (SHAP, LIME) that adds complexity and reduces auditability.

**Industry precedent**: The FEMA National Risk Index, NOAA Storm Data, and other authoritative risk indices use composite index methodology for exactly these reasons. PRISM follows that precedent.

---

## Model Update Cadence

In the current implementation, the pipeline is triggered on demand:

```
POST /ingest   → pull latest events
POST /features → recompute county features
POST /train    → refit scaler + K-Means, register new model version
POST /score    → score all counties under the new model version
```

For a production agency deployment, the recommended cadence is daily ingestion and scoring with weekly model retraining.

---

## Expansion Path

### Infrastructure Vulnerability Modeling

The current feature set captures hazard exposure (what events happened) and population exposure (who is affected). A key missing dimension is **infrastructure vulnerability** — how resilient is the county's physical infrastructure to those hazards.

Planned additions to `risk.county_features`:

| Feature | Source | Description |
|---------|--------|-------------|
| `critical_facilities_at_risk` | HIFLD (DHS) | Hospitals, power plants, water treatment within flood/fire zones |
| `road_network_disruption_score` | TIGER + FEMA flood zones | % of major roads in high-hazard zones |
| `housing_age_index` | ACS B25035 | Median housing age — proxy for building code compliance |
| `levee_proximity_score` | USACE NLD | Proximity to aging or unaccredited levees |
| `utility_grid_exposure` | EIA | Power transmission lines in severe weather corridors |

These features are all available from free federal datasets and would plug into the existing `compute.py` feature engineering pipeline as additional columns in `risk.county_features`. No model architecture changes are required — the composite weighting step accommodates additional features by adding weights that sum to 1.

### Multi-Hazard Fusion Engine

PRISM's current feature engineering already performs implicit multi-hazard fusion — `hazard_frequency_score` aggregates events across FEMA, NWS, and USGS sources into a single per-capita rate. The next step is an explicit **hazard interaction model** that captures compounding effects:

```
Current:    score = w₁·weather + w₂·earthquake + w₃·population + ...
            (hazards treated as independent)

Phase 2:    score = composite_index + interaction_terms
            interaction_terms = f(drought × wildfire, flood × landslide, ...)
```

For example, a drought simultaneously elevates wildfire risk and weakens soil stability for landslides. These compound hazard pairs are documented in FEMA's Multi-Hazard Mitigation Planning guidance and could be modeled as multiplicative interaction features.

The current pipeline architecture (feature matrix → composite weights → K-Means) is the natural foundation for this — interaction terms are additional columns in `risk.county_features` computed before the weighting step.

### Predictive Seasonal Outlook Modeling

Current scoring is retrospective: it reflects the past 90 days of events. A seasonal outlook model would extend scoring to **forward-looking time horizons**.

Approach:

```
Historical feature vectors (3–5 years)
    + Seasonal climate indices (ENSO, PDO, AMO)
    + NOAA seasonal outlook probabilities
    + USGS groundwater levels (drought proxy)
    ↓
Time-series model (ARIMA or LSTM per hazard type)
    ↓
Forecast feature vectors for 30/60/90 days ahead
    ↓
Scored through existing composite index → risk.scores
    (with forecast_horizon column added to differentiate)
```

The UI already has the historical trend chart infrastructure in the Explain panel — the same component would render both historical trend and forecast horizon with a clear visual boundary at "today."

NOAA publishes monthly [Climate Outlooks](https://www.cpc.ncep.noaa.gov/products/predictions/long_range/) for temperature and precipitation probability at the climate division level, which can be disaggregated to county FIPS using existing Census geographic mappings.
