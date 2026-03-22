"""
Seed historical risk scores for demo purposes.

Generates 6 months of backdated scores by applying a random walk over
the current scores. This gives decision-makers a realistic trend to compare
against the current prediction.

Run once after scoring:
    poetry run python -m app.scoring.seed_history
"""

import asyncio
import logging
import random
from datetime import date, timedelta

from app.db import close_pool, init_pool, get_conn

log = logging.getLogger(__name__)

# Generate scores for the past N months (one per month, on the 1st)
HISTORY_MONTHS = 6

# Max score drift per month (random walk step size)
DRIFT_PER_MONTH = 8.0


def _risk_level(score: float) -> str:
    if score >= 75:
        return "critical"
    if score >= 50:
        return "elevated"
    if score >= 25:
        return "moderate"
    return "low"


async def seed_history() -> None:
    async with get_conn() as conn:
        # Get active model version
        row = await (await conn.execute(
            "SELECT id FROM risk.model_versions WHERE active = true LIMIT 1"
        )).fetchone()
        if not row:
            raise RuntimeError("No active model — run /train first")
        model_version_id = str(row[0])

        # Get all current scores (most recent date)
        cur = await conn.execute(
            """
            SELECT fips_code, risk_score
            FROM risk.scores
            WHERE model_version_id = %s
              AND score_date = (SELECT MAX(score_date) FROM risk.scores WHERE model_version_id = %s)
            """,
            (model_version_id, model_version_id),
        )
        current_scores = {row[0]: float(row[1]) for row in await cur.fetchall()}

    if not current_scores:
        raise RuntimeError("No current scores found — run /score first")

    log.info("Seeding history for %d counties over %d months...", len(current_scores), HISTORY_MONTHS)

    today = date.today()
    # Build list of past month-start dates, oldest first
    history_dates = []
    for i in range(HISTORY_MONTHS, 0, -1):
        month = today.month - i
        year = today.year
        while month <= 0:
            month += 12
            year -= 1
        history_dates.append(date(year, month, 1))

    async with get_conn() as conn:
        cur = conn.cursor()
        rows_written = 0

        for fips, current_score in current_scores.items():
            # Random walk backwards from current score
            score = current_score
            dated_scores = []
            for d in reversed(history_dates):
                drift = random.uniform(-DRIFT_PER_MONTH, DRIFT_PER_MONTH)
                score = max(0.0, min(100.0, score - drift))  # reverse walk = subtract drift
                dated_scores.append((d, round(score, 2)))
            dated_scores.reverse()  # oldest → newest

            for score_date, risk_score in dated_scores:
                level = _risk_level(risk_score)
                await cur.execute(
                    """
                    INSERT INTO risk.scores
                        (fips_code, model_version_id, score_date, risk_score, risk_level, top_drivers)
                    VALUES (%s, %s, %s, %s, %s, '[]'::jsonb)
                    ON CONFLICT (fips_code, model_version_id, score_date) DO NOTHING
                    """,
                    (fips, model_version_id, score_date, risk_score, level),
                )
                rows_written += 1

        await conn.commit()

    log.info("Seeded %d historical score rows.", rows_written)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    from dotenv import load_dotenv
    load_dotenv()

    async def main() -> None:
        await init_pool()
        try:
            await seed_history()
        finally:
            await close_pool()

    asyncio.run(main())
