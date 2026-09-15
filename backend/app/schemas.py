from pydantic import BaseModel, Field


class ThresholdFields(BaseModel):
    min_voltage: float | None = None
    max_voltage: float | None = None
    min_current: float | None = None
    max_current: float | None = None
    min_power: float | None = None
    max_power: float | None = None
    min_frequency: float | None = None
    max_frequency: float | None = None
    min_power_factor: float | None = None
    max_power_factor: float | None = None
    min_water_flow: float | None = None
    max_water_flow: float | None = None


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=1)
    electric_price: float = 0
    water_price: float = 10000


class LoginRequest(BaseModel):
    phone: str
    password: str


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, min_length=3, max_length=50)
    password: str | None = Field(default=None, min_length=1)
    electric_price: float | None = None
    water_price: float | None = None


class DeviceCreate(ThresholdFields):
    code: str = Field(min_length=1, max_length=255)
    name: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)


class DeviceUpdate(ThresholdFields):
    name: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)


class ChatRequest(BaseModel):
    device_id: int
    prompt: str = Field(min_length=1)


class ThresholdApplyRequest(BaseModel):
    columns: list[str] = Field(min_length=1)
