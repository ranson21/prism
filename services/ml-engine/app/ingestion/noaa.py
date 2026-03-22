"""
NOAA Storm Events connector — NCEI Climate Data Online (CDO) API v2.

Docs: https://www.ncei.noaa.gov/cdo-web/api/v2/data
Requires a free CDO token: https://www.ncdc.noaa.gov/cdo-web/token
"""

import logging
import os
from datetime import datetime

import httpx

from app.ingestion.base import BaseConnector
from app.ingestion.normalizer import severity_from_noaa_magnitude
from app.models.events import CanonicalEvent

log = logging.getLogger(__name__)

_BASE = "https://www.ncei.noaa.gov/cdo-web/api/v2/data"
_DATASET = "GHCND"          # Global Historical Climatology Network Daily
_PAGE_SIZE = 1000

# Storm Events dataset ID for NOAA CDO
_STORM_DATASET = "STORM_EVENTS"


class NOAAConnector(BaseConnector):
    """
    Fetches NOAA storm event records.

    Note: CDO API returns data per weather station. FIPS mapping is done
    via the station's county FIPS attribute when available.
    """

    def __init__(self) -> None:
        self._token = os.environ.get("NOAA_API_KEY", "")

    @property
    def source_key(self) -> str:
        return "noaa"

    async def fetch(self, since: datetime) -> list[CanonicalEvent]:
        if not self._token:
            log.warning("NOAA_API_KEY not set; skipping NOAA ingestion")
            return []

        headers = {"token": self._token}
        events: list[CanonicalEvent] = []
        offset = 1  # CDO uses 1-based offset

        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                params = {
                    "datasetid": _STORM_DATASET,
                    "startdate": since.strftime("%Y-%m-%d"),
                    "enddate": datetime.utcnow().strftime("%Y-%m-%d"),
                    "limit": _PAGE_SIZE,
                    "offset": offset,
                    "includemetadata": "false",
                }
                resp = await client.get(_BASE, params=params, headers=headers)
                resp.raise_for_status()

                payload = resp.json()
                records = payload.get("results", [])
                if not records:
                    break

                for rec in records:
                    event = self._to_canonical(rec)
                    if event:
                        events.append(event)

                if len(records) < _PAGE_SIZE:
                    break
                offset += _PAGE_SIZE

        log.info("NOAA fetched %d records since %s", len(events), since.date())
        return events

    def _to_canonical(self, rec: dict) -> CanonicalEvent | None:
        # CDO returns station-level data; county FIPS may be embedded in station metadata
        fips = rec.get("fipsCode") or rec.get("countyFips")
        event_type_raw = rec.get("datatype", "")
        magnitude = rec.get("value")
        if magnitude is not None:
            try:
                magnitude = float(magnitude)
            except (TypeError, ValueError):
                magnitude = None

        severity = severity_from_noaa_magnitude(magnitude, event_type_raw)

        try:
            start = datetime.fromisoformat(rec["date"].replace("Z", "+00:00"))
        except (KeyError, ValueError, AttributeError):
            start = None

        return CanonicalEvent(
            source_key="noaa",
            external_id=f"{rec.get('station', '')}:{rec.get('date', '')}:{event_type_raw}",
            fips_code=fips,
            event_type="weather",
            event_subtype=event_type_raw,
            severity=severity,
            event_start=start,
            event_end=None,
            raw_data=rec,
        )
