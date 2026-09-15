from datetime import datetime
from decimal import Decimal
from typing import Any, Iterable

from . import db

THRESHOLD_COLUMNS = (
    "min_voltage",
    "max_voltage",
    "min_current",
    "max_current",
    "min_power",
    "max_power",
    "min_frequency",
    "max_frequency",
    "min_power_factor",
    "max_power_factor",
    "min_water_flow",
    "max_water_flow",
)

USER_FIELDS = ("name", "phone", "password", "electric_price", "water_price")
DEVICE_FIELDS = ("name", "location", "user_id", *THRESHOLD_COLUMNS)
AGGREGATION_LEVELS = ("minute", "hour", "day", "month", "year")


def _norm(record: Any) -> dict | None:
    if record is None:
        return None
    out: dict[str, Any] = {}
    for key, value in dict(record).items():
        if isinstance(value, Decimal):
            value = float(value)
        out[key] = value
    return out


async def _update(
    table: str, row_id: int, fields: dict, allowed: Iterable[str]
) -> dict | None:
    columns = [key for key in fields if key in set(allowed)]
    if not columns:
        return None
    assignments = ", ".join(f"{name} = ${index + 1}" for index, name in enumerate(columns))
    values: list[Any] = [fields[name] for name in columns]
    values.append(row_id)
    query = (
        f"UPDATE {table} SET {assignments}, updated_at = NOW() "
        f"WHERE id = ${len(values)} RETURNING *"
    )
    row = await db.pool().fetchrow(query, *values)
    return _norm(row)


async def create_user(
    name: str, phone: str, password: str, electric_price: float = 0, water_price: float = 10000.0
) -> dict | None:
    row = await db.pool().fetchrow(
        """
        INSERT INTO users (name, phone, password, electric_price, water_price)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (phone) DO NOTHING
        RETURNING *
        """,
        name,
        phone,
        password,
        electric_price,
        water_price,
    )
    return _norm(row)


async def get_user(user_id: int) -> dict | None:
    row = await db.pool().fetchrow("SELECT * FROM users WHERE id = $1", user_id)
    return _norm(row)


async def get_user_by_phone(phone: str) -> dict | None:
    row = await db.pool().fetchrow("SELECT * FROM users WHERE phone = $1", phone)
    return _norm(row)


async def update_user(user_id: int, fields: dict) -> dict | None:
    return await _update("users", user_id, fields, USER_FIELDS)


async def get_or_create_device(code: str, defaults: dict) -> dict:
    columns = ", ".join(defaults.keys())
    placeholders = ", ".join(f"${index + 2}" for index in range(len(defaults)))
    query = (
        f"INSERT INTO devices (code, {columns}) VALUES ($1, {placeholders}) "
        f"ON CONFLICT (code) DO UPDATE SET code = devices.code "
        f"RETURNING *"
    )
    row = await db.pool().fetchrow(query, code, *defaults.values())
    return _norm(row)


async def get_device(device_id: int) -> dict | None:
    row = await db.pool().fetchrow("SELECT * FROM devices WHERE id = $1", device_id)
    return _norm(row)


async def get_device_by_code(code: str) -> dict | None:
    row = await db.pool().fetchrow("SELECT * FROM devices WHERE code = $1", code)
    return _norm(row)


async def list_devices(user_id: int) -> list[dict]:
    rows = await db.pool().fetch(
        "SELECT * FROM devices WHERE user_id = $1 ORDER BY created_at ASC", user_id
    )
    return [_norm(row) for row in rows]


async def list_owned_devices() -> list[dict]:
    rows = await db.pool().fetch(
        "SELECT * FROM devices WHERE user_id IS NOT NULL ORDER BY id ASC"
    )
    return [_norm(row) for row in rows]


async def update_device(device_id: int, fields: dict) -> dict | None:
    return await _update("devices", device_id, fields, DEVICE_FIELDS)


async def unassign_device(device_id: int) -> dict | None:
    row = await db.pool().fetchrow(
        "UPDATE devices SET user_id = NULL, updated_at = NOW() WHERE id = $1 RETURNING *",
        device_id,
    )
    return _norm(row)


