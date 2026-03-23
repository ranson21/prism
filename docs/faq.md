# Presenter FAQ

Common questions from judges, agency partners, and technical reviewers — with direct, honest answers.

---

## Scoring & Risk Index

### What does a score of 100 mean? Is Honolulu really the most dangerous county in the US?

A score of 100 does **not** mean Honolulu will definitely have a disaster, or that it is objectively more dangerous in an absolute sense. It means Honolulu ranks **#1 among all 3,220 US counties** on a composite signal of current hazard data.

The score is a **relative urgency index**, not a probability. Think of it like a triage score in an emergency room: it tells you who needs attention first, not how sick someone is in absolute terms.

Honolulu reaches 100 because it simultaneously scores at or near the top nationally across multiple independent dimensions:

- **Seismic activity** — Hawaii sits on an active volcanic hotspot with frequent earthquakes at significant magnitudes
- **Severe weather events** — tropical systems, high surf, and storm frequency in the 90-day data window
- **Hazard frequency score** — persistent multi-hazard exposure, not a single event spike
- **Population exposure** — high-density coastal geography with limited evacuation routes

No other US county combines all of those signals at the same level in the current data window. That is what the 100 reflects.

### Why use a 0–100 index instead of a raw probability?

FEMA's own National Risk Index uses the same approach. There are three reasons:

1. **Disaster declarations in a 90-day window are too rare and delayed** to serve as reliable training labels for a probability model. A county can absorb a major event without a formal declaration for weeks.

2. **Explainability is a first-class requirement.** Every score must be traceable to named, auditable features. A raw ML probability is a black box to an emergency manager; a weighted composite with visible drivers is not.

3. **Relative ranking is what operations actually need.** When deciding where to pre-position response teams, decision makers need a ranked list — not a table of probabilities that are all below 5% and look identical.

The power-transform normalization is intentional: it compresses the bottom of the distribution (where ~50% of counties are genuinely low-risk) and creates meaningful separation at the top, where ~13% of counties (~420) surface as critical. That is a tractable triage list.

### What are the honest limitations of the score?

- **It reflects a 90-day data window.** A county quiet in the last 90 days scores lower than one with recent events, even if both are structurally equally exposed. PRISM is a current-conditions signal, not a long-run climate model.
- **The score is relative.** If every county in the US had a bad quarter simultaneously, all scores would redistribute — some would still show 100.
- **Income vulnerability is a structural proxy.** It captures which populations have less capacity to absorb impact, but it is not a direct measure of infrastructure resilience.
- **Data coverage is uneven.** NOAA weather alerts and USGS earthquake data have strong national coverage. FEMA declaration data lags real-world events by days to weeks.

---

## Scenario Simulator

### What does the scenario simulator actually do right now?

The current simulator models **resource allocation stress** under a user-defined severity multiplier. Given a set of selected counties and a multiplier (e.g., 1.5× — a moderate escalation):

1. It applies the severity multiplier to the baseline risk score for each selected county
2. It distributes available `resource_units` across those counties proportional to their escalated scores
3. It identifies counties where need exceeds allocated resources (`unmet_need: true`)
4. It returns a side-by-side comparison: baseline score vs. simulated score, with resource allocation breakdown

This is useful for answering: *"If conditions in these counties escalate by 50%, do we have enough pre-positioned resources to cover them, and which counties would be left under-served?"*

### What is the planned improvement to the simulator?

The current model applies a uniform multiplier and is county-selection-driven. The planned upgrade models an **event-driven simulation**:

- A user selects a **disaster type** (hurricane, earthquake sequence, flooding event) and an **impact region** (drawn on the map or selected by state/county)
- The simulator estimates **feature-level impacts** for that event type — e.g., a hurricane would raise `severe_weather_count`, `hazard_frequency_score`, and `population_exposure` for affected counties by modeled amounts
- Those feature changes flow through the full scoring pipeline, producing **updated risk scores for all counties** — including non-impacted ones whose relative ranking shifts as the impacted counties move up
- The output shows the **national redistribution of risk**: which counties' resource need increases, which drops, and what the aggregate unmet need looks like if current resources stay fixed

This gives decision makers a genuine answer to: *"If a Category 3 hurricane makes landfall in these Gulf Coast counties, where does that leave the rest of the national resource picture?"*

### Why does the risk score of a non-impacted county change when a distant county is simulated?

