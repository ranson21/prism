"""Canonical event models — the normalized form all connectors must produce."""

from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field


EventType = Literal["disaster", "weather", "earthquake"]
SeverityLabel = Literal["minor", "moderate", "major", "extreme"]


class CanonicalEvent(BaseModel):
    """Normalized event record written to datasets.raw_events."""

    source_key: str
    external_id: str                        # upstream system's identifier
    fips_code: str | None                   # None if county cannot be resolved
    event_type: EventType
    event_subtype: str | None = None        # e.g. "Hurricane", "Flood", "M5.2"
    severity: SeverityLabel | None = None
    event_start: datetime | None = None
    event_end: datetime | None = None
    raw_data: dict[str, Any]               # unmodified upstream payload


class IngestionResult(BaseModel):
    """Summary returned by a connector after a fetch run."""

    source_key: str
    records_fetched: int = 0
    records_inserted: int = 0
    records_skipped: int = 0
    error_message: str | None = None


class RiskScore(BaseModel):
    """Risk score emitted by the ML scoring step."""

    fips_code: str
    risk_score: float = Field(ge=0, le=100)
    risk_level: Literal["low", "moderate", "elevated", "critical"]
    confidence_lower: float | None = None
    confidence_upper: float | None = None
    top_drivers: list[dict[str, Any]] = Field(default_factory=list)