async def insert_telemetry(device_id: int, code: str, reading: dict) -> dict:
    row = await db.pool().fetchrow(
        """
        INSERT INTO telemetry (
            device_id, device_code, power, voltage, current, frequency,
            power_factor, energy_total, water_flow_lpm, water_total_l,
            pulse_count, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
        """,
        device_id,
        code,
        reading["power"],
        reading["voltage"],
        reading["current"],
        reading["frequency"],
        reading["power_factor"],
        reading["energy_total"],
        reading["water_flow_lpm"],
        reading["water_total_l"],
        reading["pulse_count"],
        reading["timestamp"],
    )
    return _norm(row)


async def latest_telemetry(device_id: int) -> dict | None:
    row = await db.pool().fetchrow(
        "SELECT * FROM telemetry WHERE device_id = $1 ORDER BY timestamp DESC LIMIT 1",
        device_id,
    )
    return _norm(row)


async def list_telemetry(
    device_id: int,
    start: datetime | None,
    end: datetime | None,
    limit: int,
    offset: int,
) -> list[dict]:
    rows = await db.pool().fetch(
        """
        SELECT * FROM telemetry
        WHERE device_id = $1
          AND ($2::timestamptz IS NULL OR timestamp >= $2)
          AND ($3::timestamptz IS NULL OR timestamp < $3)
        ORDER BY timestamp DESC
        LIMIT $4 OFFSET $5
        """,
        device_id,
        start,
        end,
        limit,
        offset,
    )
    return [_norm(row) for row in rows]


async def count_telemetry(
    device_id: int, start: datetime | None, end: datetime | None
) -> int:
    return await db.pool().fetchval(
        """
        SELECT count(*) FROM telemetry
        WHERE device_id = $1
          AND ($2::timestamptz IS NULL OR timestamp >= $2)
          AND ($3::timestamptz IS NULL OR timestamp < $3)
        """,
        device_id,
        start,
        end,
    )


async def summary_telemetry(
    device_id: int,
    level: str,
    start: datetime,
    end: datetime,
    timezone: str,
) -> list[dict]:
    rows = await db.pool().fetch(
        """
        WITH readings AS (
            SELECT
                timestamp,
                voltage,
                current,
                power,
                power_factor,
                frequency,
                water_flow_lpm,
                energy_total,
                water_total_l,
                lag(energy_total) OVER (ORDER BY timestamp) AS prev_energy,
                lag(water_total_l) OVER (ORDER BY timestamp) AS prev_water
            FROM telemetry
            WHERE device_id = $1 AND timestamp >= $2 AND timestamp < $3
        )
        SELECT
            date_trunc($4, timestamp AT TIME ZONE $5) AS bucket,
            count(*) AS samples,
            avg(voltage)::float8 AS avg_voltage,
            avg(current)::float8 AS avg_current,
            avg(power)::float8 AS avg_power,
            avg(power_factor)::float8 AS avg_power_factor,
            avg(frequency)::float8 AS avg_frequency,
            avg(water_flow_lpm)::float8 AS avg_water_flow_lpm,
            coalesce(sum(greatest(energy_total - prev_energy, 0)), 0)::float8 AS energy_kwh,
            coalesce(sum(greatest(water_total_l - prev_water, 0)), 0)::float8 AS water_l
        FROM readings
        GROUP BY bucket
        ORDER BY bucket
        """,
        device_id,
        start,
        end,
        level,
        timezone,
    )
    return [_norm(row) for row in rows]


async def daily_consumption(
    device_id: int, start: datetime, end: datetime, timezone: str
) -> list[dict]:
    rows = await db.pool().fetch(
        """
        WITH readings AS (
            SELECT
                timestamp,
                energy_total,
                water_total_l,
                lag(energy_total) OVER (ORDER BY timestamp) AS prev_energy,
                lag(water_total_l) OVER (ORDER BY timestamp) AS prev_water
            FROM telemetry
            WHERE device_id = $1 AND timestamp >= $2 AND timestamp < $3
        )
        SELECT
            date_trunc('day', timestamp AT TIME ZONE $4)::date AS day,
            coalesce(sum(greatest(energy_total - prev_energy, 0)), 0)::float8 AS energy_kwh,
            coalesce(sum(greatest(water_total_l - prev_water, 0)), 0)::float8 AS water_l
        FROM readings
        GROUP BY day
        ORDER BY day
        """,
        device_id,
        start,
        end,
        timezone,
    )
    return [_norm(row) for row in rows]


