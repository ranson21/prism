"""
Normalizer: maps raw upstream payloads to SeverityLabel.

Each connector handles its own field mapping and calls severity_from_*
helpers here to produce a consistent SeverityLabel across all sources.
"""

from app.models.events import SeverityLabel


def severity_from_fema_type(incident_type: str, declaration_type: str) -> SeverityLabel:
    """
    Map FEMA incident type + declaration type to a canonical severity.

    Declaration types: DR (Major Disaster), EM (Emergency), FM (Fire Management)
    """
    declaration_type = (declaration_type or "").upper()
    incident_type = (incident_type or "").lower()

    if declaration_type == "DR":
        severe = {"hurricane", "earthquake", "tsunami", "tornado"}
        if any(h in incident_type for h in severe):
            return "extreme"
        return "major"
    if declaration_type == "EM":
        return "moderate"
    return "minor"


def severity_from_noaa_magnitude(magnitude: float | None, event_type: str) -> SeverityLabel:
    """Map NOAA event type + numeric magnitude to a severity label."""
    high_impact = {
        "tornado", "hurricane", "typhoon", "flash flood", "blizzard",
        "ice storm", "wildfire",
    }
    event_lower = (event_type or "").lower()

    if any(h in event_lower for h in high_impact):
        return "extreme" if (magnitude or 0) > 5 else "major"
    if (magnitude or 0) > 3:
        return "moderate"
    return "minor"


def severity_from_earthquake_magnitude(magnitude: float) -> SeverityLabel:
    """Map Richter/moment magnitude to severity."""
    if magnitude >= 7.0:
        return "extreme"
    if magnitude >= 5.5:
        return "major"
    if magnitude >= 4.0:
        return "moderate"
    return "minor"


def fips_from_state_county(state_fips: str, county_fips: str) -> str | None:
    """Concatenate state + county FIPS codes into a 5-digit FIPS string."""
    if not state_fips or not county_fips:
        return None
    return f"{state_fips.zfill(2)}{county_fips.zfill(3)}"
