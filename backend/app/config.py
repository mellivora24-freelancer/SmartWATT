from zoneinfo import ZoneInfo

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    log_level: str = "INFO"

    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "smartwatt"
    db_user: str = "smartwatt"
    db_password: str = "smartwatt"

    mqtt_broker_host: str = "localhost"
    mqtt_broker_port: int = 1883
    mqtt_client_id: str = "smartwatt-backend"

    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 43200

    timezone: str = "Asia/Ho_Chi_Minh"
    alert_cooldown_seconds: int = 300

    baseline_weeks: int = 4
    baseline_min_days: int = 3
    baseline_z_threshold: float = 3.0
    threshold_window_days: int = 30
    leak_night_start_hour: int = 1
    leak_night_end_hour: int = 5
    leak_min_baseline_nights: int = 5

    monitor_interval_seconds: int = 600
    deviation_check_hour: int = 8

    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.timezone)


settings = Settings()
