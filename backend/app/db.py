import asyncio
import logging

import asyncpg

from .config import settings

log = logging.getLogger("smartwatt.db")

_pool: asyncpg.Pool | None = None


async def _ensure_migrations(pool: asyncpg.Pool) -> None:
    try:
        await pool.execute(
            """
            ALTER TABLE users ADD COLUMN IF NOT EXISTS water_price NUMERIC(12,4) DEFAULT 10000;
            """
        )
    except Exception as exc:
        log.warning("migration check failed: %s", exc)


async def connect(attempts: int = 15, delay: float = 2.0) -> None:
    global _pool
    last_error: Exception | None = None

    for attempt in range(1, attempts + 1):
        try:
            _pool = await asyncpg.create_pool(
                settings.database_url,
                min_size=1,
                max_size=10,
                server_settings={"timezone": "UTC"},
            )
            await _ensure_migrations(_pool)
            return
        except (OSError, asyncpg.PostgresError) as error:
            last_error = error
            log.warning(
                "database not ready (attempt %s/%s): %s", attempt, attempts, error
            )
            await asyncio.sleep(delay)

    raise RuntimeError(f"cannot reach database at {settings.db_host}: {last_error}")


async def disconnect() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("database pool is not connected")
    return _pool
