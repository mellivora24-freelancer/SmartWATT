import logging
from datetime import datetime, timezone

from . import alerts, repo, rules, topics
from .mqtt_client import publish
from .realtime import hub

log = logging.getLogger("smartwatt.ingest")

NUMERIC_FIELDS = (
    "voltage",
    "current",
    "power",
    "power_factor",
    "frequency",
    "energy_total",
    "water_flow_lpm",
    "water_total_l",
)


def build_reading(payload: dict) -> dict:
    reading: dict = {}
    for field in NUMERIC_FIELDS:
        try:
            reading[field] = float(payload.get(field) or 0.0)
        except (TypeError, ValueError):
            reading[field] = 0.0
    try:
        reading["pulse_count"] = int(payload.get("pulse_count") or 0)
    except (TypeError, ValueError):
        reading["pulse_count"] = 0
    reading["timestamp"] = datetime.now(timezone.utc)
    return reading


async def handle_telemetry(payload: dict) -> None:
    code = payload.get("device_code")
    if not code:
        log.warning("telemetry without device_code discarded")
        return

    device = await repo.get_or_create_device(code, rules.DEFAULT_THRESHOLDS)
    reading = build_reading(payload)
    stored = await repo.insert_telemetry(device["id"], code, reading)

    await hub.send_to_user(
        device.get("user_id"),
        {
            "type": "telemetry",
            "device_id": device["id"],
            "device_code": code,
            "data": stored,
        },
    )

    violations = rules.evaluate(device, stored)
    if violations:
        await alerts.raise_violations(device, stored, violations)


async def handle_config_request(payload: dict) -> None:
    code = payload.get("device_code")
    if not code:
        log.warning("config request without device_code discarded")
        return

    device = await repo.get_or_create_device(code, rules.DEFAULT_THRESHOLDS)
    publish(topics.CONFIG_RESPONSE, rules.build_config_payload(code, device))
    log.info("sent config response for device %s", code)
