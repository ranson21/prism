"""
Scoring: county_features + trained model → risk.scores.

Loads the active model artifact, runs inference on the latest county_features,
computes top_drivers per county, and upserts into risk.scores.
"""

import logging
from datetime import date, datetime, timezone

import joblib
import numpy as np
import pandas as pd
from psycopg.types.json import Jsonb

from app.db import get_conn
from app.scoring.train import FEATURE_COLUMNS

log = logging.getLogger(__name__)


def _risk_level(score: float) -> str:
    if score >= 75:
        return "critical"
    if score >= 50:
        return "elevated"
    if score >= 25:
        return "moderate"
    return "low"


def _top_drivers(
    feature_row: np.ndarray,
    feature_names: list[str],
    importances: np.ndarray,
    n: int = 3,
) -> list[dict]:
    """
    Compute per-county top contributing features.

    Contribution = normalized_feature_value × importance weight.
    Returns top-N sorted by contribution descending.
    """
    contributions = feature_row * importances
    total = contributions.sum() or 1.0
    drivers = []
    for i, name in enumerate(feature_names):
        drivers.append({
            "factor": name,
            "contribution": round(float(contributions[i] / total), 4),
            "value": round(float(feature_row[i]), 4),
        })
    drivers.sort(key=lambda d: d["contribution"], reverse=True)
    return drivers[:n]


async def score_counties(
    model_version_id: str | None = None,
    window_days: int = 90,
) -> int:
    """
    Score all counties using the active (or specified) model version.

    Returns:
        Number of risk.scores rows written.
    """
    async with get_conn() as conn:
        model_row = await _load_model_version(conn, model_version_id)
        df = await _load_features(conn, window_days)

    if df.empty:
        raise RuntimeError("No county features found — run /features first")

    artifact = joblib.load(model_row["artifact_path"])
    model_type = model_row["model_type"]
    scaler = artifact["scaler"]

    X_raw = df[FEATURE_COLUMNS].fillna(0).values
    X_scaled = scaler.transform(X_raw)

    if model_type == "random_forest":
        clf = artifact["clf"]
        probas = clf.predict_proba(X_scaled)[:, 1]   # P(major disaster)
        importances = clf.feature_importances_
    else:
        # Weighted composite
        weights = np.array([artifact["weights"][f] for f in FEATURE_COLUMNS])
        probas = (X_scaled * weights).sum(axis=1)
        importances = weights / weights.sum()

    scores = np.clip(probas * 100, 0, 100)

    today = date.today()
    rows_written = 0

    async with get_conn() as conn:
        cur = conn.cursor()
        for i, (_, county_row) in enumerate(df.iterrows()):
            risk_score = round(float(scores[i]), 2)
            level = _risk_level(risk_score)
            drivers = _top_drivers(X_scaled[i], FEATURE_COLUMNS, importances)

            await cur.execute(
                """
                INSERT INTO risk.scores
                    (fips_code, model_version_id, score_date,
                     risk_score, risk_level, top_drivers)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (fips_code, model_version_id, score_date) DO UPDATE SET
                    risk_score  = EXCLUDED.risk_score,
                    risk_level  = EXCLUDED.risk_level,
                    top_drivers = EXCLUDED.top_drivers,
                    computed_at = now()
                """,
                (
                    county_row["fips_code"],
                    model_row["id"],
                    today,
                    risk_score,
                    level,
                    Jsonb(drivers),
                ),
            )
            rows_written += 1

        await conn.commit()

    log.info("Scored %d counties (model=%s)", rows_written, model_row["id"])
    return rows_written


async def _load_model_version(conn, model_version_id: str | None) -> dict:
    if model_version_id:
        cur = await conn.execute(
            "SELECT id, model_type, artifact_path FROM risk.model_versions WHERE id = %s",
            (model_version_id,),
        )
    else:
        cur = await conn.execute(
            "SELECT id, model_type, artifact_path FROM risk.model_versions WHERE active = true LIMIT 1"
        )
    row = await cur.fetchone()
    if not row:
        raise RuntimeError("No active model found — run /train first")
    return {"id": str(row[0]), "model_type": row[1], "artifact_path": row[2]}


async def _load_features(conn, window_days: int) -> pd.DataFrame:
    cur = await conn.execute(
        """
        SELECT fips_code,
               severe_weather_count,
               earthquake_count,
               COALESCE(max_earthquake_magnitude, 0) AS max_earthquake_magnitude,
               hazard_frequency_score,
               population_exposure,
               COALESCE(economic_exposure, 0) AS economic_exposure,
               major_disaster_count
        FROM risk.county_features
        WHERE window_days = %s
          AND feature_date = (
              SELECT MAX(feature_date) FROM risk.county_features WHERE window_days = %s
          )
        """,
        (window_days, window_days),
    )
    rows = await cur.fetchall()
    cols = [d.name for d in cur.description]
    return pd.DataFrame(rows, columns=cols)
