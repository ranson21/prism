# PRISM — Demo Script & Talking Points

**Core narrative:** *"Where should we act right now — and why?"*

Aim for 5 minutes end-to-end. Each scene has the URL to be on, the action to take, and the talking point to deliver.

---

## Setup (Before You Start)

- Site open at `http://localhost` (port 80)
- Dashboard ready at `http://localhost:3000` (open in a background tab)
- All services running (`make docker-up`)
- Do not pre-select any county or scenario

---

## Scene 0 — Open on the Site (30 seconds)

**URL:** `http://localhost`

**Action:** Let the site hero load. Don't click anything yet.

> "Before I open the live system, let me show you the problem we're solving."

**Action:** Scroll slowly through the Problem section — three cards: Fragmented Data, Reactive Not Proactive, No Explainability.

> "Emergency managers are pulling from dozens of disconnected systems — FEMA declarations, weather alerts, earthquake feeds — and losing critical hours assembling a picture. Decisions about where to send resources happen after the damage is done. And when a risk score does exist, nobody can explain what's driving it."

**Action:** Scroll to the Solution section. Pause on the mock rankings table.

> "PRISM changes that. One platform. Every county. Explainable scores. This is what it looks like."

**Action:** Click **"Open Live Dashboard"** button.

---

## Scene 1 — The National Situation Board (1 minute)

**URL:** `http://localhost:3000`

**Action:** Let the map load fully. Point to the color-coded counties.

> "This is a live risk ranking of all 3,220 US counties — green low, yellow moderate, orange elevated, red critical. Every county is scored, not just the ones that have had recent events."

**Action:** Point to the summary bar distribution counts at the top.

> "Right now we have [X] critical counties and [X] elevated. That distribution updates every time we pull fresh data from FEMA, NWS, and USGS."

**Action:** Point to the rankings table.

> "The table gives you the ranked priority list. Highest risk at the top. Each row shows the score, the risk level, and the dominant factors. This is the prioritized list your EOC needs before a major weather event."

---

## Scene 2 — Drill Into One County (1.5 minutes)

**Action:** Click a critical (red) county on the map. The Explain panel opens.

> "I clicked [County Name], [State]. Risk score [X] out of 100. Let me show you what's driving it."

**Action:** Point to the top drivers bar chart.

> "Severe weather activity is the dominant driver — [N] active NWS alerts in the trailing 90 days. Hazard frequency is second, population exposure third. These aren't black-box outputs — every bar traces back to a specific public data source."

**Action:** Point to the confidence band.

> "The confidence band tells you how certain the model is. Narrow means the signals agree strongly. Wide means the inputs are pulling in different directions — treat it as a directional estimate and apply your local knowledge."

**Action:** Point to the K-Means tier badge next to the risk level.

> "This county is in [Tier N — Label]. That's a peer group — counties with the same hazard profile nationally. Not just a high score in isolation."

**Action:** Click the **History** tab.

> "Six months of trend data. [County] has been [rising/holding/declining]. First score [X], current [Y] — a [+/-Z] point shift. This is an early warning signal. We can see which counties are accumulating risk before they make the news."

---

## Scene 3 — Scenario Simulation & Resource Pre-Positioning (1.5 minutes)

**Action:** Click anywhere on the map to deselect. Focus on the Scenario Simulator panel.

> "Now — what happens *before* a major event? PRISM includes a scenario simulator for pre-positioning decisions."

**Action:** Click the **"Category 5 Hurricane"** preset.

> "Category 5 hurricane — 3.5× severity applied to current baseline scores."

**Action:** Set the **Resource Units** slider to 50. Click **"Run Simulation."**

**Action:** Scroll through the results list while talking.

> "In under a second — [N] counties affected. Let me show you the pre-positioning output."

**Action:** Point to **DEPLOYED** badges (green).

> "PRISM allocated the 50 teams to the 50 highest-risk counties under this scenario. Green DEPLOYED badge — a team is assigned."

**Action:** Point to **UNMET** badges (amber).

> "Amber UNMET — this county needs a resource but we've run out of capacity. That's your ask to leadership: here are the exact counties that still need coverage, and here's how many more teams it takes to close that gap. The briefing is already written."

---

## Scene 4 — Back to the Site: The Adoption Story (30 seconds)

**Action:** Switch back to `http://localhost` in the background tab. Scroll to the **How It Works** section.

> "Everything you just saw runs on public data — FEMA, NWS, USGS, Census. No proprietary feeds, no black box. The scoring methodology follows the FEMA National Risk Index. Every score is auditable and traceable."

**Action:** Scroll to the **Explainability** carousel — let it cycle through a county card.

> "This is what your analysts see for any county in the country. Score, confidence, top drivers, trend — all in one view. Built for human judgment, not to replace it."

---

## Closing (15 seconds)

> "PRISM answers the question every EOC faces before a disaster: *where should we act right now, and why?* Public data. Explainable scores. A resource allocation model that helps planners defend every decision. Thank you."

---

## URL Quick Reference

| What | URL |
|---|---|
| Landing site (entry point) | `http://localhost` |
| Live dashboard | `http://localhost:3000` |
| ML Engine API | `http://localhost:8001/docs` |

---

## Handling Common Questions

**"How current is the data?"**
> "Ingestion pulls live from FEMA, NWS, and USGS on demand. In production we'd run that on a daily schedule — scores refreshed every morning before the ops briefing."

**"Why not a machine learning prediction model?"**
> "We evaluated a supervised classifier. FEMA declarations lag events by weeks to months — there aren't enough positive labels in a 90-day window to train a reliable model. The composite index approach is what FEMA itself uses for the National Risk Index. We do use K-Means clustering as a genuine ML layer for risk tier assignment."

**"What about territories — Puerto Rico, Guam?"**
> "Current coverage is the 50 states. Adding territories is on the roadmap — it's a data availability question per connector, not an architecture change."

**"How do you handle equity and bias?"**
> "Income vulnerability is explicitly modeled as a risk amplifier — lower-income counties score higher to reflect reduced recovery capacity. It's documented in our Responsible AI section and visible in the About panel."

**"Could this integrate with our existing EOC tool?"**
> "Yes — the Go API exposes a clean REST interface. Any tool that can consume JSON can pull ranked county data and scenario outputs. Phase 1 of the agency pilot is exactly that integration."

---

## Key Numbers

| Metric | Value |
|---|---|
| Counties scored | 3,220 |
| Data sources | 4 (FEMA, NWS, USGS, Census) |
| Features per county | 8 |
| Risk tiers (K-Means) | 5 |
| Scenario runtime | < 1 second |
| History depth (demo) | 6 months |
| Resource units (demo) | 50 |
| Site port | 80 |
| Dashboard port | 3000 |
