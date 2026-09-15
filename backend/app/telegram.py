import logging

import httpx

from .config import settings

log = logging.getLogger("smartwatt.telegram")

API_BASE = "https://api.telegram.org"


async def send_message(text: str) -> None:
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        return
    url = f"{API_BASE}/bot{settings.telegram_bot_token}/sendMessage"
    body = {"chat_id": settings.telegram_chat_id, "text": text}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(url, json=body)
            response.raise_for_status()
    except httpx.HTTPError as error:
        log.error("telegram send failed: %s", error)


async def send_device_alert(device: dict, reading: dict, violations: list[dict]) -> None:
    lines = [f"⚠️ SmartWatt — {device['name']} ({device['code']})"]
    lines.extend(f"• {violation['message']}" for violation in violations)
    lines.append(
        "Chỉ số hiện tại: "
        f"{reading['voltage']:.1f}V / {reading['current']:.2f}A / "
        f"{reading['power']:.0f}W / {reading['water_flow_lpm']:.2f}L/phút"
    )
    await send_message("\n".join(lines))


async def send_leak_alert(device: dict, night: dict, baseline: dict) -> None:
    lines = [
        f"💧 SmartWatt — {device['name']} ({device['code']})",
        f"Nghi rò rỉ nước: {night['reason']}",
        f"Đêm {night['night']}: {night['volume_l']:.1f}L "
        f"(ngưỡng bình thường {baseline['threshold_volume_l']:.1f}L)",
        f"Lưu lượng đỉnh {night['max_flow_lpm']:.2f} L/phút",
    ]
    await send_message("\n".join(lines))


async def send_deviation_alert(device: dict, report: dict) -> None:
    lines = [
        f"📊 SmartWatt — {device['name']} ({device['code']})",
        f"Tiêu thụ {report['weekday_label']} {report['date']} khác thường",
        f"{report['actual_kwh']:.2f} kWh so với mức thường ngày "
        f"{report['baseline_kwh']:.2f} kWh",
    ]
    hours = sorted(set(report["power_abnormal_hours"]))
    if hours:
        lines.append("Giờ lệch: " + ", ".join(f"{hour}h" for hour in hours))
    await send_message("\n".join(lines))
