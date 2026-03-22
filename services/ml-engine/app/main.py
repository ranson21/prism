"""PRISM ML Engine — FastAPI application."""

import logging

from dotenv import load_dotenv
load_dotenv()  # loads services/ml-engine/.env when running locally
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.db import close_pool, init_pool
from app.features import compute_features
from app.ingestion import run_ingestion
from app.models.events import IngestionResult
from app.scoring import score_counties, train_model

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await init_pool()
    yield
    await close_pool()


app = FastAPI(
    title="PRISM ML Engine",
    description="Ingestion, feature engineering, and risk scoring for PRISM",
    version="0.1.0",
    lifespan=lifespan,
)


class IngestRequest(BaseModel):
    source_keys: list[str] | None = None    # None = all sources
    since: datetime | None = None           # None = default lookback


class IngestResponse(BaseModel):
    results: list[IngestionResult]
    triggered_at: datetime


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/ingest", response_model=IngestResponse)
async def trigger_ingestion(req: IngestRequest) -> IngestResponse:
    """
    Trigger an ingestion run for one or more data sources.

    - Fetches records from FEMA, NOAA, and/or USGS
    - Normalizes and deduplicates against existing data
    - Returns per-source record counts
    """
    try:
        results = await run_ingestion(
            source_keys=req.source_keys,
            since=req.since,
        )
    except Exception as exc:
        log.exception("Ingestion endpoint error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return IngestResponse(
        results=results,
        triggered_at=datetime.now(tz=timezone.utc),
    )


class FeaturesRequest(BaseModel):
    window_days: int = 90


class FeaturesResponse(BaseModel):
    counties_written: int
    window_days: int
    feature_date: str
    triggered_at: datetime


@app.post("/features", response_model=FeaturesResponse)
async def trigger_features(req: FeaturesRequest) -> FeaturesResponse:
    """
    Compute county feature vectors from ingested raw_events.

    Aggregates events in the look-back window per county and writes
    to risk.county_features. Safe to re-run — upserts on conflict.
    """
    try:
        from datetime import date
        today = date.today()
        counties_written = await compute_features(window_days=req.window_days)
    except Exception as exc:
        log.exception("Feature engineering error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return FeaturesResponse(
        counties_written=counties_written,
        window_days=req.window_days,
        feature_date=str(today),
        triggered_at=datetime.now(tz=timezone.utc),
    )


class TrainResponse(BaseModel):
    model_version_id: str
    triggered_at: datetime


@app.post("/train", response_model=TrainResponse)
async def trigger_train() -> TrainResponse:
    """
    Train a risk model from the current county_features.

    Uses RandomForest if enough positive examples exist, otherwise
    falls back to a weighted composite scorer. Registers the result
    in risk.model_versions and marks it active.
    """
    try:
        model_version_id = await train_model()
    except Exception as exc:
        log.exception("Model training error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return TrainResponse(
        model_version_id=model_version_id,
        triggered_at=datetime.now(tz=timezone.utc),
    )


class ScoreResponse(BaseModel):
    counties_scored: int
    triggered_at: datetime


@app.post("/score", response_model=ScoreResponse)
async def trigger_score() -> ScoreResponse:
    """
    Score all counties using the active model.

    Reads from risk.county_features, runs inference, writes risk_score +
    risk_level + top_drivers to risk.scores.
    """
    try:
        counties_scored = await score_counties()
    except Exception as exc:
        log.exception("Scoring error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return ScoreResponse(
        counties_scored=counties_scored,
        triggered_at=datetime.now(tz=timezone.utc),
    )
