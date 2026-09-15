from datetime import datetime, timedelta, timezone

from . import repo
from .config import settings

MARGIN = 0.05
MIN_SAMPLES = 200
LOAD_CURRENT = 0.5
MAX_LOOSE_FACTOR = 1.5
MIN_LOOSE_FACTOR = 0.5

STATUS_OK = "ok"
STATUS_TOO_TIGHT = "too_tight"
STATUS_TOO_LOOSE = "too_loose"
STATUS_MISSING = "missing"
STATUS_INSUFFICIENT = "insufficient_data"

HIGH_SPECS = (
    ("voltage", "max_voltage", "voltage_high", 1),
    ("current", "max_current", "current_high", 2),
    ("power", "max_power", "power_high", 0),
    ("frequency", "max_frequency", "frequency_high", 1),
    ("water_flow_lpm", "max_water_flow", "water_flow_high", 2),
)

LOW_SPECS = (
    ("voltage", "min_voltage", "voltage_low", 1),
    ("frequency", "min_frequency", "frequency_low", 1),
    ("power_factor", "min_power_factor", "power_factor_low", 2),
)

NOT_DERIVED = (
    (
        "min_current",
        "Dòng điện thấp là bình thường khi không có tải, không suy ra được ngưỡng dưới từ thống kê",
    ),
    (
        "min_power",
        "Công suất thấp là bình thường khi không có tải, không suy ra được ngưỡng dưới từ thống kê",
    ),
    (
        "max_power_factor",
        "Hệ số công suất không vượt quá 1, ngưỡng trên không có ý nghĩa",
    ),
    (
        "min_water_flow",
        "Không có nước chảy là bình thường, không suy ra được ngưỡng dưới từ thống kê",
    ),
)


def _max_status(current: float | None, observed: float, suggested: float) -> str:
    if current is None:
        return STATUS_MISSING
    if current < observed:
        return STATUS_TOO_TIGHT
    if current > suggested * MAX_LOOSE_FACTOR:
        return STATUS_TOO_LOOSE
    return STATUS_OK


def _min_status(current: float | None, observed: float, suggested: float) -> str:
    if current is None:
        return STATUS_MISSING
    if current > observed:
        return STATUS_TOO_TIGHT
    if current < suggested * MIN_LOOSE_FACTOR:
        return STATUS_TOO_LOOSE
    return STATUS_OK


async def suggest_thresholds(device: dict, days: int | None = None) -> dict:
    days = days or settings.threshold_window_days
    start = datetime.now(timezone.utc) - timedelta(days=days)
    stats = await repo.metric_percentiles(device["id"], start, LOAD_CURRENT)
    ready = stats["samples"] >= MIN_SAMPLES

    suggestions = []
    for metric, column, key, decimals in HIGH_SPECS:
        observed = stats[key]
        if not ready or observed is None:
            suggestions.append(_insufficient(metric, column, device[column]))
            continue
        suggested = round(observed * (1 + MARGIN), decimals)
        suggestions.append(
            {
                "metric": metric,
                "column": column,
                "direction": "max",
                "percentile": 0.99,
                "observed_value": round(observed, decimals),
                "current_value": device[column],
                "suggested_value": suggested,
                "status": _max_status(device[column], observed, suggested),
                "sample_count": stats["samples"],
            }
        )

    for metric, column, key, decimals in LOW_SPECS:
        observed = stats[key]
        if not ready or observed is None:
            suggestions.append(_insufficient(metric, column, device[column]))
            continue
        suggested = round(observed * (1 - MARGIN), decimals)
        suggestions.append(
            {
                "metric": metric,
                "column": column,
                "direction": "min",
                "percentile": 0.01,
                "observed_value": round(observed, decimals),
                "current_value": device[column],
                "suggested_value": suggested,
                "status": _min_status(device[column], observed, suggested),
                "sample_count": stats["loaded_samples"]
                if column == "min_power_factor"
                else stats["samples"],
            }
        )

    return {
        "days": days,
        "samples": stats["samples"],
        "loaded_samples": stats["loaded_samples"],
        "min_samples": MIN_SAMPLES,
        "margin_percent": MARGIN * 100,
        "ready": ready,
        "suggestions": suggestions,
        "not_derived": [
            {"column": column, "reason": reason} for column, reason in NOT_DERIVED
        ],
    }


def _insufficient(metric: str, column: str, current: float | None) -> dict:
    return {
        "metric": metric,
        "column": column,
        "direction": "max",
        "percentile": None,
        "observed_value": None,
        "current_value": current,
        "suggested_value": None,
        "status": STATUS_INSUFFICIENT,
        "sample_count": 0,
    }


async def apply_thresholds(
    device: dict, columns: list[str], days: int | None = None
) -> tuple[dict | None, list[str], dict]:
    report = await suggest_thresholds(device, days)
    requested = set(columns)
    updates = {
        item["column"]: item["suggested_value"]
        for item in report["suggestions"]
        if item["column"] in requested and item["suggested_value"] is not None
    }
    if not updates:
        return None, [], report

    updated = await repo.update_device(device["id"], updates)
    return updated, sorted(updates), report
