"""
Ingestion pipeline orchestrator.

Responsibilities:
1. Open an ingestion_run record
2. Call each connector's fetch()
3. Deduplicate against existing raw_events (ON CONFLICT DO NOTHING)
4. Write events to datasets.raw_events
5. Close the ingestion_run with counts and status
"""

import logging
from datetime import datetime, timedelta, timezone

import psycopg
from psycopg.types.json import Jsonb

from app.db import get_conn
from app.geography.seed_counties import get_valid_fips
from app.ingestion.base import BaseConnector
from app.ingestion.fema import FEMAConnector
from app.ingestion.noaa import NOAAConnector
from app.ingestion.usgs import USGSConnector
from app.models.events import CanonicalEvent, IngestionResult

log = logging.getLogger(__name__)

_DEFAULT_LOOKBACK_DAYS = 90

_CONNECTORS: list[BaseConnector] = [
    FEMAConnector(),
    NOAAConnector(),
    USGSConnector(),
]


async def run_ingestion(
    source_keys: list[str] | None = None,
    since: datetime | None = None,
) -> list[IngestionResult]:
    """
    Run the full ingestion pipeline.

    Args:
        source_keys: Subset of connectors to run. None = all.
        since: Fetch records after this time. Defaults to 90 days ago.

    Returns:
        One IngestionResult per connector run.
    """
    if since is None:
        since = datetime.now(tz=timezone.utc) - timedelta(days=_DEFAULT_LOOKBACK_DAYS)

    connectors = [
        c for c in _CONNECTORS
        if source_keys is None or c.source_key in source_keys
    ]

    results: list[IngestionResult] = []
    for connector in connectors:
        result = await _run_connector(connector, since)
        results.append(result)

    return results


async def _run_connector(connector: BaseConnector, since: datetime) -> IngestionResult:
    source_key = connector.source_key
    run_id: str | None = None

    async with get_conn() as conn:
        run_id = await _open_run(conn, source_key, since)

    fetched = 0
    inserted = 0
    skipped = 0
    error: str | None = None

    try:
        events = await connector.fetch(since)
        fetched = len(events)

        async with get_conn() as conn:
            valid_fips = await get_valid_fips(conn)
            # Null out FIPS codes not present in geography.counties to avoid FK violations.
            # Unresolvable codes are preserved in raw_data for later enrichment.
            for event in events:
                if event.fips_code and event.fips_code not in valid_fips:
                    event.fips_code = None
            inserted, skipped = await _write_events(conn, events, run_id)

    except Exception as exc:
        log.exception("Ingestion failed for source=%s", source_key)
        error = str(exc)

    async with get_conn() as conn:
        await _close_run(conn, run_id, fetched, inserted, skipped, error)

    return IngestionResult(
        source_key=source_key,
        records_fetched=fetched,
        records_inserted=inserted,
        records_skipped=skipped,
        error_message=error,
    )


async def _open_run(conn: psycopg.AsyncConnection, source_key: str, since: datetime) -> str:
    row = await conn.execute(
        """
        INSERT INTO datasets.ingestion_runs (source_key, parameters)
        VALUES (%s, %s)
        RETURNING id
        """,
        (source_key, Jsonb({"since": since.isoformat()})),
    )
    result = await row.fetchone()
    await conn.commit()
    return str(result[0])


async def _write_events(
    conn: psycopg.AsyncConnection,
    events: list[CanonicalEvent],
    run_id: str,
) -> tuple[int, int]:
    """Bulk insert events; track inserted vs skipped (duplicate) counts."""
    inserted = 0
    skipped = 0

    # Use executemany with ON CONFLICT DO NOTHING for deduplication
    for event in events:
        result = await conn.execute(
            """
            INSERT INTO datasets.raw_events
                (source_key, external_id, fips_code, event_type, event_subtype,
                 severity, event_start, event_end, raw_data, ingestion_run_id)
            VALUES
                (%(source_key)s, %(external_id)s, %(fips_code)s, %(event_type)s,
                 %(event_subtype)s, %(severity)s, %(event_start)s, %(event_end)s,
                 %(raw_data)s, %(run_id)s)
            ON CONFLICT (source_key, external_id) DO NOTHING
            """,
            {
                "source_key": event.source_key,
                "external_id": event.external_id,
                "fips_code": event.fips_code,
                "event_type": event.event_type,
                "event_subtype": event.event_subtype,
                "severity": event.severity,
                "event_start": event.event_start,
                "event_end": event.event_end,
                "raw_data": Jsonb(event.raw_data),
                "run_id": run_id,
            },
        )
        if result.rowcount == 1:
            inserted += 1
        else:
            skipped += 1

    await conn.commit()
    return inserted, skipped


async def _close_run(
    conn: psycopg.AsyncConnection,
    run_id: str,
    fetched: int,
    inserted: int,
    skipped: int,
    error: str | None,
) -> None:
    status = "failed" if error else "success"
    await conn.execute(
        """
        UPDATE datasets.ingestion_runs
        SET completed_at     = now(),
            status           = %s,
            records_fetched  = %s,
            records_inserted = %s,
            records_skipped  = %s,
            error_message    = %s
        WHERE id = %s
        """,
        (status, fetched, inserted, skipped, error, run_id),
    )
    await conn.commit()
