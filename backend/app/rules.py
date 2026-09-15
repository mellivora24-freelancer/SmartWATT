from .repo import THRESHOLD_COLUMNS

DEFAULT_THRESHOLDS = {
    "min_voltage": 200.0,
    "max_voltage": 245.0,
    "min_current": None,
    "max_current": 15.0,
    "min_power": None,
    "max_power": 2000.0,
    "min_frequency": 49.0,
    "max_frequency": 51.0,
    "min_power_factor": 0.80,
    "max_power_factor": None,
    "min_water_flow": None,
    "max_water_flow": 8.0,
}

METRIC_LABELS = {
    "voltage": "Điện áp",
    "current": "Dòng điện",
    "power": "Công suất",
    "frequency": "Tần số",
    "power_factor": "Hệ số công suất",
    "water_flow_lpm": "Lưu lượng nước",
}

METRIC_UNITS = {
    "voltage": "V",
    "current": "A",
    "power": "W",
    "frequency": "Hz",
    "power_factor": "",
    "water_flow_lpm": "L/phút",
}

METRIC_RULES = (
    ("voltage", "min_voltage", "max_voltage"),
    ("current", "min_current", "max_current"),
    ("power", "min_power", "max_power"),
    ("frequency", "min_frequency", "max_frequency"),
    ("power_factor", "min_power_factor", "max_power_factor"),
    ("water_flow_lpm", "min_water_flow", "max_water_flow"),
)


def effective_thresholds(device: dict) -> dict:
    return {
        column: (
            device.get(column)
            if device.get(column) is not None
            else DEFAULT_THRESHOLDS[column]
        )
        for column in THRESHOLD_COLUMNS
    }


def evaluate(device: dict, reading: dict) -> list[dict]:
    thresholds = effective_thresholds(device)
    violations: list[dict] = []

    for metric, min_column, max_column in METRIC_RULES:
        value = reading.get(metric)
        if value is None:
            continue
        number = float(value)

        minimum = thresholds[min_column]
        if minimum is not None and number < float(minimum):
            violations.append(
                _violation(metric, "low", number, float(minimum))
            )

        maximum = thresholds[max_column]
        if maximum is not None and number > float(maximum):
            violations.append(
                _violation(metric, "high", number, float(maximum))
            )

    return violations


def _violation(metric: str, kind: str, value: float, limit: float) -> dict:
    label = METRIC_LABELS[metric]
    unit = METRIC_UNITS[metric]
    direction = "thấp hơn" if kind == "low" else "vượt"
    return {
        "metric": metric,
        "kind": kind,
        "value": value,
        "limit": limit,
        "message": f"{label} {direction} ngưỡng: {value:.2f}{unit} (ngưỡng {limit:.2f}{unit})",
    }


def build_config_payload(code: str, device: dict) -> dict:
    payload = {"device_code": code}
    payload.update(effective_thresholds(device))
    return payload