async def monthly_consumption(
    device_id: int, start: datetime, end: datetime, timezone: str
) -> list[dict]:
    rows = await db.pool().fetch(
        """
        WITH readings AS (
            SELECT
                timestamp,
                energy_total,
                water_total_l,
                lag(energy_total) OVER (ORDER BY timestamp) AS prev_energy,
                lag(water_total_l) OVER (ORDER BY timestamp) AS prev_water
            FROM telemetry
            WHERE device_id = $1 AND timestamp >= $2 AND timestamp < $3
        )
        SELECT
            date_trunc('month', timestamp AT TIME ZONE $4)::date AS month,
            coalesce(sum(greatest(energy_total - prev_energy, 0)), 0)::float8 AS energy_kwh,
            coalesce(sum(greatest(water_total_l - prev_water, 0)), 0)::float8 AS water_l
        FROM readings
        GROUP BY month
        ORDER BY month
        """,
        device_id,
        start,
        end,
        timezone,
    )
    return [_norm(row) for row in rows]


async def insert_alert(device_id: int, alert: dict) -> dict:
    row = await db.pool().fetchrow(
        """
        INSERT INTO alert_logs (device_id, metric, kind, value, limit_value, message)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        """,
        device_id,
        alert["metric"],
        alert["kind"],
        alert["value"],
        alert["limit"],
        alert["message"],
    )
    return _norm(row)


