from fastapi import APIRouter, HTTPException, status

from .. import repo, security
from ..schemas import LoginRequest, RegisterRequest

router = APIRouter(prefix="/auth", tags=["auth"])


def public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "name": user["name"],
        "phone": user["phone"],
        "electric_price": user["electric_price"],
        "water_price": user.get("water_price") if user.get("water_price") is not None else 10000.0,
        "created_at": user["created_at"],
        "updated_at": user["updated_at"],
    }


def auth_response(user: dict) -> dict:
    return {
        "access_token": security.create_access_token(user["id"]),
        "token_type": "bearer",
        "user": public_user(user),
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest) -> dict:
    if await repo.get_user_by_phone(payload.phone) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Số điện thoại đã được đăng ký")

    user = await repo.create_user(
        payload.name,
        payload.phone,
        payload.password,
        payload.electric_price,
        payload.water_price,
    )
    if user is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Số điện thoại đã được đăng ký")
    return auth_response(user)


@router.post("/login")
async def login(payload: LoginRequest) -> dict:
    user = await repo.get_user_by_phone(payload.phone)
    if user is None or user["password"] != payload.password:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Sai số điện thoại hoặc mật khẩu"
        )
    return auth_response(user)
