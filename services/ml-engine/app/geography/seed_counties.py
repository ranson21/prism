"""
Seed geography.counties from the US Census Bureau API.

Source: Census Bureau Population Estimates (no API key required)
Endpoint: https://api.census.gov/data/2019/pep/population

Run once before ingestion:
    poetry run python -m app.geography.seed_counties
"""

import asyncio
import logging

import httpx
import psycopg
from psycopg.types.json import Jsonb

from app.db import close_pool, init_pool, get_conn

log = logging.getLogger(__name__)

_CENSUS_PEP_URL = "https://api.census.gov/data/2019/pep/population"
_CENSUS_ACS_URL = "https://api.census.gov/data/2019/acs/acs5"

STATE_NAMES: dict[str, tuple[str, str]] = {
    "01": ("Alabama", "AL"), "02": ("Alaska", "AK"), "04": ("Arizona", "AZ"),
    "05": ("Arkansas", "AR"), "06": ("California", "CA"), "08": ("Colorado", "CO"),
    "09": ("Connecticut", "CT"), "10": ("Delaware", "DE"), "11": ("District of Columbia", "DC"),
    "12": ("Florida", "FL"), "13": ("Georgia", "GA"), "15": ("Hawaii", "HI"),
    "16": ("Idaho", "ID"), "17": ("Illinois", "IL"), "18": ("Indiana", "IN"),
    "19": ("Iowa", "IA"), "20": ("Kansas", "KS"), "21": ("Kentucky", "KY"),
    "22": ("Louisiana", "LA"), "23": ("Maine", "ME"), "24": ("Maryland", "MD"),
    "25": ("Massachusetts", "MA"), "26": ("Michigan", "MI"), "27": ("Minnesota", "MN"),
    "28": ("Mississippi", "MS"), "29": ("Missouri", "MO"), "30": ("Montana", "MT"),
    "31": ("Nebraska", "NE"), "32": ("Nevada", "NV"), "33": ("New Hampshire", "NH"),
    "34": ("New Jersey", "NJ"), "35": ("New Mexico", "NM"), "36": ("New York", "NY"),
    "37": ("North Carolina", "NC"), "38": ("North Dakota", "ND"), "39": ("Ohio", "OH"),
    "40": ("Oklahoma", "OK"), "41": ("Oregon", "OR"), "42": ("Pennsylvania", "PA"),
    "44": ("Rhode Island", "RI"), "45": ("South Carolina", "SC"), "46": ("South Dakota", "SD"),
    "47": ("Tennessee", "TN"), "48": ("Texas", "TX"), "49": ("Utah", "UT"),
    "50": ("Vermont", "VT"), "51": ("Virginia", "VA"), "53": ("Washington", "WA"),
    "54": ("West Virginia", "WV"), "55": ("Wisconsin", "WI"), "56": ("Wyoming", "WY"),
    "72": ("Puerto Rico", "PR"),
}


async def _fetch_median_income(client: httpx.AsyncClient) -> dict[str, int | None]:
    """
    Fetch median household income (B19013_001E) from the Census ACS 5-year estimates.
    Returns a dict keyed by 5-digit FIPS code.
    Null or negative values (Census sentinel −666666666) are stored as None.
    """
    try:
        resp = await client.get(
            _CENSUS_ACS_URL,
            params={
                "get": "B19013_001E",
                "for": "county:*",
                "in": "state:*",
            },
        )
        resp.raise_for_status()
        rows = resp.json()
    except Exception as exc:
        log.warning("Could not fetch median income from Census ACS: %s", exc)
        return {}

    headers = rows[0]
    income_idx = headers.index("B19013_001E")
    state_idx = headers.index("state")
    county_idx = headers.index("county")

    income_by_fips: dict[str, int | None] = {}
    for row in rows[1:]:
        state_fips = row[state_idx].zfill(2)
        county_fips = row[county_idx].zfill(3)
        fips_code = f"{state_fips}{county_fips}"
        try:
            val = int(row[income_idx])
            income_by_fips[fips_code] = val if val > 0 else None
        except (TypeError, ValueError):
            income_by_fips[fips_code] = None

    return income_by_fips


async def seed() -> None:
    log.info("Fetching county data from Census Bureau...")

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(
            _CENSUS_PEP_URL,
            params={
                "get": "NAME,POP",
                "for": "county:*",
                "in": "state:*",
            },
        )
        resp.raise_for_status()
        rows = resp.json()

        log.info("Fetching median household income from Census ACS...")
        income_by_fips = await _fetch_median_income(client)

    # First row is headers: [NAME, POP, state, county]
    headers = rows[0]
    name_idx = headers.index("NAME")
    pop_idx = headers.index("POP")
    state_idx = headers.index("state")
    county_idx = headers.index("county")

    counties = []
    for row in rows[1:]:
        state_fips = row[state_idx].zfill(2)
        county_fips = row[county_idx].zfill(3)
        fips_code = f"{state_fips}{county_fips}"
        full_name = row[name_idx]  # e.g. "Los Angeles County, California"
        county_name = full_name.split(",")[0].strip()
        state_info = STATE_NAMES.get(state_fips, ("Unknown", "??"))
        try:
            population = int(row[pop_idx])
        except (TypeError, ValueError):
            population = None

        counties.append((
            fips_code,
            county_name,
            state_fips,
            state_info[0],
            state_info[1],
            population,
            income_by_fips.get(fips_code),
        ))

    log.info("Inserting %d counties (with income data for %d)...", len(counties), sum(1 for c in counties if c[6] is not None))

    async with get_conn() as conn:
        async with conn.cursor() as cur:
            await cur.executemany(
                """
                INSERT INTO geography.counties
                    (fips_code, county_name, state_fips, state_name, state_abbr, population, median_household_income)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (fips_code) DO UPDATE SET
                    county_name              = EXCLUDED.county_name,
                    population               = EXCLUDED.population,
                    median_household_income  = EXCLUDED.median_household_income,
                    updated_at               = now()
                """,
                counties,
            )
        await conn.commit()

    log.info("Counties seeded successfully.")


async def get_valid_fips(conn: psycopg.AsyncConnection) -> set[str]:
    """Return the set of all known FIPS codes from geography.counties."""
    rows = await (await conn.execute("SELECT fips_code FROM geography.counties")).fetchall()
    return {row[0] for row in rows}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    from dotenv import load_dotenv
    load_dotenv()

    async def main() -> None:
        await init_pool()
        try:
            await seed()
        finally:
            await close_pool()

    asyncio.run(main())
