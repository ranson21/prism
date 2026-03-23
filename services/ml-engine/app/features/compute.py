"""
Feature engineering: raw_events → county_features.

For every county in geography.counties (whether or not it has recent events):
  - disaster_count / major_disaster_count
  - severe_weather_count
  - earthquake_count / max_earthquake_magnitude
  - population_exposure  (population × hazard_frequency_score — rate-adjusted exposure)
  - hazard_frequency_score  (weighted events per 30 days)
  - log_population       (ln(population + 1) — inherent exposure scale)
  - income_vulnerability (1 − income/120000 — lower income → higher vulnerability)

Severity weights: minor=1, moderate=2, major=3, extreme=4
"""

import asyncio
import logging
import math
from datetime import date, datetime, timedelta, timezone

import psycopg
from psycopg.types.json import Jsonb

from app.db import get_conn, init_pool, close_pool

log = logging.getLogger(__name__)

_SEVERITY_WEIGHT = {"minor": 1, "moderate": 2, "major": 3, "extreme": 4}
_DEFAULT_WINDOW_DAYS = 90


async def compute_features(
    window_days: int = _DEFAULT_WINDOW_DAYS,
    feature_date: date | None = None,
) -> int:
    """
    Compute and upsert county feature vectors for the given window.

    Args:
        window_days: Look-back window in days.
        feature_date: The date the features represent. Defaults to today.

    Returns:
        Number of county feature rows written.
    """
    if feature_date is None:
        feature_date = datetime.now(tz=timezone.utc).date()

    since = datetime.combine(
        feature_date - timedelta(days=window_days),
        datetime.min.time(),
        tzinfo=timezone.utc,
    )

    log.info(
        "Computing features: date=%s window=%d days since=%s",
        feature_date, window_days, since.date(),
    )

    async with get_conn() as conn:
        rows = await _aggregate_events(conn, since)
        if not rows:
            log.info("No events found in window — no features written")
            return 0

        count = await _upsert_features(conn, rows, feature_date, window_days)
        await conn.commit()

    log.info("Feature engineering complete: %d counties written", count)
    return count


async def _aggregate_events(
    conn: psycopg.AsyncConnection,
    since: datetime,
) -> list[dict]:
    """
    Aggregate raw_events per county.
    Joins geography.counties for population so we can compute exposure.
    """
    cur = await conn.execute(
        """
        SELECT
            c.fips_code,
            c.population,
            c.median_household_income,
            COALESCE(COUNT(e.id), 0)                                    AS total_count,
            COALESCE(COUNT(e.id) FILTER (
                WHERE e.event_type = 'disaster'
            ), 0)                                                        AS disaster_count,
            COALESCE(COUNT(e.id) FILTER (
                WHERE e.event_type = 'disaster'
                AND e.severity IN ('major', 'extreme')
            ), 0)                                                        AS major_disaster_count,
            COALESCE(COUNT(e.id) FILTER (
                WHERE e.event_type = 'weather'
            ), 0)                                                        AS severe_weather_count,
            COALESCE(COUNT(e.id) FILTER (
                WHERE e.event_type = 'earthquake'
            ), 0)                                                        AS earthquake_count,
            MAX(
                CASE
                    WHEN e.event_type = 'earthquake'
                    THEN (e.raw_data->>'mag')::numeric
                    ELSE NULL
                END
            )                                                           AS max_earthquake_magnitude,
            COALESCE(SUM(
                CASE e.severity
                    WHEN 'extreme'  THEN 4
                    WHEN 'major'    THEN 3
                    WHEN 'moderate' THEN 2
                    WHEN 'minor'    THEN 1
                    ELSE 0
                END
            ), 0)                                                       AS severity_weight_sum
        FROM geography.counties c
        LEFT JOIN datasets.raw_events e
            ON e.fips_code = c.fips_code
           AND e.event_start >= %(since)s
        GROUP BY c.fips_code, c.population, c.median_household_income
        """,
        {"since": since},
    )
    rows = await cur.fetchall()
    cols = [d.name for d in cur.description]
    return [dict(zip(cols, row)) for row in rows]


