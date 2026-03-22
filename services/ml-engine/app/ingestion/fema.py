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

_BASE = "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries"
_PAGE_SIZE = 1000


class FEMAConnector(BaseConnector):
    """Fetches FEMA major disaster and emergency declarations."""

    @property
    def source_key(self) -> str:
        return "fema"

    async def fetch(self, since: datetime) -> list[CanonicalEvent]:
        events: list[CanonicalEvent] = []
        skip = 0

        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                # Avoid OData $filter — FEMA rejects it with 404.
                # Fetch ordered by declarationDate desc, stop when records
                # are older than `since`.
                qs = (
                    f"$orderby=declarationDate desc"
                    f"&$top={_PAGE_SIZE}"
                    f"&$skip={skip}"
                    f"&$format=json"
                )
                resp = await client.get(f"{_BASE}?{qs}")
                resp.raise_for_status()

                payload = resp.json()
                records = payload.get("DisasterDeclarationsSummaries", [])
                if not records:
                    break

                done = False
                for rec in records:
                    rec_date = self._parse_date(rec.get("declarationDate", ""))
                    if rec_date and rec_date < since:
                        done = True
                        break
                    event = self._to_canonical(rec)
                    if event:
                        events.append(event)

                if done or len(records) < _PAGE_SIZE:
                    break
                skip += _PAGE_SIZE

        log.info("FEMA fetched %d records since %s", len(events), since.date())
        return events

    def _parse_date(self, value: str) -> datetime | None:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return None

    def _to_canonical(self, rec: dict) -> CanonicalEvent | None:
        fips = fips_from_state_county(
            rec.get("stateFips", ""),
            rec.get("countyCode", ""),
        )
        severity = severity_from_fema_type(
            rec.get("incidentType", ""),
            rec.get("declarationType", ""),
        )
        start = self._parse_date(rec.get("incidentBeginDate", ""))
        end = self._parse_date(rec.get("incidentEndDate", ""))

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
