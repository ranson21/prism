"""
Feature engineering: raw_events → county_features.

For each county with events in the look-back window, compute:
  - disaster_count / major_disaster_count
  - severe_weather_count
  - earthquake_count / max_earthquake_magnitude
  - population_exposure  (population × severity_weight, summed)
  - hazard_frequency_score  (weighted events per 30 days)

Severity weights: minor=1, moderate=2, major=3, extreme=4
"""

import logging
from datetime import date, datetime, timedelta, timezone

import psycopg
from psycopg.types.json import Jsonb

from app.db import get_conn

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
            e.fips_code,
            c.population,
            COUNT(*)                                                    AS total_count,
            COUNT(*) FILTER (WHERE e.event_type = 'disaster')          AS disaster_count,
            COUNT(*) FILTER (
                WHERE e.event_type = 'disaster'
                AND e.severity IN ('major', 'extreme')
            )                                                           AS major_disaster_count,
            COUNT(*) FILTER (WHERE e.event_type = 'weather')           AS severe_weather_count,
            COUNT(*) FILTER (WHERE e.event_type = 'earthquake')        AS earthquake_count,
            MAX(
                CASE
                    WHEN e.event_type = 'earthquake'
                    THEN (e.raw_data->>'mag')::numeric
                    ELSE NULL
                END
            )                                                           AS max_earthquake_magnitude,
            -- Weighted severity sum
            SUM(
                CASE e.severity
                    WHEN 'extreme'  THEN 4
                    WHEN 'major'    THEN 3
                    WHEN 'moderate' THEN 2
                    WHEN 'minor'    THEN 1
                    ELSE 0
                END
            )                                                           AS severity_weight_sum
        FROM datasets.raw_events e
        JOIN geography.counties c USING (fips_code)
        WHERE e.fips_code IS NOT NULL
          AND e.event_start >= %(since)s
        GROUP BY e.fips_code, c.population
        HAVING COUNT(*) > 0
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

        # population_exposure: how many people were exposed, weighted by severity
        population_exposure = float(population * severity_weight_sum)

        # hazard_frequency_score: weighted events normalized to a 30-day rate
        hazard_frequency_score = (
            round(severity_weight_sum / window_days * 30, 4) if window_days else 0.0
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
            "total_event_count": total_count,
        }

        await cur.execute(
            """
            INSERT INTO risk.county_features (
                fips_code, feature_date, window_days,
                disaster_count, major_disaster_count, severe_weather_count,
                earthquake_count, max_earthquake_magnitude,
                population_exposure, hazard_frequency_score,
                features
            ) VALUES (
                %(fips_code)s, %(feature_date)s, %(window_days)s,
                %(disaster_count)s, %(major_disaster_count)s, %(severe_weather_count)s,
                %(earthquake_count)s, %(max_earthquake_magnitude)s,
                %(population_exposure)s, %(hazard_frequency_score)s,
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
                "features": Jsonb(features),
            },
        )
        count += 1

    return count
