import logging
import time

from . import repo, telegram, topics
from .config import settings
from .mqtt_client import publish
from .realtime import hub
from .timeutils import local_start

log = logging.getLogger("smartwatt.alerts")

LEAK_METRIC = "water_leak"
DEVIATION_METRIC = "baseline_deviation"

_last_alert_at: dict[tuple[int, str], float] = {}


def _is_cooled_down(device_id: int, violation: dict, now: float) -> bool:
    key = (device_id, f"{violation['metric']}:{violation['kind']}")
    if now - _last_alert_at.get(key, 0.0) < settings.alert_cooldown_seconds:
        return False
    _last_alert_at[key] = now
    return True


async def raise_violations(device: dict, reading: dict, violations: list[dict]) -> None:
    now = time.monotonic()
    active = [
        violation
        for violation in violations
        if _is_cooled_down(device["id"], violation, now)
    ]
    if not active:
        return

    stored = [await repo.insert_alert(device["id"], violation) for violation in active]

    publish(topics.CMD_BUZZER, {"device_code": device["code"], "action": "ON"})
    await telegram.send_device_alert(device, reading, active)
    await hub.send_to_user(
        device.get("user_id"),
        {
            "type": "alert",
            "device_id": device["id"],
            "device_code": device["code"],
            "alerts": stored,
            "data": reading,
        },
    )
    log.info("raised %s alert(s) for device %s", len(active), device["code"])


async def raise_leak(device: dict, report: dict) -> bool:
    night = report["nights"][-1]
    if await repo.alert_exists_since(
        device["id"], LEAK_METRIC, local_start(night["night"])
    ):
        return False

    stored = await repo.insert_alert(
        device["id"],
        {
            "metric": LEAK_METRIC,
            "kind": night["verdict"],
            "value": night["volume_l"],
            "limit": report["baseline"]["threshold_volume_l"],
            "message": f"Rò rỉ nước đêm {night['night']}: {night['reason']}",
        },
    )
    await telegram.send_leak_alert(device, night, report["baseline"])
    await hub.send_to_user(
        device.get("user_id"),
        {
            "type": "alert",
            "device_id": device["id"],
            "device_code": device["code"],
            "alerts": [stored],
            "data": {"night": night, "baseline": report["baseline"]},
        },
    )
    return True


async def raise_deviation(device: dict, report: dict) -> bool:
    if await repo.alert_exists_since(
        device["id"], DEVIATION_METRIC, local_start(report["date"])
    ):
        return False

    stored = await repo.insert_alert(
        device["id"],
        {
            "metric": DEVIATION_METRIC,
            "kind": "abnormal",
            "value": report["actual_kwh"],
            "limit": report["baseline_kwh"],
            "message": (
                f"Tiêu thụ ngày {report['date']} khác thường: "
                f"{report['actual_kwh']:.2f} kWh so với "
                f"{report['baseline_kwh']:.2f} kWh"
            ),
        },
    )
    await telegram.send_deviation_alert(device, report)
    await hub.send_to_user(
        device.get("user_id"),
        {
            "type": "alert",
            "device_id": device["id"],
            "device_code": device["code"],
            "alerts": [stored],
            "data": {
                "date": report["date"],
                "actual_kwh": report["actual_kwh"],
                "baseline_kwh": report["baseline_kwh"],
                "abnormal_hours": report["power_abnormal_hours"],
            },
        },
    )
    return True
