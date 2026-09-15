import logging

import httpx

from . import repo
from .config import settings
from .prediction import build_forecast

log = logging.getLogger("smartwatt.ai")

API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

SYSTEM_PROMPT = (
    "Bạn là trợ lý của hệ thống SmartWatt, giúp chủ hộ gia đình hiểu về mức tiêu thụ "
    "điện và nước trong nhà. Trả lời ngắn gọn, dễ hiểu bằng tiếng Việt, dựa trên dữ liệu "
    "được cung cấp. Không bịa số liệu ngoài dữ liệu đã cho."
)


async def build_context(
    device: dict, electric_price: float, water_price: float = 10000.0
) -> str:
    latest = await repo.latest_telemetry(device["id"])
    alerts = await repo.recent_alerts(device["id"], limit=5)
    forecast = await build_forecast(device, electric_price, water_price)

    lines = [f"Thiết bị: {device['name']} ({device['code']})"]
    if latest is None:
        lines.append("Chưa có dữ liệu đo nào được ghi nhận.")
    else:
        lines.append(
            "Chỉ số mới nhất: "
            f"{latest['voltage']:.1f}V, {latest['current']:.2f}A, "
            f"{latest['power']:.0f}W, hệ số công suất {latest['power_factor']:.2f}, "
            f"{latest['frequency']:.1f}Hz, tổng điện {latest['energy_total']:.3f}kWh, "
            f"lưu lượng nước {latest['water_flow_lpm']:.2f}L/phút, "
            f"tổng nước {latest['water_total_l']:.3f}L ({latest['water_total_l']/1000.0:.3f}m³), "
            f"lúc {latest['timestamp'].isoformat()}"
        )

    electric = forecast["electric"]
    water = forecast["water"]
    lines.append(
        f"Điện tháng này: {electric['current_kwh']:.2f}kWh "
        f"(dự đoán cuối tháng {electric['predicted_kwh']:.2f}kWh, "
        f"chi phí ước tính {electric['current_cost']:.0f} đồng, "
        f"dự kiến cả tháng {electric['predicted_cost']:.0f} đồng, đơn giá {electric_price:.0f} đ/kWh)"
    )
    lines.append(
        f"Nước tháng này: {water['current_l']:.1f}L ({water['current_m3']:.3f}m³) "
        f"(dự đoán cuối tháng {water['predicted_l']:.1f}L ({water['predicted_m3']:.3f}m³), "
        f"chi phí nước ước tính {water['current_cost']:.0f} đồng, "
        f"dự kiến cả tháng {water['predicted_cost']:.0f} đồng, đơn giá {water_price:.0f} đ/m³)"
    )

    if alerts:
        lines.append("Cảnh báo gần đây:")
        lines.extend(f"- {alert['message']}" for alert in alerts)
    else:
        lines.append("Không có cảnh báo gần đây.")

    return "\n".join(lines)


async def chat(
    device: dict, prompt: str, electric_price: float, water_price: float = 10000.0
) -> str:
    context = await build_context(device, electric_price, water_price)
    full_prompt = f"{SYSTEM_PROMPT}\n\nDữ liệu hệ thống:\n{context}\n\nCâu hỏi: {prompt}"

    if not settings.gemini_api_key:
        return (
            "Chưa cấu hình GEMINI_API_KEY nên không thể gọi trợ lý AI. "
            f"Dữ liệu hiện có:\n{context}"
        )

    url = f"{API_BASE}/{settings.gemini_model}:generateContent"
    body = {"contents": [{"role": "user", "parts": [{"text": full_prompt}]}]}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                url, params={"key": settings.gemini_api_key}, json=body
            )
            response.raise_for_status()
            data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as error:
        log.error("gemini request failed: %s", error)
        return f"Không gọi được trợ lý AI lúc này. Dữ liệu hiện có:\n{context}"
