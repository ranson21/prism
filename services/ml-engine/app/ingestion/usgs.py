"""
USGS Earthquake Catalog connector — FDSN Event Web Service.

Docs: https://earthquake.usgs.gov/fdsnws/event/1/
No API key required.
"""

import logging
from datetime import datetime

import httpx

from app.ingestion.base import BaseConnector
from app.ingestion.normalizer import severity_from_earthquake_magnitude
from app.models.events import CanonicalEvent

log = logging.getLogger(__name__)

_BASE = "https://earthquake.usgs.gov/fdsnws/event/1/query"
_MIN_MAGNITUDE = 2.5        # filter noise; sub-2.5 events have negligible risk impact
_PAGE_SIZE = 1000


class USGSConnector(BaseConnector):
    """
    Fetches USGS earthquake events for the continental United States.

    USGS GeoJSON response includes county-level place descriptions but not
    FIPS codes directly. FIPS resolution is deferred to a separate county
    lookup step based on lat/lon coordinates.
    """

    @property
    def source_key(self) -> str:
        return "usgs"

    async def fetch(self, since: datetime) -> list[CanonicalEvent]:
        events: list[CanonicalEvent] = []
        offset = 1

        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                params = {
                    "format": "geojson",
                    "starttime": since.strftime("%Y-%m-%d"),
                    "endtime": datetime.utcnow().strftime("%Y-%m-%d"),
                    "minmagnitude": _MIN_MAGNITUDE,
                    "orderby": "time-asc",
                    "limit": _PAGE_SIZE,
                    "offset": offset,
                    # Continental US bounding box
                    "minlatitude": 24.396308,
                    "maxlatitude": 49.384358,
                    "minlongitude": -125.0,
                    "maxlongitude": -66.934570,
                }
                resp = await client.get(_BASE, params=params)
                resp.raise_for_status()

                payload = resp.json()
                features = payload.get("features", [])
                if not features:
                    break

                for feat in features:
                    event = self._to_canonical(feat)
                    if event:
                        events.append(event)

                if len(features) < _PAGE_SIZE:
                    break
                offset += _PAGE_SIZE

        log.info("USGS fetched %d earthquakes since %s", len(events), since.date())
        return events

    def _to_canonical(self, feat: dict) -> CanonicalEvent | None:
        props = feat.get("properties", {})
        geometry = feat.get("geometry", {})
        coords = geometry.get("coordinates", [])  # [lon, lat, depth]

        magnitude = props.get("mag")
        if magnitude is None:
            return None

        try:
            magnitude = float(magnitude)
        except (TypeError, ValueError):
            return None

        severity = severity_from_earthquake_magnitude(magnitude)

        event_time_ms = props.get("time")
        start = (
            datetime.utcfromtimestamp(event_time_ms / 1000)
            if event_time_ms is not None
            else None
        )

        # FIPS is not directly available from USGS; store lat/lon in raw_data
        # A post-processing step resolves county FIPS from coordinates
        raw_with_coords = {
            **props,
            "_lat": coords[1] if len(coords) > 1 else None,
            "_lon": coords[0] if len(coords) > 0 else None,
            "_depth_km": coords[2] if len(coords) > 2 else None,
        }

        return CanonicalEvent(
            source_key="usgs",
            external_id=feat.get("id", ""),
            fips_code=None,             # resolved in post-processing from lat/lon
            event_type="earthquake",
            event_subtype=f"M{magnitude:.1f}",
            severity=severity,
            event_start=start,
            event_end=None,
            raw_data=raw_with_coords,
        )
