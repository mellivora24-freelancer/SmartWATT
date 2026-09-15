import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import monitor, topics
from .api import ai as ai_api
from .api import analytics, auth, devices, users, ws
from .config import settings
from .db import connect, disconnect
from .ingest import handle_config_request, handle_telemetry
from .mqtt_client import init_bridge, shutdown_bridge

logging.basicConfig(level=settings.log_level)
log = logging.getLogger("smartwatt")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect()
    init_bridge(
        asyncio.get_running_loop(),
        {topics.TELEMETRY: handle_telemetry, topics.CONFIG_REQUEST: handle_config_request},
    )
    monitor_task = asyncio.create_task(monitor.run())
    log.info("smartwatt backend started")
    try:
        yield
    finally:
        monitor_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await monitor_task
        shutdown_bridge()
        await disconnect()


app = FastAPI(title="SmartWatt API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(devices.router)
app.include_router(analytics.router)
app.include_router(ai_api.router)
app.include_router(ws.router)


@app.get("/health", tags=["system"])
async def health() -> dict:
    return {"status": "ok"}
