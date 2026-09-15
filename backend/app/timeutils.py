from datetime import date, datetime, time, timezone

from .config import settings


def local_start(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=settings.tz).astimezone(timezone.utc)


def ensure_aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=settings.tz).astimezone(timezone.utc)
    return value.astimezone(timezone.utc)
