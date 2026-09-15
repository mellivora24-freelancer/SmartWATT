import statistics
from datetime import datetime, timedelta, timezone

from . import repo
from .config import settings
from .timeutils import local_start

FLOW_THRESHOLD = 0.10
CONTINUOUS_RATIO = 0.60
BURST_FLOW = 3.0
BURST_FACTOR = 4.0
MIN_VOLUME_L = 5.0
MIN_NIGHT_SAMPLES = 60

VERDICT_NORMAL = "normal"
VERDICT_CONTINUOUS = "leak_continuous"
VERDICT_BURST = "leak_burst"
VERDICT_INSUFFICIENT = "insufficient_data"


def _classify(night: dict, threshold_volume: float, baseline_ready: bool) -> tuple[str, str]:
    if night["samples"] < MIN_NIGHT_SAMPLES:
        return VERDICT_INSUFFICIENT, "Không đủ mẫu trong khung đêm để kết luận"

    if not baseline_ready:
        return VERDICT_INSUFFICIENT, "Chưa đủ số đêm để tạo baseline"

    flowing_ratio = night["flowing_samples"] / night["samples"]

    if night["volume_l"] >= threshold_volume and night["max_flow"] >= BURST_FLOW:
        return (
            VERDICT_BURST,
            f"Lưu lượng đêm {night['volume_l']:.1f}L vượt ngưỡng "
            f"{threshold_volume:.1f}L, đỉnh {night['max_flow']:.1f}L/phút",
        )

    if flowing_ratio >= CONTINUOUS_RATIO:
        return (
            VERDICT_CONTINUOUS,
            f"Nước chảy liên tục {flowing_ratio * 100:.0f}% thời gian trong đêm",
        )

    return VERDICT_NORMAL, "Không phát hiện bất thường"


async def analyse(device_id: int, days: int = 14) -> dict:
    end = datetime.now(timezone.utc)
    start = local_start(
        (datetime.now(settings.tz) - timedelta(days=days)).date()
    )

    nights = await repo.nightly_water(
        device_id,
        start,
        end,
        settings.timezone,
        FLOW_THRESHOLD,
        settings.leak_night_start_hour,
        settings.leak_night_end_hour,
    )

    history = nights[:-1]
    baseline_ready = len(history) >= settings.leak_min_baseline_nights
    median_volume = (
        statistics.median([night["volume_l"] for night in history])
        if baseline_ready
        else None
    )
    threshold_volume = (
        max(median_volume * BURST_FACTOR, MIN_VOLUME_L)
        if median_volume is not None
        else MIN_VOLUME_L
    )

    entries = []
    for night in nights:
        verdict, reason = _classify(night, threshold_volume, baseline_ready)
        entries.append(
            {
                "night": night["night"],
                "samples": night["samples"],
                "volume_l": round(night["volume_l"], 3),
                "flowing_ratio": round(night["flowing_samples"] / night["samples"], 3)
                if night["samples"]
                else 0.0,
                "max_flow_lpm": round(night["max_flow"], 3),
                "avg_flow_lpm": round(night["avg_flow"], 3),
                "verdict": verdict,
                "reason": reason,
            }
        )

    latest = entries[-1] if entries else None
    if latest is None or latest["verdict"] == VERDICT_INSUFFICIENT:
        status = "insufficient_data"
    elif latest["verdict"] == VERDICT_NORMAL:
        status = "ok"
    else:
        status = "leak_suspected"

    return {
        "days": days,
        "window": {
            "start_hour": settings.leak_night_start_hour,
            "end_hour": settings.leak_night_end_hour,
            "flow_threshold_lpm": FLOW_THRESHOLD,
        },
        "baseline": {
            "ready": baseline_ready,
            "nights": len(history),
            "min_nights": settings.leak_min_baseline_nights,
            "median_volume_l": round(median_volume, 3)
            if median_volume is not None
            else None,
            "threshold_volume_l": round(threshold_volume, 3),
        },
        "status": status,
        "latest_verdict": latest["verdict"] if latest else VERDICT_INSUFFICIENT,
        "nights": entries,
        "current": await _current_state(device_id),
    }


async def _current_state(device_id: int) -> dict | None:
    latest = await repo.latest_telemetry(device_id)
    if latest is None:
        return None
    local_hour = latest["timestamp"].astimezone(settings.tz).hour
    return {
        "timestamp": latest["timestamp"],
        "water_flow_lpm": latest["water_flow_lpm"],
        "in_night_window": settings.leak_night_start_hour
        <= local_hour
        < settings.leak_night_end_hour,
        "flowing_now": latest["water_flow_lpm"] >= FLOW_THRESHOLD,
    }
