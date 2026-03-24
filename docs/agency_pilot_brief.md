# PRISM — Path to Agency Pilot
### 5-Minute Briefing for Emergency Management Decision-Makers

---

## The Problem

Every major disaster reveals the same gap.

Emergency management agencies have access to more data than ever — FEMA declarations, weather alerts, earthquake feeds, Census demographics. But that data lives in siloed systems with no shared picture of where risk is actually highest *right now*.

The result: resource pre-positioning decisions are made reactively, under pressure, with incomplete information. When the storm makes landfall, it's too late to ask where the most vulnerable counties were.

> **The question every Emergency Operations Center faces before a disaster:**
> *"Where should we send resources — and how do we justify that decision?"*

---

## The Solution: PRISM

**PRISM (Prioritization of Risk & Incident Support Model)** transforms public hazard data into a continuously updated, explainable county-level risk ranking — so decision-makers know where to act *before* the crisis begins.

### What PRISM Produces

| Output | Description |
|---|---|
| **Risk Score (0–100)** | Composite index for all 3,220 US counties, updated on demand |
| **Risk Tier (1–5)** | K-Means cluster assignment grouping counties by hazard profile |
| **Top Drivers** | The 3 specific factors most responsible for each county's score |
| **Confidence Band** | Uncertainty range so analysts know how much to weight each score |
| **Scenario Simulation** | Model hypothetical events and pre-position resources before they strike |

### What PRISM Is Not

PRISM does not predict that a disaster *will* happen. It identifies where observable risk signals are highest so planners can allocate limited resources to the right places at the right time.

---

## How It Works — In 60 Seconds

```
Public Data               PRISM                    Decision-Makers
──────────────            ──────────────────────   ────────────────────────
FEMA Declarations   →     Ingest + Normalize   →   Ranked county map
NOAA Weather Alerts →     Feature Engineering  →   Explainability panel
USGS Earthquakes    →     Composite Index      →   "Why is this county high?"
Census Population   →     K-Means Clustering   →   Scenario simulator
                          Confidence Bands     →   "What if a hurricane hits?"
                                               →   Resource pre-positioning
```

All data is public, all scoring is auditable, all outputs trace back to named factors.

---

## Live Demo Flow (5 Minutes)

**Two screens:** Landing site (`https://prod.d3vtja5wfwepyp.amplifyapp.com`) and dashboard (`https://prod.d3vtja5wfwepyp.amplifyapp.com/app`). Full documentation is at `https://prod.d3vtja5wfwepyp.amplifyapp.com/docs`.

### Minute 1 — Open on the Site, Then the Dashboard
Open the PRISM landing site. Scroll through the Problem section (fragmented data, reactive decisions, no explainability) to set the narrative. Click "Open Live Dashboard."

The map shows all 3,220 US counties color-coded by risk level — green to red. The summary bar shows the current national distribution: how many counties are critical, elevated, moderate, low.

*Talking point: "This is the shared operating picture your EOC doesn't have today."*

### Minute 2 — Drill Into a High-Risk County
Click a red county on the map. The Explain panel opens:
- Risk score with confidence band
- Bar chart of top 3 risk drivers
- Raw feature counts (severe weather alerts, earthquake events, disaster declarations)
- K-Means risk tier (e.g. "Tier 5 — High-Risk Composite")
- 6-month score history showing trend

*Talking point: "Every score is fully explainable. You can tell your stakeholders exactly why this county is ranked where it is."*

### Minute 3 — Historical Trend
Switch to the History tab. Show a county whose risk has been climbing over the past 6 months.

*Talking point: "This isn't a snapshot — it's a trend. PRISM lets you see which counties are getting worse before they make the news."*

### Minute 4 — Scenario Simulation
Open the Scenario Simulator. Select "Category 5 Hurricane" (3.5× severity). Set Resource Units to 50. Click Run.

Results show:
- Which counties spike to critical under this scenario
- Which 50 counties receive a resource team (DEPLOYED badge)
- Which counties have unmet need (UNMET badge)

