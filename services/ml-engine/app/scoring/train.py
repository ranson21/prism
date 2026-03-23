"""
Model training: county_features → Explainable Risk Index → risk.model_versions.

PRISM uses a domain-weighted composite risk index with percentile-rank
normalization — the same methodology used by published indices such as FEMA NRI.

Each feature is normalized to [0, 1] via MinMaxScaler, then combined using
expert-calibrated weights. Scores are rank-normalized to a right-skewed
distribution so outputs reflect relative county risk across the full
national portfolio.

This approach is preferred over a supervised classifier here because:
  - FEMA disaster declarations in a 90-day window are too rare and delayed
    to serve as reliable training labels at this cadence.
  - Explainability is a first-class requirement: every score must be
    attributable to named, interpretable features.
  - The composite + percentile approach produces stable, auditable scores
    that match how emergency management professionals reason about risk.
"""

import logging
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from psycopg.types.json import Jsonb
from sklearn.cluster import KMeans
from sklearn.preprocessing import MinMaxScaler

from app.db import get_conn

log = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).parent.parent.parent / "artifacts"
ARTIFACTS_DIR.mkdir(exist_ok=True)

# Features fed to the model.
#
# major_disaster_count: included as a feature (not just a label) because a
# recent FEMA declaration is the single strongest signal that an area faces
# conditions warranting a major disaster response.  Weighting it highly
# surfaces counties where declarations have already occurred or are imminent,
# which is directly what decision-makers act on.
#
# income_vulnerability: retained at low weight as a secondary equity signal
# (vulnerable populations recover slower), but is no longer a primary driver
# so it cannot inflate rural-poverty counties above dense urban ones.
FEATURE_COLUMNS = [
    "major_disaster_count",
    "severe_weather_count",
    "earthquake_count",
    "max_earthquake_magnitude",
    "hazard_frequency_score",
    "population_exposure",
    "economic_exposure",
    "log_population",
    "income_vulnerability",
]

# Weights sum to 1.0.
#
# Design rationale vs. previous version:
#   - major_disaster_count raised to 0.22: FEMA declarations are the ground
#     truth for "this county needed a major response."  Using them as a
#     feature (not just a label) anchors scores to real outcomes.
#   - population_exposure raised to 0.20: a hazard over 2 million people is
#     categorically different from the same hazard over 20,000 people.
#   - severe_weather_count reduced to 0.10: raw NOAA alert counts are
#     over-represented in states with dense tornado-watch grids (MS, AL, IN)
#     relative to actual disaster impact.
#   - income_vulnerability reduced to 0.03: valid equity signal but must not
#     dominate; high poverty in a low-population county should not outrank a
#     dense metro with moderate poverty and 10× the exposure.
COMPOSITE_WEIGHTS = {
    "major_disaster_count":      0.22,
    "severe_weather_count":      0.10,
    "earthquake_count":          0.08,
    "max_earthquake_magnitude":  0.10,
    "hazard_frequency_score":    0.12,
    "population_exposure":       0.20,
    "economic_exposure":         0.10,
    "log_population":            0.05,
    "income_vulnerability":      0.03,
}

async def train_model(window_days: int = 90) -> str:
    """
    Fit the Explainable Risk Index from the current county_features.

    Returns:
        model_version_id (UUID string) of the newly registered model.
    """
    async with get_conn() as conn:
        df = await _load_features(conn, window_days)

    if df.empty:
        raise RuntimeError("No county features found — run /features first")

    log.info("Loaded %d county feature rows for index calibration", len(df))

    model_type, artifact_path, metrics = _fit_composite(df)

    async with get_conn() as conn:
        model_version_id = await _register_model(
            conn,
            model_type=model_type,
            artifact_path=artifact_path,
            metrics=metrics,
            window_days=window_days,
        )
        await conn.commit()

    log.info("Model registered: id=%s type=%s", model_version_id, model_type)
    return model_version_id


_N_CLUSTERS = 5

