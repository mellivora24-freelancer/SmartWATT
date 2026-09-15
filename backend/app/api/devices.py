from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from .. import repo, rules, topics
from ..config import settings
from ..deps import get_current_user, get_owned_device
from ..mqtt_client import publish
from ..prediction import build_forecast
from ..schemas import DeviceCreate, DeviceUpdate
from ..timeutils import ensure_aware

router = APIRouter(prefix="/devices", tags=["devices"])

LEVEL_WINDOWS = {
    "minute": timedelta(hours=6),
    "hour": timedelta(days=7),
    "day": timedelta(days=30),
    "month": timedelta(days=365),
    "year": timedelta(days=365 * 5),
}


@router.get("")
async def list_my_devices(user: dict = Depends(get_current_user)) -> list[dict]:
    return await repo.list_devices(user["id"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def add_device(
    payload: DeviceCreate, user: dict = Depends(get_current_user)
) -> dict:
    device = await repo.get_or_create_device(payload.code, rules.DEFAULT_THRESHOLDS)

    if device["user_id"] is not None and device["user_id"] != user["id"]:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Thiết bị đã được gán cho người dùng khác"
        )

    fields = payload.model_dump(exclude_unset=True)
    fields.pop("code", None)
    fields["user_id"] = user["id"]

    updated = await repo.update_device(device["id"], fields)
    return updated or device


@router.get("/{device_id}")
async def read_device(device: dict = Depends(get_owned_device)) -> dict:
    return device


@router.put("/{device_id}")
async def update_device(
    payload: DeviceUpdate, device: dict = Depends(get_owned_device)
) -> dict:
    updated = await repo.update_device(device["id"], payload.model_dump(exclude_unset=True))
    if updated and device.get("code"):
        try:
            publish(topics.CONFIG_RESPONSE, rules.build_config_payload(device["code"], updated))
        except Exception:
            pass
    return updated or device


@router.delete("/{device_id}")
async def remove_device(device: dict = Depends(get_owned_device)) -> dict:
    await repo.unassign_device(device["id"])
    return {"detail": "Đã gỡ thiết bị khỏi tài khoản, dữ liệu lịch sử được giữ lại"}


@router.get("/{device_id}/telemetry")
async def read_telemetry(
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    device: dict = Depends(get_owned_device),
) -> dict:
    start_at = ensure_aware(start)
    end_at = ensure_aware(end)
    items = await repo.list_telemetry(device["id"], start_at, end_at, limit, offset)
    total = await repo.count_telemetry(device["id"], start_at, end_at)
    return {"total": total, "limit": limit, "offset": offset, "items": items}


@router.get("/{device_id}/summary")
async def read_summary(
    level: str = Query(default="hour"),
    start: datetime | None = None,
    end: datetime | None = None,
    device: dict = Depends(get_owned_device),
) -> dict:
    if level not in repo.AGGREGATION_LEVELS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"level phải thuộc {list(repo.AGGREGATION_LEVELS)}",
        )

    end_at = ensure_aware(end) or datetime.now(timezone.utc)
    start_at = ensure_aware(start) or end_at - LEVEL_WINDOWS[level]

    buckets = await repo.summary_telemetry(
        device["id"], level, start_at, end_at, settings.timezone
    )
    return {"level": level, "start": start_at, "end": end_at, "buckets": buckets}


@router.get("/{device_id}/forecast")
async def read_forecast(
    device: dict = Depends(get_owned_device), user: dict = Depends(get_current_user)
) -> dict:
    return await build_forecast(
        device,
        float(user.get("electric_price") or 0),
        float(user.get("water_price") or 10000),
    )


@router.get("/{device_id}/alerts")
async def read_alerts(
    limit: int = Query(default=20, ge=1, le=200),
    device: dict = Depends(get_owned_device),
) -> list[dict]:
    return await repo.recent_alerts(device["id"], limit)


@router.delete("/alerts/{alert_id}")
async def delete_alert(
    alert_id: int, user: dict = Depends(get_current_user)
) -> dict:
    success = await repo.delete_alert(alert_id, user["id"])
    if not success:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Không tìm thấy thông báo hoặc không có quyền xóa"
        )
    return {"status": "ok", "deleted_id": alert_id}