async def _upsert_features(
    conn: psycopg.AsyncConnection,
    rows: list[dict],
    feature_date: date,
    window_days: int,
) -> int:
    cur = conn.cursor()
    count = 0

    for row in rows:
        population = row["population"] or 0
        severity_weight_sum = row["severity_weight_sum"] or 0
        total_count = row["total_count"] or 0
        median_household_income = row["median_household_income"]

        # hazard_frequency_score: weighted events normalized to a 30-day rate
        hazard_frequency_score = (
            round(severity_weight_sum / window_days * 30, 4) if window_days else 0.0
        )

        # population_exposure: people exposed, scaled by hazard rate (not raw event bulk).
        # Using hazard_frequency_score (a 30-day rate) prevents counties with more days
        # of data from inflating their score vs. counties with equivalent ongoing intensity.
        population_exposure = round(float(population) * hazard_frequency_score, 4)

        # economic_exposure: total economic activity at risk — income level × population size
        # × hazard rate. Using log_population prevents giant metro counties from dominating
        # purely on size; the log scale means a county 10× larger scores ~2.3× higher, not 10×.
        # This ensures Gibson County IN (pop 33k, high alerts) scores below LA County (pop 10M).
        log_pop = math.log(population + 1) if population else 0.0
        economic_exposure = (
            round(float(median_household_income) / 1000.0 * log_pop * hazard_frequency_score, 4)
            if median_household_income is not None
            else 0.0
        )

        # log_population: ln(population + 1) — standalone inherent exposure scale.
        # Differentiates counties even when no active events are present.
        # Also used internally by economic_exposure above (as log_pop).
        log_population = round(log_pop, 4)

        # income_vulnerability: 1 - income/120000, floored at 0.
        # Lower-income counties have higher vulnerability regardless of active events.
        # Anchored at $120k (~95th percentile of US county median income).
        income_vulnerability = (
            round(max(0.0, 1.0 - float(median_household_income) / 120_000.0), 4)
            if median_household_income is not None
            else 0.5
        )

        features = {
            "disaster_count": row["disaster_count"],
            "major_disaster_count": row["major_disaster_count"],
            "severe_weather_count": row["severe_weather_count"],
            "earthquake_count": row["earthquake_count"],
            "max_earthquake_magnitude": float(row["max_earthquake_magnitude"])
            if row["max_earthquake_magnitude"] is not None else None,
            "population_exposure": population_exposure,
            "hazard_frequency_score": hazard_frequency_score,
            "economic_exposure": economic_exposure,
            "log_population": log_population,
            "income_vulnerability": income_vulnerability,
            "total_event_count": total_count,
        }

        await cur.execute(
            """
            INSERT INTO risk.county_features (
                fips_code, feature_date, window_days,
                disaster_count, major_disaster_count, severe_weather_count,
                earthquake_count, max_earthquake_magnitude,
                population_exposure, hazard_frequency_score,
                economic_exposure, log_population, income_vulnerability, features
            ) VALUES (
                %(fips_code)s, %(feature_date)s, %(window_days)s,
                %(disaster_count)s, %(major_disaster_count)s, %(severe_weather_count)s,
                %(earthquake_count)s, %(max_earthquake_magnitude)s,
                %(population_exposure)s, %(hazard_frequency_score)s,
                %(economic_exposure)s, %(log_population)s, %(income_vulnerability)s,
                %(features)s
            )
            ON CONFLICT (fips_code, feature_date, window_days) DO UPDATE SET
                disaster_count           = EXCLUDED.disaster_count,
                major_disaster_count     = EXCLUDED.major_disaster_count,
                severe_weather_count     = EXCLUDED.severe_weather_count,
                earthquake_count         = EXCLUDED.earthquake_count,
                max_earthquake_magnitude = EXCLUDED.max_earthquake_magnitude,
                population_exposure      = EXCLUDED.population_exposure,
                hazard_frequency_score   = EXCLUDED.hazard_frequency_score,
                economic_exposure        = EXCLUDED.economic_exposure,
                log_population           = EXCLUDED.log_population,
                income_vulnerability     = EXCLUDED.income_vulnerability,
                features                 = EXCLUDED.features,
                computed_at              = now()
            """,
            {
                "fips_code": row["fips_code"],
                "feature_date": feature_date,
                "window_days": window_days,
                "disaster_count": row["disaster_count"],
                "major_disaster_count": row["major_disaster_count"],
                "severe_weather_count": row["severe_weather_count"],
                "earthquake_count": row["earthquake_count"],
                "max_earthquake_magnitude": row["max_earthquake_magnitude"],
                "population_exposure": population_exposure,
                "hazard_frequency_score": hazard_frequency_score,
                "economic_exposure": economic_exposure,
                "log_population": log_population,
                "income_vulnerability": income_vulnerability,
                "features": Jsonb(features),
            },
        )
        count += 1

    return count


async def _main() -> None:
    await init_pool()
    try:
        print("→ Computing features...")
        written = await compute_features()
        print(f"  {written} counties written")
        print("✓ Done")
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(_main())
