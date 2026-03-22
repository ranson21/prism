"""Database connection pool using psycopg3."""

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import psycopg
from psycopg_pool import AsyncConnectionPool

_pool: AsyncConnectionPool | None = None


def _dsn() -> str:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL environment variable is required")
    return dsn


async def init_pool() -> None:
    global _pool
    _pool = AsyncConnectionPool(conninfo=_dsn(), min_size=2, max_size=10, open=False)
    await _pool.open()


async def close_pool() -> None:
    if _pool:
        await _pool.close()


@asynccontextmanager
async def get_conn() -> AsyncGenerator[psycopg.AsyncConnection, None]:
    if _pool is None:
        raise RuntimeError("Database pool is not initialized")
    async with _pool.connection() as conn:
        yield conn
