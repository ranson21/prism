"""
Model training: county_features → trained RandomForest → risk.model_versions.

Target variable: major_disaster_count > 0 (county had a FEMA major disaster
declaration in the feature window). Weather + seismic features are used as
predictors — they are leading indicators that precede FEMA declarations.

Falls back to a weighted composite scorer if there are fewer than 10 positive
examples (too few to train a meaningful classifier).
"""

import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from psycopg.types.json import Jsonb
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import MinMaxScaler

from app.db import get_conn

log = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).parent.parent.parent / "artifacts"
ARTIFACTS_DIR.mkdir(exist_ok=True)

# Features fed to the model — disaster counts are excluded to avoid pure circularity.
# Major disaster count is used only as the target.
FEATURE_COLUMNS = [
    "severe_weather_count",
    "earthquake_count",
    "max_earthquake_magnitude",
    "hazard_frequency_score",
    "population_exposure",
]

# Fallback weights used when training data is insufficient
COMPOSITE_WEIGHTS = {
    "severe_weather_count":      0.30,
    "earthquake_count":          0.15,
    "max_earthquake_magnitude":  0.20,
    "hazard_frequency_score":    0.25,
    "population_exposure":       0.10,
}

_MIN_POSITIVE_EXAMPLES = 10


async def train_model(window_days: int = 90) -> str:
    """
    Train (or compute) a risk model from the current county_features.

    Returns:
        model_version_id (UUID string) of the newly registered model.
    """
    async with get_conn() as conn:
        df = await _load_features(conn, window_days)

    if df.empty:
        raise RuntimeError("No county features found — run /features first")

    log.info("Loaded %d county feature rows for training", len(df))

    n_positive = int((df["major_disaster_count"] > 0).sum())
    log.info("Positive examples (major disaster): %d / %d", n_positive, len(df))

    if n_positive >= _MIN_POSITIVE_EXAMPLES:
        model_type, artifact_path, metrics = _train_rf(df)
    else:
        log.warning(
            "Only %d positive examples — using weighted composite scorer", n_positive
        )
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


def _train_rf(df: pd.DataFrame) -> tuple[str, str, dict]:
    X = df[FEATURE_COLUMNS].fillna(0).values
    y = (df["major_disaster_count"] > 0).astype(int).values

    # Scale features so importances are comparable
    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(X)

    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=8,
        min_samples_leaf=5,
        class_weight="balanced",   # compensate for few positive examples
        random_state=42,
        n_jobs=-1,
    )
    clf.fit(X_scaled, y)

    # In-sample metrics (no held-out test set — too few samples for hackathon)
    y_pred = clf.predict(X_scaled)
    accuracy = float(np.mean(y_pred == y))
    positive_rate = float(y.mean())

    artifact = {
        "clf": clf,
        "scaler": scaler,
        "feature_columns": FEATURE_COLUMNS,
        "model_type": "random_forest",
    }
    path = str(ARTIFACTS_DIR / "model_rf.joblib")
    joblib.dump(artifact, path)

    metrics = {
        "accuracy": round(accuracy, 4),
        "positive_rate": round(positive_rate, 4),
        "n_samples": len(df),
        "n_positive": int(y.sum()),
        "feature_importances": dict(
            zip(FEATURE_COLUMNS, [round(float(v), 4) for v in clf.feature_importances_])
        ),
    }
    log.info("RF trained: accuracy=%.3f n=%d", accuracy, len(df))
    return "random_forest", path, metrics


def _fit_composite(df: pd.DataFrame) -> tuple[str, str, dict]:
    """Normalize each feature to [0,1] and return the weighted sum as a scorer."""
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
        "note": "Composite scorer — insufficient positive examples for RF",
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
            COALESCE(f.max_earthquake_magnitude, 0) AS max_earthquake_magnitude,
            f.population_exposure,
            f.hazard_frequency_score
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