async def recent_alerts(device_id: int, limit: int = 20) -> list[dict]:
    rows = await db.pool().fetch(
        """
        SELECT * FROM alert_logs
        WHERE device_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        device_id,
        limit,
    )
async def delete_alert(alert_id: int, user_id: int) -> bool:
    res = await db.pool().execute(
        """
        DELETE FROM alert_logs
        WHERE id = $1
          AND device_id IN (SELECT id FROM devices WHERE user_id = $2)
        """,
        alert_id,
        user_id,
    )
    return res == "DELETE 1"


async def alert_exists_since(device_id: int, metric: str, since: datetime) -> bool:
    return await db.pool().fetchval(
        """
        SELECT EXISTS(
            SELECT 1 FROM alert_logs
            WHERE device_id = $1 AND metric = $2 AND created_at >= $3
        )
        """,
        device_id,
        metric,
        since,
    )


async def hourly_series(
    device_id: int, start: datetime, end: datetime, timezone: str
) -> list[dict]:
    rows = await db.pool().fetch(
        """
        SELECT
            date_trunc('hour', timestamp AT TIME ZONE $4) AS bucket,
            avg(power)::float8 AS avg_power,
            avg(water_flow_lpm)::float8 AS avg_water_flow,
            count(*)::int AS samples
        FROM telemetry
        WHERE device_id = $1 AND timestamp >= $2 AND timestamp < $3
        GROUP BY bucket
        ORDER BY bucket
        """,
        device_id,
        start,
        end,
        timezone,
    )
    return [_norm(row) for row in rows]


async def hourly_baseline(
    device_id: int, start: datetime, end: datetime, timezone: str
) -> list[dict]:
    rows = await db.pool().fetch(
        """
        WITH hourly AS (
            SELECT
                date_trunc('hour', timestamp AT TIME ZONE $4) AS bucket,
                avg(power)::float8 AS avg_power,
                avg(water_flow_lpm)::float8 AS avg_water_flow
            FROM telemetry
            WHERE device_id = $1 AND timestamp >= $2 AND timestamp < $3
            GROUP BY bucket
        ),
        keyed AS (
            SELECT
                extract(dow FROM bucket)::int AS weekday,
                extract(hour FROM bucket)::int AS hour_of_day,
                avg_power,
                avg_water_flow
            FROM hourly
        ),
        centers AS (
            SELECT
                weekday,
                hour_of_day,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY avg_power) AS power_center,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY avg_water_flow) AS water_center,
                count(*)::int AS sample_days
            FROM keyed
            GROUP BY weekday, hour_of_day
        ),
        scales AS (
            SELECT
                k.weekday,
                k.hour_of_day,
                percentile_cont(0.5)
                    WITHIN GROUP (ORDER BY abs(k.avg_power - c.power_center)) AS power_scale,
                percentile_cont(0.5)
                    WITHIN GROUP (ORDER BY abs(k.avg_water_flow - c.water_center)) AS water_scale
            FROM keyed k
            JOIN centers c
              ON c.weekday = k.weekday AND c.hour_of_day = k.hour_of_day
            GROUP BY k.weekday, k.hour_of_day
        )
        SELECT
            c.weekday,
            c.hour_of_day AS hour,
            c.power_center::float8 AS power_center,
            coalesce(s.power_scale, 0)::float8 AS power_scale,
            c.water_center::float8 AS water_center,
            coalesce(s.water_scale, 0)::float8 AS water_scale,
            c.sample_days
        FROM centers c
        LEFT JOIN scales s
          ON s.weekday = c.weekday AND s.hour_of_day = c.hour_of_day
        ORDER BY c.weekday, c.hour_of_day
        """,
        device_id,
        start,
        end,
        timezone,
    )
    return [_norm(row) for row in rows]


async def metric_percentiles(
    device_id: int, start: datetime, load_current: float
) -> dict:
    row = await db.pool().fetchrow(
        """
        SELECT
            count(*)::int AS samples,
            count(*) FILTER (WHERE current >= $3)::int AS loaded_samples,
            percentile_cont(0.01) WITHIN GROUP (ORDER BY voltage)::float8 AS voltage_low,
            percentile_cont(0.99) WITHIN GROUP (ORDER BY voltage)::float8 AS voltage_high,
            percentile_cont(0.99) WITHIN GROUP (ORDER BY current)::float8 AS current_high,
            percentile_cont(0.99) WITHIN GROUP (ORDER BY power)::float8 AS power_high,
            percentile_cont(0.01) WITHIN GROUP (ORDER BY frequency)::float8 AS frequency_low,
            percentile_cont(0.99) WITHIN GROUP (ORDER BY frequency)::float8 AS frequency_high,
            percentile_cont(0.01) WITHIN GROUP (ORDER BY power_factor)
                FILTER (WHERE current >= $3)::float8 AS power_factor_low,
            percentile_cont(0.99) WITHIN GROUP (ORDER BY water_flow_lpm)
                FILTER (WHERE water_flow_lpm > 0)::float8 AS water_flow_high
        FROM telemetry
        WHERE device_id = $1 AND timestamp >= $2
        """,
        device_id,
        start,
        load_current,
    )
    return _norm(row)


async def nightly_water(
    device_id: int,
    start: datetime,
    end: datetime,
    timezone: str,
    flow_threshold: float,
    start_hour: int,
    end_hour: int,
) -> list[dict]:
    rows = await db.pool().fetch(
        """
        WITH night_readings AS (
            SELECT
                (timestamp AT TIME ZONE $4)::date AS night,
                timestamp,
                water_flow_lpm,
                water_total_l
            FROM telemetry
            WHERE device_id = $1 AND timestamp >= $2 AND timestamp < $3
              AND extract(hour FROM timestamp AT TIME ZONE $4) >= $6
              AND extract(hour FROM timestamp AT TIME ZONE $4) < $7
        ),
        with_delta AS (
            SELECT
                night,
                water_flow_lpm,
                water_total_l
                    - lag(water_total_l) OVER (PARTITION BY night ORDER BY timestamp)
                    AS delta
            FROM night_readings
        )
        SELECT
            night,
            count(*)::int AS samples,
            count(*) FILTER (WHERE water_flow_lpm >= $5)::int AS flowing_samples,
            coalesce(sum(greatest(delta, 0)), 0)::float8 AS volume_l,
            coalesce(max(water_flow_lpm), 0)::float8 AS max_flow,
            coalesce(avg(water_flow_lpm), 0)::float8 AS avg_flow
        FROM with_delta
        GROUP BY night
        ORDER BY night
        """,
        device_id,
        start,
        end,
        timezone,
        flow_threshold,
        start_hour,
        end_hour,
    )
    return [_norm(row) for row in rows]
