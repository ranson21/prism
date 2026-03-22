"""
NWS (National Weather Service) Alerts connector.

API: https://api.weather.gov/alerts
- No API key required
- Returns active and recent severe weather alerts
- Includes county FIPS codes (UGC zones map to counties)

Replaces the CDO connector — CDO does not expose a storm events dataset
via its REST API; bulk storm event data requires file downloads.
"""

import logging
from datetime import datetime

import httpx

from app.ingestion.base import BaseConnector
from app.ingestion.normalizer import severity_from_noaa_magnitude
from app.models.events import CanonicalEvent

log = logging.getLogger(__name__)

_BASE = "https://api.weather.gov/alerts"
_PAGE_SIZE = 500

# NWS event types that map to meaningful hazard signals for PRISM
_SIGNIFICANT_EVENTS = {
    "Tornado Warning", "Tornado Watch",
    "Hurricane Warning", "Hurricane Watch",
    "Tropical Storm Warning", "Tropical Storm Watch",
    "Flash Flood Warning", "Flash Flood Watch",
    "Flood Warning", "Flood Watch",
    "Severe Thunderstorm Warning", "Severe Thunderstorm Watch",
    "Blizzard Warning", "Ice Storm Warning",
    "Winter Storm Warning", "Winter Storm Watch",
    "Excessive Heat Warning", "Heat Advisory",
    "Wildfire Warning", "Red Flag Warning",
    "Tsunami Warning", "Tsunami Watch",
}


class NOAAConnector(BaseConnector):
    """
    Fetches NWS weather alerts for the continental US.

    FIPS codes are extracted from the alert's geocode.SAME list,
    which uses 6-digit SAME codes (leading zero + 5-digit FIPS).
    """

    @property
    def source_key(self) -> str:
        return "noaa"

    async def fetch(self, since: datetime) -> list[CanonicalEvent]:
        events: list[CanonicalEvent] = []

        initial_params = {
            "start": since.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "limit": _PAGE_SIZE,
            "status": "actual",
            "region_type": "land",
        }

        async with httpx.AsyncClient(
            timeout=30.0,
            headers={"User-Agent": "PRISM/0.1 (disaster-risk-platform)"},
        ) as client:
            url: str | None = str(httpx.URL(_BASE, params=initial_params))

            while url:
                # Follow the full next URL directly — re-adding the cursor as a
                # param would double-encode it and cause a 400.
                resp = await client.get(url)
                resp.raise_for_status()

                payload = resp.json()
                features = payload.get("features", [])
                if not features:
                    break

                for feat in features:
                    for event in self._to_canonical_per_county(feat):
                        events.append(event)

                url = payload.get("pagination", {}).get("next")

        log.info("NWS fetched %d alert-county records since %s", len(events), since.date())
        return events

    def _to_canonical_per_county(self, feat: dict) -> list[CanonicalEvent]:
        """
        One NWS alert can span multiple counties. Emit one CanonicalEvent
        per county so each gets its own risk signal.
        """
        props = feat.get("properties", {})
        event_type = props.get("event", "")

        if event_type not in _SIGNIFICANT_EVENTS:
            return []

        # SAME geocodes are 6-digit strings: "0" + 5-digit FIPS
        same_codes: list[str] = props.get("geocode", {}).get("SAME", [])
        fips_list = [code[1:] for code in same_codes if len(code) == 6]
        if not fips_list:
            fips_list = [None]  # type: ignore[list-item]

        severity = severity_from_noaa_magnitude(None, event_type)

        try:
            start = datetime.fromisoformat(
                props["effective"].replace("Z", "+00:00")
            )
        except (KeyError, ValueError, AttributeError):
            start = None
        try:
            end = datetime.fromisoformat(
                props["expires"].replace("Z", "+00:00")
            )
        except (KeyError, ValueError, AttributeError):
            end = None

        alert_id = feat.get("id", "")

        return [
            CanonicalEvent(
                source_key="noaa",
                external_id=f"{alert_id}:{fips or 'unknown'}",
                fips_code=fips,
                event_type="weather",
                event_subtype=event_type,
                severity=severity,
                event_start=start,
                event_end=end,
                raw_data=props,
            )
            for fips in fips_list
        ]
