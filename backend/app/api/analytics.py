from datetime import date

from fastapi import APIRouter, Depends, Query

from .. import baseline, leaks, tuning
from ..deps import get_owned_device
from ..schemas import ThresholdApplyRequest

router = APIRouter(prefix="/devices", tags=["analytics"])


@router.get("/{device_id}/baseline")
async def read_baseline(
    weeks: int | None = Query(default=None, ge=1, le=26),
    device: dict = Depends(get_owned_device),
) -> dict:
    return await baseline.build_profile(device["id"], weeks)


@router.get("/{device_id}/deviation")
async def read_deviation(
    date: date | None = Query(default=None),
    weeks: int | None = Query(default=None, ge=1, le=26),
    device: dict = Depends(get_owned_device),
) -> dict:
    return await baseline.detect_deviation(device["id"], date, weeks)


@router.get("/{device_id}/threshold-suggestions")
async def read_threshold_suggestions(
    days: int | None = Query(default=None, ge=1, le=365),
    device: dict = Depends(get_owned_device),
) -> dict:
    return await tuning.suggest_thresholds(device, days)


@router.post("/{device_id}/threshold-suggestions/apply")
async def apply_threshold_suggestions(
    payload: ThresholdApplyRequest, device: dict = Depends(get_owned_device)
) -> dict:
    updated, applied, report = await tuning.apply_thresholds(device, payload.columns)
    return {
        "applied": applied,
        "device": updated or device,
        "suggestions": report["suggestions"],
    }


@router.get("/{device_id}/water-leak")
async def read_water_leak(
    days: int = Query(default=14, ge=1, le=90),
    device: dict = Depends(get_owned_device),
) -> dict:
    return await leaks.analyse(device["id"], days)
