import asyncio
import logging
from datetime import date, datetime, timedelta

from . import alerts, baseline, leaks, repo
from .config import settings

log = logging.getLogger("smartwatt.monitor")

LEAK_DAYS = 14

_last_deviation_check: dict[int, date] = {}


async def run() -> None:
    while True:
        await asyncio.sleep(settings.monitor_interval_seconds)
        try:
            await _cycle()
        except Exception as error:
            log.error("analytics monitor failed: %s", error, exc_info=error)


async def _cycle() -> None:
    for device in await repo.list_owned_devices():
        await _check_leak(device)
        await _check_deviation(device)


async def _check_leak(device: dict) -> None:
    report = await leaks.analyse(device["id"], LEAK_DAYS)
    if report["status"] != "leak_suspected":
        return
    if await alerts.raise_leak(device, report):
        log.info("leak alert raised for device %s", device["code"])


async def _check_deviation(device: dict) -> None:
    now = datetime.now(settings.tz)
    if now.hour < settings.deviation_check_hour:
        return

    target = now.date() - timedelta(days=1)
    if _last_deviation_check.get(device["id"]) == target:
        return
    _last_deviation_check[device["id"]] = target

    report = await baseline.detect_deviation(device["id"], target)
    if report["status"] != "abnormal":
        return
    if await alerts.raise_deviation(device, report):
        log.info("deviation alert raised for device %s", device["code"])