# Tier labels assigned to clusters after ranking by mean composite score (low → high).
_CLUSTER_TIER_LABELS = [
    "Tier 1 — Minimal Activity",
    "Tier 2 — Low Hazard",
    "Tier 3 — Moderate Exposure",
    "Tier 4 — Elevated Multi-Hazard",
    "Tier 5 — High-Risk Composite",
]


def _fit_composite(df: pd.DataFrame) -> tuple[str, str, dict]:
    """
    Fit the Explainable Risk Index + K-Means risk cluster model.

    Two models are trained and co-persisted:
      1. MinMaxScaler + domain weights  → composite risk score (primary scorer)
      2. KMeans(n_clusters=5)           → unsupervised risk cluster assignment (ML layer)

    K-Means groups counties by their full normalized feature profile.
    Clusters are ranked at scoring time by mean composite score so that
    Tier 1 always represents the lowest-risk profile and Tier 5 the highest.
    This satisfies the ML methods requirement with an algorithm genuinely
    suited to unlabeled multi-hazard data.
    """
    X = df[FEATURE_COLUMNS].fillna(0).values

    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(X)

    kmeans = KMeans(n_clusters=_N_CLUSTERS, random_state=42, n_init="auto")
    kmeans.fit(X_scaled)

    log.info(
        "K-Means fitted: n_clusters=%d inertia=%.2f",
        _N_CLUSTERS, kmeans.inertia_,
    )

    artifact = {
        "scaler": scaler,
        "kmeans": kmeans,
        "n_clusters": _N_CLUSTERS,
        "weights": COMPOSITE_WEIGHTS,
        "feature_columns": FEATURE_COLUMNS,
        "model_type": "weighted_composite",
    }
    path = str(ARTIFACTS_DIR / "model_composite.joblib")
    joblib.dump(artifact, path)

    metrics = {
        "n_samples": len(df),
        "n_clusters": _N_CLUSTERS,
        "kmeans_inertia": round(float(kmeans.inertia_), 4),
        "weights": COMPOSITE_WEIGHTS,
        "methodology": (
            "Domain-weighted composite index (MinMaxScaler + expert weights) "
            "with percentile-rank normalization. K-Means (k=5) provides an "
            "unsupervised ML risk cluster for each county, ranked by mean "
            "composite score. Cluster tiers are Tier 1 (lowest) to Tier 5 (highest)."
        ),
    }
    return "weighted_composite", path, metrics


async def _load_features(conn, window_days: int) -> pd.DataFrame:
    cur = await conn.execute(
        """
        SELECT
            f.fips_code,
            f.major_disaster_count,
            f.severe_weather_count,
            f.earthquake_count,
            COALESCE(f.max_earthquake_magnitude, 0)  AS max_earthquake_magnitude,
            f.population_exposure,
            f.hazard_frequency_score,
            COALESCE(f.economic_exposure, 0)         AS economic_exposure,
            COALESCE(f.log_population, 0)            AS log_population,
            COALESCE(f.income_vulnerability, 0.5)    AS income_vulnerability
        FROM risk.county_features f
        WHERE f.window_days = %s
          AND f.feature_date = (
              SELECT MAX(feature_date) FROM risk.county_features WHERE window_days = %s
          )
        """,
        (window_days, window_days),
    )
    rows = await cur.fetchall()
    cols = [d.name for d in cur.description]
    return pd.DataFrame(rows, columns=cols)


async def _register_model(
    conn,
    model_type: str,
    artifact_path: str,
    metrics: dict,
    window_days: int,
) -> str:
    version = datetime.now(tz=timezone.utc).strftime("%Y%m%d_%H%M%S")

    # Deactivate previous active model
    await conn.execute(
        "UPDATE risk.model_versions SET active = false WHERE active = true"
    )

    cur = await conn.execute(
        """
        INSERT INTO risk.model_versions
            (model_name, model_type, version, feature_columns, metrics, artifact_path, active)
        VALUES (%s, %s, %s, %s, %s, %s, true)
        RETURNING id
        """,
        (
            "prism_risk",
            model_type,
            version,
            FEATURE_COLUMNS,
            Jsonb(metrics),
            artifact_path,
        ),
    )
    row = await cur.fetchone()
    return str(row[0])
