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
from app.scoring.train import FEATURE_COLUMNS, _CLUSTER_TIER_LABELS

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

    # --- K-Means cluster assignment ---
    # Rank clusters by mean composite score so Tier 1 = lowest, Tier 5 = highest.
    kmeans = artifact.get("kmeans")
    if kmeans is not None:
        raw_cluster_ids = kmeans.predict(X_scaled)
        weights = np.array([artifact["weights"][f] for f in FEATURE_COLUMNS])
        raw_composite = (X_scaled * weights).sum(axis=1)
        cluster_means = {
            c: raw_composite[raw_cluster_ids == c].mean()
            for c in range(artifact.get("n_clusters", 5))
        }
        # Map original cluster id → rank (0 = lowest mean, n-1 = highest mean)
        rank_order = sorted(cluster_means, key=cluster_means.get)
        cluster_rank = {orig: rank for rank, orig in enumerate(rank_order)}
        cluster_ranks = np.array([cluster_rank[c] for c in raw_cluster_ids])
    else:
        cluster_ranks = None

    if model_type == "random_forest":
        clf = artifact["clf"]
        probas = clf.predict_proba(X_scaled)[:, 1]   # P(major disaster)
        importances = clf.feature_importances_
        # Per-tree variance → natural uncertainty estimate
        tree_preds = np.array([t.predict_proba(X_scaled)[:, 1] for t in clf.estimators_])
        score_std = tree_preds.std(axis=0)
        scores = np.clip(probas * 100, 0, 100)
        conf_lower = np.clip((probas - score_std) * 100, 0, 100)
        conf_upper = np.clip((probas + score_std) * 100, 0, 100)
    else:
        # Weighted composite — insufficient positive training examples for
        # probability calibration. Use percentile-rank scoring instead:
        # counties are ranked by composite score and mapped to 0–100 via a
        # power transform that produces a realistic right-skewed distribution
        # (majority low, meaningful moderate/elevated tiers, few critical).
        # This mirrors how published risk indices (e.g. FEMA NRI) work.
        weights = np.array([artifact["weights"][f] for f in FEATURE_COLUMNS])
        weighted_features = X_scaled * weights
        raw_composite = weighted_features.sum(axis=1)
        importances = weights / weights.sum()

        # Relative uncertainty: counties where features pull in different
        # directions have wider bands than those with consistent signals.
        rel_std = weighted_features.std(axis=1)

        # Percentile ranks (1/n … 1), then power-transform for right skew.
        # ranks^2 → top ~13% critical, ~16% elevated, ~21% moderate, ~50% low
        order = np.argsort(np.argsort(raw_composite))   # 0-based rank indices
        ranks = (order + 1) / len(raw_composite)        # uniform [1/n, 1]
        probas = np.power(ranks, 2.0)

        # Scale relative uncertainty to the transformed score space
        score_std = rel_std / (raw_composite.max() + 1e-8) * probas * 0.4

        scores = np.clip(probas * 100, 0, 100)
        conf_lower = np.clip((probas - score_std) * 100, 0, 100)
        conf_upper = np.clip((probas + score_std) * 100, 0, 100)

    today = date.today()
    rows_written = 0

    async with get_conn() as conn:
        cur = conn.cursor()
        for i, (_, county_row) in enumerate(df.iterrows()):
            risk_score = round(float(scores[i]), 2)
            level = _risk_level(risk_score)
            drivers = _top_drivers(X_scaled[i], FEATURE_COLUMNS, importances)

            c_id = int(cluster_ranks[i]) if cluster_ranks is not None else None
            c_label = _CLUSTER_TIER_LABELS[c_id] if c_id is not None else None

            await cur.execute(
                """
                INSERT INTO risk.scores
                    (fips_code, model_version_id, score_date,
                     risk_score, risk_level, top_drivers,
                     confidence_lower, confidence_upper,
                     cluster_id, cluster_label)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (fips_code, model_version_id, score_date) DO UPDATE SET
                    risk_score       = EXCLUDED.risk_score,
                    risk_level       = EXCLUDED.risk_level,
                    top_drivers      = EXCLUDED.top_drivers,
                    confidence_lower = EXCLUDED.confidence_lower,
                    confidence_upper = EXCLUDED.confidence_upper,
                    cluster_id       = EXCLUDED.cluster_id,
                    cluster_label    = EXCLUDED.cluster_label,
                    computed_at      = now()
                """,
                (
                    county_row["fips_code"],
                    model_row["id"],
                    today,
                    risk_score,
                    level,
                    Jsonb(drivers),
                    round(float(conf_lower[i]), 2),
                    round(float(conf_upper[i]), 2),
                    c_id,
                    c_label,
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
               COALESCE(max_earthquake_magnitude, 0)  AS max_earthquake_magnitude,
               hazard_frequency_score,
               population_exposure,
               COALESCE(economic_exposure, 0)         AS economic_exposure,
               COALESCE(log_population, 0)            AS log_population,
               COALESCE(income_vulnerability, 0.5)    AS income_vulnerability,
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