*Talking point: "With 50 teams to pre-position, PRISM surfaces which counties have the highest projected need — giving leadership a data-backed starting point, and showing exactly where you'll fall short so they can make an informed call to request more."*

### Minute 5 — Back to the Site: The Adoption Story
Switch back to the landing site. Scroll to the Explainability carousel — let it cycle through a county card to show the score breakdown visually. Then scroll to the bottom CTA.

*Talking point: "Everything you've seen runs on public data and open-source infrastructure. The site is the public face — the dashboard is the operational tool. Phase 1 is connecting to your real-time feeds and pushing scored rankings into your EOC workflow."*

Click "About / Agency Pilot" in the dashboard header to close with the Phase 1 → Phase 2 roadmap.

---

## Path to Agency Pilot

### Phase 1 — Agency Integration (6–12 months)
- Connect to agency real-time weather feeds (NOAA / NWS WebSocket / streaming API)
- Push ranked county alerts into existing EOC workflow tools (push API or webhook)
- Add state and regional filtering for state emergency operations centers
- **Federate with agency SSO** — SAML 2.0 / OIDC integration with agency Active Directory (ADFS), Okta Federal, or Azure AD; PIV/CAC card support via agency IdP; Login.gov fallback; role-mapped county scope per analyst (see [`docs/architecture.md — Agency SSO Integration`](architecture.md))
- Deploy on FedRAMP-authorized cloud infrastructure (AWS GovCloud / Azure Government)
- Complete ATO (Authority to Operate) process with security controls documented (AC-2, IA-2 controls met by SSO federation)

### Phase 2 — Enterprise Disaster Intelligence (12–24 months)
- Satellite imagery integration for real-time damage assessment
- Infrastructure vulnerability modeling (power grid, roads, hospitals)
- Cross-agency data fusion (state, local, tribal, territorial feeds)
- Multi-hazard concurrent scenario simulation
- Predictive seasonal risk outlook (forward-looking horizons beyond 90 days)
- Secure multi-tenant deployment for multiple agency clients

---

## Responsible AI Commitments

PRISM was designed from the ground up to meet government AI transparency standards.

| Commitment | How PRISM Delivers |
|---|---|
| **Public data only** | FEMA, NWS, USGS, Census — fully auditable, no black-box sources |
| **Uncertainty shown** | Every score includes a confidence band; wide bands flag low-confidence estimates |
| **Explainable outputs** | Top 3 drivers shown for every county, traceable to raw source data |
| **Not deterministic** | Scores are relative risk estimates — PRISM never claims a disaster "will" happen |
| **Equity-aware** | Income vulnerability is explicitly modeled; lower-income counties are not penalized for lower hazard activity |
| **Human in the loop** | PRISM informs decisions — it does not automate them |
| **Auditable model** | Every model version, its parameters, and the scores it produced are versioned and stored |

Full documentation: [`docs/responsible_ai.md`](responsible_ai.md)

---

## Technical Credentials

| Dimension | Detail |
|---|---|
| **Coverage** | All 3,220 US counties scored |
| **Data freshness** | On-demand ingestion from live public APIs |
| **Methodology** | FEMA National Risk Index methodology (domain-weighted composite index) |
| **ML layer** | K-Means unsupervised clustering (scikit-learn) for risk tier assignment |
| **Infrastructure** | Containerized (Docker), cloud-native, Kubernetes-ready |
| **API** | REST JSON — integrates with any EOC tool that accepts a data feed |
| **Open source stack** | Go · Python · React · PostgreSQL — no vendor lock-in |

---

*Full technical documentation: [`docs/architecture.md`](architecture.md) · [`docs/ml_pipeline.md`](ml_pipeline.md) · [`docs/data_pipeline.md`](data_pipeline.md) · [`docs/responsible_ai.md`](responsible_ai.md) · [`SETUP.md`](../SETUP.md)*
