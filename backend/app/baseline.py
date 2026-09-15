from datetime import date, datetime, timedelta, timezone

from . import repo
from .config import settings
from .timeutils import local_start

WEEKDAY_LABELS = (
    "Chủ nhật",
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
)

Z_THRESHOLD = settings.baseline_z_threshold
MAD_TO_SIGMA = 1.4826
POWER_MIN_SCALE = 25.0
WATER_MIN_SCALE = 0.10
POWER_MIN_DELTA = 40.0
WATER_MIN_DELTA = 0.15

STATUS_NORMAL = "normal"
STATUS_HIGH = "high"
STATUS_LOW = "low"
STATUS_NO_DATA = "no_data"
STATUS_NO_BASELINE = "no_baseline"


def _postgres_weekday(day: date) -> int:
    return (day.weekday() + 1) % 7


def _robust_z(actual: float, center: float, mad: float, min_scale: float) -> float:
    scale = max(mad * MAD_TO_SIGMA, min_scale)
    return (actual - center) / scale


def _hour_status(
    delta: float, z_score: float, min_delta: float, baseline_ready: bool
) -> str:
    if not baseline_ready:
        return STATUS_NO_BASELINE
    if z_score >= Z_THRESHOLD and delta >= min_delta:
        return STATUS_HIGH
    if z_score <= -Z_THRESHOLD and delta <= -min_delta:
        return STATUS_LOW
    return STATUS_NORMAL


async def build_profile(device_id: int, weeks: int | None = None) -> dict:
    weeks = weeks or settings.baseline_weeks
    end = datetime.now(timezone.utc)
    start = local_start((datetime.now(settings.tz) - timedelta(weeks=weeks)).date())

    rows = await repo.hourly_baseline(device_id, start, end, settings.timezone)
    grid = {(row["weekday"], row["hour"]): row for row in rows}

    cells = []
    for weekday in range(7):
        for hour in range(24):
            row = grid.get((weekday, hour))
            sample_days = row["sample_days"] if row else 0
            cells.append(
                {
                    "weekday": weekday,
                    "weekday_label": WEEKDAY_LABELS[weekday],
                    "hour": hour,
                    "power_center": row["power_center"] if row else None,
                    "power_mad": row["power_scale"] if row else None,
                    "water_center": row["water_center"] if row else None,
                    "water_mad": row["water_scale"] if row else None,
                    "sample_days": sample_days,
                    "ready": sample_days >= settings.baseline_min_days,
                }
            )

    return {
        "weeks": weeks,
        "min_days": settings.baseline_min_days,
        "start": start,
        "end": end,
        "ready_cells": sum(1 for cell in cells if cell["ready"]),
        "cells": cells,
    }


async def detect_deviation(
    device_id: int, target_date: date | None = None, weeks: int | None = None
) -> dict:
    weeks = weeks or settings.baseline_weeks
    today = datetime.now(settings.tz).date()
    target = target_date or today
    weekday = _postgres_weekday(target)

    baseline_rows = await repo.hourly_baseline(
        device_id,
        local_start(today - timedelta(weeks=weeks)),
        datetime.now(timezone.utc),
        settings.timezone,
    )
    grid = {(row["weekday"], row["hour"]): row for row in baseline_rows}

    series = await repo.hourly_series(
        device_id,
        local_start(target),
        local_start(target + timedelta(days=1)),
        settings.timezone,
    )
    measured = {row["bucket"].hour: row for row in series}

    hours = []
    actual_power_sum = 0.0
    baseline_power_sum = 0.0
    power_abnormal = []
    water_abnormal = []
    ready_cells = 0

    for hour in range(24):
        cell = grid.get((weekday, hour))
        actual = measured.get(hour)
        baseline_ready = bool(cell and cell["sample_days"] >= settings.baseline_min_days)
        if baseline_ready:
            ready_cells += 1

        entry = {
            "hour": hour,
            "sample_count": actual["samples"] if actual else 0,
            "power_actual": actual["avg_power"] if actual else None,
            "power_center": cell["power_center"] if cell else None,
            "power_mad": cell["power_scale"] if cell else None,
            "power_z": None,
            "water_actual": actual["avg_water_flow"] if actual else None,
            "water_center": cell["water_center"] if cell else None,
            "water_mad": cell["water_scale"] if cell else None,
            "water_z": None,
            "power_status": STATUS_NO_DATA,
            "water_status": STATUS_NO_DATA,
        }

        if actual and cell and cell["power_center"] is not None:
            delta = actual["avg_power"] - cell["power_center"]
            z_score = _robust_z(
                actual["avg_power"], cell["power_center"], cell["power_scale"], POWER_MIN_SCALE
            )
            entry["power_z"] = round(z_score, 2)
            entry["power_status"] = _hour_status(
                delta, z_score, POWER_MIN_DELTA, baseline_ready
            )
            actual_power_sum += actual["avg_power"]
            if entry["power_status"] in (STATUS_HIGH, STATUS_LOW):
                power_abnormal.append(hour)

        if actual and cell and cell["water_center"] is not None:
            delta = actual["avg_water_flow"] - cell["water_center"]
            z_score = _robust_z(
                actual["avg_water_flow"],
                cell["water_center"],
                cell["water_scale"],
                WATER_MIN_SCALE,
            )
            entry["water_z"] = round(z_score, 2)
            entry["water_status"] = _hour_status(
                delta, z_score, WATER_MIN_DELTA, baseline_ready
            )
            if entry["water_status"] in (STATUS_HIGH, STATUS_LOW):
                water_abnormal.append(hour)

        if cell and cell["power_center"] is not None:
            baseline_power_sum += cell["power_center"]

        hours.append(entry)

    if ready_cells == 0:
        overall = "insufficient_data"
    elif power_abnormal or water_abnormal:
        overall = "abnormal"
    else:
        overall = "normal"

    return {
        "date": target,
        "weekday": weekday,
        "weekday_label": WEEKDAY_LABELS[weekday],
        "weeks": weeks,
        "baseline_ready_cells": ready_cells,
        "status": overall,
        "actual_kwh": round(actual_power_sum / 1000, 4),
        "baseline_kwh": round(baseline_power_sum / 1000, 4),
        "power_abnormal_hours": power_abnormal,
        "water_abnormal_hours": water_abnormal,
        "hours": hours,
    }
