"""Run SQL migrations from the bundled migrations/ directory.

Usage:
    python -m app.migrate
"""

import sys
from pathlib import Path

import psycopg


def run() -> None:
    from app.db import _dsn
    try:
        dsn = _dsn()
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    migrations_dir = Path(__file__).parent.parent / "migrations"
    files = sorted(migrations_dir.glob("*.sql"))

    if not files:
        print("No migration files found in", migrations_dir)
        return

    with psycopg.connect(dsn) as conn:
        for path in files:
            print(f"  → {path.name}")
            sql = path.read_text()
            with conn.transaction():
                conn.execute(sql)

    print("✓ Migrations complete")


if __name__ == "__main__":
    run()
