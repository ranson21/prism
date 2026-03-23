# PRISM — Demo Script & Talking Points

**Core narrative:** *"Where should we act right now — and why?"*

Aim for 5 minutes end-to-end. Read the quoted lines as written. Actions tell you exactly what to click or scroll to. Notes in *italics* are context for you — don't say them out loud.

---

## Before You Present — Technical Setup

**Have a technical team member do this before you walk in the room:**

1. Start all services: `make docker-up` (takes about 30 seconds)
2. Open two browser tabs:
   - Tab 1: `http://localhost` — the landing site
   - Tab 2: `http://localhost:3000` — the live dashboard
3. On Tab 2, confirm the map has loaded and counties are color-coded
4. Do not pre-select any county or scenario

**If anything looks broken**, refresh the page and wait 10 seconds. If it's still broken, call in the technical team member.

---

## Scene 0 — Open on the Landing Site (30 seconds)

**Switch to Tab 1.** Let the page load fully. Don't click anything yet.

> "Before I open the live system, let me show you the problem we're solving."

**Scroll slowly** through the three problem cards on the page.

> "Emergency managers are pulling from dozens of disconnected systems — FEMA disaster declarations, weather alerts, earthquake feeds — and losing critical hours assembling a picture. Decisions about where to send resources happen after the damage is done. And when a risk score does exist, nobody can explain what's driving it."

**Scroll** to the Solution section. Pause on the mock rankings table.

> "PRISM changes that. One platform. Every county in the country. Scores you can explain. This is what it looks like."

**Click** the **"Open Live Dashboard"** button.

---

## Scene 1 — The National Situation Board (1 minute)

*You are now on Tab 2 — the live dashboard.*

**Let the map finish loading.** Point to the color-coded counties.

> "This is a live risk ranking of all 3,220 US counties — green is low risk, yellow moderate, orange elevated, red critical. Every single county is scored. Not just the ones that have had recent events."

**Point to the summary numbers** across the top of the screen.

> "Right now we have [read the number] critical counties and [read the number] elevated. That distribution updates every time we pull fresh data from federal disaster systems, the National Weather Service, and earthquake monitoring."

**Point to the ranked list** on the side.

> "The table gives you the prioritized action list. Highest risk at the top. Each row shows the score, the risk level, and the single biggest factor driving it. This is the briefing your Emergency Operations Center needs before a major weather event — and it takes seconds to generate."

---

## Scene 2 — Drill Into One County (1.5 minutes)

**Click any red county on the map.** The detail panel opens on the right.

> "I clicked [say the county name shown]. Risk score [say the number] out of 100. Let me show you what's driving it."

**Point to the bar chart** in the panel.

> "Severe weather activity is the top driver — [say the number] active weather alerts in the last 90 days. Hazard frequency is second, population exposure third. These aren't black-box outputs — every bar traces directly back to a public data source that any agency can independently verify."

**Point to the colored range bar** just below the score.

> "This band shows how confident the system is in that score. A tight band means all the signals are pointing the same direction — high confidence. A wide band means the signals are mixed — treat it as a directional estimate and layer in your local knowledge."

**Point to the tier label** next to the risk level. *It will say something like "Tier 4 — Elevated Multi-Hazard."*

> "The tier label puts this county in context nationally. It means this county's overall hazard profile is similar to other high-risk counties across the country — not just a high score in isolation."

**Click the History tab** in the panel.

> "Six months of trend data. This county has been [rising / holding / declining]. First score [X], current [Y] — a [say the change] point shift. This is the early warning signal. We can see which counties are accumulating risk before they make the news."

---

## Scene 3 — Scenario Simulation & Resource Pre-Positioning (1.5 minutes)

**Click anywhere on the map** to close the county panel. **Find the Scenario Simulator** panel.

> "Now — what happens before a major event strikes? PRISM includes a scenario simulator built specifically for pre-positioning decisions."

**Click the "Category 5 Hurricane" preset.**

> "Category 5 hurricane scenario. PRISM applies the expected severity increase across every county in the affected region."

**Set the Resource Units slider to 50. Click "Run Simulation."**

**Scroll through the results list** while talking.

> "In under a second — [N] counties affected. Here's the pre-positioning output."

**Point to the green DEPLOYED badges.**

> "Green means a resource team has been assigned. PRISM allocated the 50 teams to the 50 highest-risk counties under this scenario."

**Point to the amber UNMET badges.**

> "Amber UNMET means this county needs a resource but we've run out of capacity. That's not a failure — that's the briefing. Here are the exact counties still uncovered, and here is exactly how many more teams it takes to close that gap. The ask to leadership is already written."

---

## Scene 4 — The Adoption Story (45 seconds)

**Switch back to Tab 1** — the landing site. **Scroll to the How It Works section.**

> "Everything you just saw runs on public data — federal disaster declarations, the National Weather Service, USGS earthquake monitoring, Census demographics. No proprietary feeds. No black box. The scoring methodology is the same approach FEMA uses for its own National Risk Index."

**Scroll to the Explainability carousel** — let it cycle through a county card automatically.

