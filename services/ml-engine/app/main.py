"""PRISM ML Engine — FastAPI application."""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.db import close_pool, init_pool
from app.ingestion import run_ingestion
from app.models.events import IngestionResult

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