Because the scoring is **percentile-based**. All counties are ranked against each other. If a simulated event pushes a group of counties dramatically higher, their movement up the ranking compresses the scores of nearby counties in the distribution — the same way a new entrant at the top of a leaderboard shifts everyone else down one position.

This is a feature, not a bug: it mirrors how real resource allocation works. A major event in Louisiana doesn't just create need there — it also draws national resources away from counties that otherwise would have received pre-positioning. PRISM's score reflects that competitive dynamic.

---

## Geographic Patterns

### Why is so much of Mississippi, Alabama, Tennessee, and Kentucky showing as critical?

This is real data, not a model artifact — but it needs context.

These states sit in **"Dixie Alley"**, a severe weather corridor that actually produces more tornado fatalities annually than the Great Plains. NOAA issues an extraordinary volume of tornado watches, severe thunderstorm warnings, and flash flood alerts here. In the current data window, Mississippi has zero low-risk counties and 61% critical — that reflects genuine NOAA alert density, not a scoring mistake.

The honest limitation is that PRISM scores **alert frequency, not confirmed impact**. A county can receive 31 tornado watches in 90 days with zero confirmed touchdowns. `hazard_frequency_score` captures how often NOAA is issuing alerts for a county, not whether those events materialized into disasters or declarations.

A planned refinement is to weight active FEMA declarations more heavily relative to watch/warning counts — so that a county with high alert frequency but zero declarations scores lower than one where events converted into real federal responses.

### Why is most of Texas green when it has hurricanes and tornadoes?

**Houston (Harris County) is correctly flagged critical** — score 87, driven by its massive population exposure. The broader Texas greenness reflects that most of the state's 254 counties are geographically large, arid, or semi-arid with low NOAA alert activity in the current 90-day window. West Texas is desert. South Texas is dry. Most of the Panhandle is sparsely populated.

The more important point: **this is a snapshot, not a permanent state.** During hurricane season, Gulf Coast Texas counties would spike dramatically as National Hurricane Center watches are issued. The model would activate correctly in real-time — a quiet window in February looks calm because it was calm.

### Why is Oregon all green? The Cascadia Subduction Zone is one of the biggest earthquake risks in North America.

This is the most important limitation to acknowledge directly.

Every Oregon county scores low — Portland, Eugene, the entire coast. Lane County (Eugene) shows zero severe weather events, zero earthquake events, zero hazard frequency in the current window. The Cascadia Subduction Zone is capable of a M9.0 event that hasn't occurred in centuries, and PRISM gives it no credit for that risk.

This is the **"quiet hazard" problem**: PRISM scores current-conditions activity. If nothing has happened recently, the score is low regardless of structural geological risk. This is a genuine design limitation, not something fixed by reweighting.

The honest framing: PRISM is designed to answer *"where are conditions active right now"* — not *"where is long-run structural risk highest."* That is FEMA's National Risk Index's job. PRISM is built to complement structural assessments, not replace them. In the roadmap, incorporating USGS probabilistic seismic hazard maps as a permanent baseline feature layer would address the quiet-hazard gap for Oregon, the Pacific Northwest, and the New Madrid Seismic Zone.

---

## Data & Methodology

### Where does the data come from?

| Source | Data | Update Cadence |
|--------|------|---------------|
| FEMA OpenFEMA | Disaster declarations, individual assistance registrations | Near-real-time |
| NOAA (National Weather Service) | Severe weather alerts by county | Near-real-time |
| USGS Earthquake Catalog | Seismic events with magnitude and location | Near-real-time |
| US Census | County population, median household income | Annual |

All data sources are public, freely available, and fully cited. PRISM does not use proprietary or purchased data.

### How often are scores updated?

Scores are computed on demand by re-running the ingestion → features → score pipeline. In production, this would run on a scheduled cadence (daily or on significant-event triggers). The current deployment reflects the last pipeline run.

### Could this be gamed or manipulated?

All input data is from official government sources (FEMA, NOAA, USGS) that PRISM reads but does not write. There is no mechanism for a county or agency to influence their own score. The methodology, weights, and feature definitions are fully documented and auditable in the [ML Pipeline](./ml_pipeline.md) doc.

---

## Responsible AI

### Does PRISM make decisions?

No. PRISM is a **decision-support tool**, not a decision-making system. It surfaces ranked risk signals and explains why they are ranked that way. Every output is framed as a recommendation for human review, not an automated action.

See [Responsible AI](./responsible_ai.md) for the full commitments on transparency, equity, and uncertainty communication.
