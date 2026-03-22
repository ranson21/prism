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
from sklearn.preprocessing import MinMaxScaler

from app.db import get_conn

log = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).parent.parent.parent / "artifacts"
ARTIFACTS_DIR.mkdir(exist_ok=True)

# Features fed to the model — disaster counts are excluded to avoid pure circularity.
# Major disaster count is used only as the target.
# log_population and income_vulnerability are standalone structural features that
# differentiate counties even when no active events are present.
FEATURE_COLUMNS = [
    "severe_weather_count",
    "earthquake_count",
    "max_earthquake_magnitude",
    "hazard_frequency_score",
    "population_exposure",
    "economic_exposure",
    "log_population",
    "income_vulnerability",
]

# Fallback weights used when training data is insufficient.
# Weights sum to 1.0. Event-based features are weighted higher when events exist;
# structural features ensure all counties receive a meaningful baseline score.
COMPOSITE_WEIGHTS = {
    "severe_weather_count":      0.22,
    "earthquake_count":          0.10,
    "max_earthquake_magnitude":  0.14,
    "hazard_frequency_score":    0.18,
    "population_exposure":       0.08,
    "economic_exposure":         0.08,
    "log_population":            0.12,
    "income_vulnerability":      0.08,
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


def _fit_composite(df: pd.DataFrame) -> tuple[str, str, dict]:
    """
    Fit the Explainable Risk Index.

    Normalizes each feature to [0, 1] via MinMaxScaler so that weights are
    directly comparable across features. The scaler is persisted in the artifact
    so that future scoring runs produce consistent normalized values.
    """
    scaler = MinMaxScaler()
    X = df[FEATURE_COLUMNS].fillna(0).values
    scaler.fit(X)

    artifact = {
        "scaler": scaler,
        "weights": COMPOSITE_WEIGHTS,
        "feature_columns": FEATURE_COLUMNS,
        "model_type": "weighted_composite",
    }
    path = str(ARTIFACTS_DIR / "model_composite.joblib")
    joblib.dump(artifact, path)

    metrics = {
        "n_samples": len(df),
        "weights": COMPOSITE_WEIGHTS,
        "methodology": (
            "Domain-weighted composite index with MinMaxScaler normalization. "
            "Scores are percentile-rank normalized at inference time to produce "
            "a right-skewed national risk distribution."
        ),
    }
    return "weighted_composite", path, metrics


async def _load_features(conn, window_days: int) -> pd.DataFrame:
    cur = await conn.execute(
        """
        SELECT
            f.fips_code,
            f.disaster_count,
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
