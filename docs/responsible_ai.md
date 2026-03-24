# PRISM — Responsible AI

## Principles

PRISM is built around five responsible AI commitments that apply to every score, every output, and every design decision.

---

## 1. Public Data Only

**What we use**: FEMA OpenFEMA API, NOAA / NWS Weather Alert API, USGS Earthquake Catalog, US Census Bureau ACS.

**What we do not use**: proprietary intelligence feeds, real-time 911 call data, social media signals, law enforcement data, or any non-public source.

Every data source is documented, freely accessible, and independently verifiable. Any agency or researcher can reproduce PRISM's inputs by querying the same public APIs.

**Limitation**: Public datasets have their own quality issues. FEMA disaster declarations lag the event by days to months. NOAA weather alerts may duplicate across overlapping zones. USGS earthquake data is highly reliable but does not cover all geologic hazard types. PRISM acknowledges these limitations rather than treating the data as ground truth.

---

## 2. Uncertainty Is Always Shown

Every county risk score is accompanied by a **confidence band** — a lower and upper bound that reflects how consistently the model's input features align.

- A **narrow band** means the county's hazard signals agree strongly (e.g. high earthquake frequency, high magnitude, high population exposure all point the same direction).
- A **wide band** means features pull in different directions — the score should be treated as a rough estimate and weighted against other domain knowledge.

PRISM never displays a bare number without its uncertainty range. Decision-makers should see both the score and its confidence context before acting.

---

## 3. Explainable Scores

Every county score is decomposable into named, interpretable factors. The top 3 risk drivers are surfaced for every county in the Explain panel, showing:

- **Which feature** contributed most (e.g. "Severe Weather Alerts")
- **What its contribution** was as a percentage of the total score
- **What its raw value** was (e.g. count of alerts in the 90-day window)

There are no hidden signals. The feature list, weights, and normalization procedure are documented in [`docs/ml_pipeline.md`](ml_pipeline.md) and the model artifact includes the full weight dictionary.

**K-Means tiers** (Tier 1–5) are also explainable: each tier represents a cluster of counties with similar hazard profiles, ranked from lowest to highest mean composite score. A county in Tier 5 shares a hazard profile with other high-risk counties — this provides a peer-group benchmark beyond the raw score.

---

## 4. Not Deterministic

PRISM does not predict that a disaster will happen. It estimates relative risk based on current observable signals.

The following language is prohibited in all PRISM outputs and documentation:

- "will happen"
- "guaranteed"
- "certain"
- "predicts disaster"

All scores are labeled as estimates. The Scenario Simulator explicitly labels outputs as "modeled risk signals — not guaranteed outcomes." The Responsible AI banner is displayed on every dashboard session until dismissed.

**What PRISM does claim**: that counties with higher scores have observable hazard signal patterns that historically correlate with higher disaster frequency. This is a relative ranking, not a probability of a specific event.

---

## 5. Equity-Aware Modeling

Risk does not affect all communities equally. A county with identical hazard exposure but lower income has less capacity to prepare, respond, and recover.

PRISM models this explicitly via the **income vulnerability** feature:

```
income_vulnerability = max(0, 1 − median_household_income / 120,000)
```

Lower-income counties receive a higher vulnerability score, reflecting reduced resilience capacity. This feature carries an 8% weight in the composite index.

**What this is not**: a proxy for racial or demographic composition. Income is used solely as a proxy for financial resilience capacity — the ability to purchase insurance, evacuate, or rebuild — which is a documented determinant of disaster impact severity in the emergency management literature.

**Limitation**: Income data from the Census ACS is a 1-year or 5-year estimate and may not reflect current economic conditions in rapidly changing communities. PRISM treats it as a directional signal, not a precise current measurement.

---

## Data Source Limitations

| Source | Known Limitations |
|---|---|
| FEMA Disaster Declarations | Lag of days to months post-event; only declared disasters are included, not near-misses |
| NOAA / NWS Alerts | Zone-based alerts may over-count for counties covered by multiple zones; alert threshold varies by local office |
| USGS Earthquakes | Completeness varies by region; offshore events mapped to nearest county may be imprecise |
| Census ACS | 1-year estimates unavailable for small counties; data is 1–5 years old |

---

## Model Auditability

The active model version, its feature columns, weights, training metrics, and artifact path are stored in `risk.model_versions`. A new version is registered on every retrain and the previous version is deactivated (not deleted). This provides a full audit trail of which model produced which scores.

Any score in `risk.scores` can be traced back to:
1. The model version that produced it (`model_version_id`)
2. The features used (`risk.county_features` for the same `fips_code` and `feature_date`)
3. The raw events underlying those features (`datasets.raw_events`)

---

## Accessibility & Color Design

PRISM's risk heatmap is designed to communicate hazard severity visually while remaining usable across a range of visual conditions.

**Color is never the only signal.** Every county's risk level is conveyed through multiple parallel channels:
- Hover tooltip: county name, numeric score, and text risk level badge
- Rankings table: fully text-based ranked list with labeled risk levels
- Explain panel: numeric score, confidence band, and named feature drivers

This satisfies Section 508 / WCAG 2.1 Success Criterion 1.4.1 — *Use of Color* — which requires that color not be the sole means of conveying information.

**Colorblind accommodation.** The map gradient uses a **teal → yellow → orange → red** scale rather than green → red. Teal carries significant blue channel content that red does not, making the low-to-critical range distinguishable under both deuteranopia (missing green cones) and protanopia (missing red cones). All five gradient stops meet WCAG AA 3:1 non-text contrast ratio against the dark map background (lowest measured: 3.98:1).

**Known limitation.** Orange (elevated, ~score 50) and red (critical, ~score 75+) can appear as similar brownish tones under deuteranopia. This is mitigated by the text-based channels above and the score number shown in the tooltip. A future improvement would shift elevated toward amber and critical toward rose/magenta to create greater hue separation at the warm end of the scale.

---

## Human-in-the-Loop

PRISM is designed for decision-support, not automated action. No PRISM output should directly trigger a resource deployment, evacuation order, or emergency declaration without human review.

The intended workflow:
1. PRISM identifies high-risk counties and surfaces the drivers
2. An emergency management analyst reviews the Explain panel and scenario outputs
3. The analyst cross-references with local knowledge, official advisories, and domain expertise
4. The analyst makes and documents the resource allocation decision