> "This is what any analyst in your agency would see for any county in the country. Score, confidence range, top drivers, historical trend — all in one view. Built for human judgment, not to replace it."

**Switch to Tab 2.** **Click "About / Agency Pilot"** in the dashboard header.

> "The adoption path is already designed. Phase 1 connects to your agency's real-time feeds and pushes ranked county alerts directly into your EOC workflow. Phase 2 adds satellite imagery, infrastructure vulnerability modeling, and forward-looking seasonal outlooks."

**Close the About panel. Pause.**

> "One more thing — this is not a prototype that needs six months to harden before it can go anywhere. The entire cloud infrastructure is defined as code. We deployed a production-grade AWS environment — load balancer, private database, container services, security controls — with a single command. On day one of an agency engagement, we can have a live instance running on FedRAMP-authorized government cloud infrastructure without writing a single line of new deployment code."

---

## Closing (15 seconds)

> "PRISM answers the question every EOC faces before a disaster: *where should we act right now, and why?* Public data. Explainable scores. A resource allocation model that helps planners defend every decision. Thank you."

---

## URL Quick Reference

| What | URL |
|---|---|
| Landing site | `http://localhost` |
| Live dashboard | `http://localhost:3000` |

---

## Handling Common Questions

**"How current is the data?"**
> "We pull live from federal disaster systems, the National Weather Service, and USGS earthquake monitoring. In a production deployment that runs on a daily schedule — scores refreshed every morning before the ops briefing."

**"Is this actually using AI or machine learning?"**
> "Yes — we use an unsupervised machine learning technique called clustering to group all 3,220 counties into five risk tiers based on their full hazard profile. On top of that, every score is built from a weighted composite of eight real data features — the same methodology FEMA uses for its National Risk Index."

**"Why doesn't it just predict where the next disaster will happen?"**
> "Because no system can do that reliably — and any system that claims to is misleading you. FEMA's own disaster declaration data lags the actual event by weeks or months, so there's no reliable ground truth to train a prediction model on. PRISM does something more honest and more useful: it shows you where the risk signals are highest right now, so you can act before the crisis, not after."

**"What about territories — Puerto Rico, Guam?"**
> "Current coverage is the 50 states. Adding territories is on the roadmap — it's a data availability question, not an architecture change."

**"How do you handle fairness — are lower-income communities treated differently?"**
> "Yes, intentionally. Lower income is explicitly built into the score as a risk amplifier — counties with less financial resilience rank higher, because they have less capacity to prepare, evacuate, and recover. It's visible in the model and documented in our Responsible AI commitments."

**"Could this work with our existing EOC tools?"**
> "Yes — the system exposes a standard REST API. Any tool that can read a data feed can pull the ranked county list and scenario outputs. The architecture is already designed for that integration — the Phase 1 roadmap is exactly that connection."

**"How fast could you actually deploy this for a real agency?"**
> "The infrastructure is already cloud-native and defined entirely as code — Terraform and Terragrunt manage every resource. We've already deployed a working AWS environment as part of this project. Deploying to a FedRAMP-authorized government cloud is the same process with different environment variables. It's a matter of days, not months."

---

## Key Numbers to Know

| What | Number |
|---|---|
| Counties scored | 3,220 (all US counties) |
| Data sources | 4 — FEMA, National Weather Service, USGS, US Census |
| Risk factors tracked per county | 8 |
| Risk tiers | 5 (Minimal → Low → Moderate → Elevated → High-Risk) |
| Scenario runtime | Under 1 second |
| Trend history shown | 6 months |

---

## Jargon Cheat Sheet

If a judge uses one of these terms, here's the plain-language version:

| Term | Say this instead |
|---|---|
| Composite index | A weighted score built from multiple real data inputs |
| K-Means clustering | A machine learning technique that groups similar counties together |
| Confidence band | The range bar showing how certain the score is |
| Risk tier | The peer group label — counties with similar hazard profiles |
| Feature | A specific data input used to compute the score (e.g., severe weather alert count) |
| Infrastructure as Code (IaC) | The entire cloud setup is scripted — deployable with one command |
| FedRAMP | The US government's security certification for cloud software |
| ECS / Fargate | AWS managed container hosting — no servers to manage |
| REST API | A standard interface other software can connect to |

---

## Documentation Reference (for Judges)

Full technical documentation is in the `docs/` folder:

| Document | What it covers |
|---|---|
| [`docs/architecture.md`](architecture.md) | System diagram, data flow, cloud deployment path, EOC integration design |
| [`docs/ml_pipeline.md`](ml_pipeline.md) | Scoring methodology, feature weights, risk tier assignment, confidence bands |
| [`docs/data_pipeline.md`](data_pipeline.md) | Data connector architecture, normalization, expansion path |
| [`docs/responsible_ai.md`](responsible_ai.md) | Responsible AI commitments, data limitations, human-in-the-loop policy |
| [`docs/agency_pilot_brief.md`](agency_pilot_brief.md) | Executive briefing, Phase 1–2 adoption roadmap |
| [`SETUP.md`](../SETUP.md) | Local setup and AWS deployment instructions |
