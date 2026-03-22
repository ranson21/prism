"""
FEMA OpenFEMA connector — Disaster Declarations Summaries v2.

Docs: https://www.fema.gov/api/open/v2/disasterDeclarationsSummaries
No API key required; rate limit is generous for non-bulk use.
"""

import logging
from datetime import datetime

import httpx

from app.ingestion.base import BaseConnector
from app.ingestion.normalizer import fips_from_state_county, severity_from_fema_type
from app.models.events import CanonicalEvent

log = logging.getLogger(__name__)

_BASE = "https://www.fema.gov/api/open/v2/disasterDeclarationsSummaries"
_PAGE_SIZE = 1000


class FEMAConnector(BaseConnector):
    """Fetches FEMA major disaster and emergency declarations."""

    @property
    def source_key(self) -> str:
        return "fema"

    async def fetch(self, since: datetime) -> list[CanonicalEvent]:
        since_str = since.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        events: list[CanonicalEvent] = []
        skip = 0

        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                params = {
                    "$filter": f"lastRefresh gt '{since_str}'",
                    "$orderby": "lastRefresh asc",
                    "$top": _PAGE_SIZE,
                    "$skip": skip,
                    "$format": "json",
                }
                resp = await client.get(_BASE, params=params)
                resp.raise_for_status()

                payload = resp.json()
                records = payload.get("DisasterDeclarationsSummaries", [])
                if not records:
                    break

                for rec in records:
                    event = self._to_canonical(rec)
                    if event:
                        events.append(event)

                if len(records) < _PAGE_SIZE:
                    break
                skip += _PAGE_SIZE

        log.info("FEMA fetched %d records since %s", len(events), since_str)
        return events

    def _to_canonical(self, rec: dict) -> CanonicalEvent | None:
        fips = fips_from_state_county(
            rec.get("stateFips", ""),
            rec.get("countyCode", ""),
        )
        severity = severity_from_fema_type(
            rec.get("incidentType", ""),
            rec.get("declarationType", ""),
        )
        try:
            start = datetime.fromisoformat(rec["incidentBeginDate"].replace("Z", "+00:00"))
        except (KeyError, ValueError, AttributeError):
            start = None
        try:
            end = datetime.fromisoformat(rec["incidentEndDate"].replace("Z", "+00:00"))
        except (KeyError, ValueError, AttributeError):
            end = None

        return CanonicalEvent(
            source_key="fema",
            external_id=str(rec.get("id") or rec.get("disasterNumber", "")),
            fips_code=fips,
            event_type="disaster",
            event_subtype=rec.get("incidentType"),
            severity=severity,
            event_start=start,
            event_end=end,
            raw_data=rec,
        )
