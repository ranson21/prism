"""
Seed scenarios.definitions with realistic demo scenarios.

Pre-populates four named scenarios so the DB has meaningful definitions
for demo and testing purposes before any user runs a simulation.

Run after the stack is up and counties are seeded:
    poetry run python -m app.scenarios.seed_scenarios
"""

import asyncio
import json
import logging

from app.db import close_pool, get_conn, init_pool

log = logging.getLogger(__name__)

SCENARIOS = [
    {
        "name": "Category 5 Hurricane — Gulf Coast",
        "description": (
            "Simulates a Category 5 hurricane making landfall along the Gulf Coast. "
            "Models extreme wind, storm surge, and flooding impacts across coastal counties."
        ),
        "created_by": "demo",
        "parameters": {
            "hazard_type": "hurricane",
            "severity_multiplier": 3.5,
            "region": "gulf_coast",
            "time_horizon_days": 7,
        },
    },
    {
        "name": "Major Earthquake Swarm — Pacific Northwest",
        "description": (
            "Models a sustained earthquake swarm along the Cascadia Subduction Zone. "
            "High-severity seismic activity affecting Washington, Oregon, and Northern California."
        ),
        "created_by": "demo",
        "parameters": {
            "hazard_type": "earthquake",
            "severity_multiplier": 4.0,
            "region": "pacific_northwest",
            "time_horizon_days": 14,
        },
    },
    {
        "name": "Severe Multi-State Drought",
        "description": (
            "Extended drought conditions across the Central and Southern Plains. "
            "Models compound risk from water scarcity, agricultural failure, and wildfire exposure."
        ),
        "created_by": "demo",
        "parameters": {
            "hazard_type": "drought",
            "severity_multiplier": 2.0,
            "region": "central_plains",
            "time_horizon_days": 90,
        },
    },
    {
        "name": "Widespread Flooding Event — Midwest",
        "description": (
            "Simulates prolonged heavy rainfall causing widespread river flooding across "
            "the Midwest. Models levee stress, infrastructure damage, and displacement risk."
        ),
        "created_by": "demo",
        "parameters": {
            "hazard_type": "flooding",
            "severity_multiplier": 2.5,
            "region": "midwest",
            "time_horizon_days": 10,
        },
    },
]


async def seed() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
    await init_pool()

    try:
        async with get_conn() as conn:
            inserted = 0
            skipped = 0
            for s in SCENARIOS:
                row = await (await conn.execute(
                    "SELECT id FROM scenarios.definitions WHERE name = %s",
                    [s["name"]],
                )).fetchone()
                if row:
                    log.info("skip (already exists): %s", s["name"])
                    skipped += 1
                    continue

                await conn.execute(
                    """
                    INSERT INTO scenarios.definitions (name, description, created_by, parameters)
                    VALUES (%s, %s, %s, %s)
                    """,
                    [s["name"], s["description"], s["created_by"], json.dumps(s["parameters"])],
                )
                log.info("inserted: %s", s["name"])
                inserted += 1

        log.info("done — %d inserted, %d skipped", inserted, skipped)
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(seed())
