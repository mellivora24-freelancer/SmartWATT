from datetime import date, datetime, timedelta

import numpy as np
from sklearn.linear_model import LinearRegression

from . import repo
from .config import settings
from .timeutils import local_start


def _month_bounds(reference: date) -> tuple[date, date]:
    first = reference.replace(day=1)
    following = (
        first.replace(year=first.year + 1, month=1)
        if first.month == 12
        else first.replace(month=first.month + 1)
    )
    return first, following


def _previous_month_bounds(reference: date) -> tuple[date, date]:
    first, _ = _month_bounds(reference)
    return _month_bounds(first - timedelta(days=1))


def _forecast_series(observed: dict[int, float], today_day: int, days_in_month: int) -> dict:
    current_total = float(sum(observed.values()))
    remaining_days = list(range(today_day + 1, days_in_month + 1))

    if len(observed) >= 2 and remaining_days:
        day_numbers = np.array(sorted(observed)).reshape(-1, 1)
        values = np.array([observed[day] for day in sorted(observed)])
        model = LinearRegression().fit(day_numbers, values)
        predicted = model.predict(np.array(remaining_days).reshape(-1, 1))
        future_total = float(np.clip(predicted, 0.0, None).sum())
    else:
        rate = current_total / max(today_day, 1)
        future_total = rate * len(remaining_days)

    return {"current": current_total, "predicted": current_total + future_total}


def _trend(predicted: float, previous: float | None) -> str:
    if previous is None or predicted >= previous:
        return "up"
    return "down"


async def build_forecast(
    device: dict, electric_price: float, water_price: float = 10000.0
) -> dict:
    today = datetime.now(settings.tz).date()
    month_start, month_end = _month_bounds(today)
    previous_start, _ = _previous_month_bounds(today)
    days_in_month = (month_end - month_start).days
    today_day = today.day

    daily = await repo.daily_consumption(
        device["id"],
        local_start(month_start),
        local_start(month_end),
        settings.timezone,
    )
    months = await repo.monthly_consumption(
        device["id"],
        local_start(previous_start),
        local_start(month_end),
        settings.timezone,
    )
    previous = next((row for row in months if row["month"] == previous_start), None)

    energy = _forecast_series(
        {row["day"].day: row["energy_kwh"] for row in daily}, today_day, days_in_month
    )
    water = _forecast_series(
        {row["day"].day: row["water_l"] for row in daily}, today_day, days_in_month
    )

    previous_energy = float(previous["energy_kwh"]) if previous else None
    previous_water = float(previous["water_l"]) if previous else None

    return {
        "period": {
            "year": today.year,
            "month": today.month,
            "days_in_month": days_in_month,
            "current_day": today_day,
        },
        "electric_price": electric_price,
        "water_price": water_price,
        "electric": {
            "current_kwh": round(energy["current"], 4),
            "current_cost": round(energy["current"] * electric_price, 2),
            "predicted_kwh": round(energy["predicted"], 4),
            "predicted_cost": round(energy["predicted"] * electric_price, 2),
            "previous_month_kwh": previous_energy,
            "previous_month_cost": (
                round(previous_energy * electric_price, 2)
                if previous_energy is not None
                else None
            ),
            "trend": _trend(energy["predicted"], previous_energy),
        },
        "water": {
            "current_l": round(water["current"], 3),
            "current_m3": round(water["current"] / 1000.0, 4),
            "current_cost": round((water["current"] / 1000.0) * water_price, 2),
            "predicted_l": round(water["predicted"], 3),
            "predicted_m3": round(water["predicted"] / 1000.0, 4),
            "predicted_cost": round((water["predicted"] / 1000.0) * water_price, 2),
            "previous_month_l": previous_water,
            "previous_month_m3": (
                round(previous_water / 1000.0, 4)
                if previous_water is not None
                else None
            ),
            "previous_month_cost": (
                round((previous_water / 1000.0) * water_price, 2)
                if previous_water is not None
                else None
            ),
            "trend": _trend(water["predicted"], previous_water),
        },
    }
