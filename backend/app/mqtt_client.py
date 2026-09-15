import asyncio
import json
import logging
from typing import Awaitable, Callable

import paho.mqtt.client as mqtt

from . import topics
from .config import settings

log = logging.getLogger("smartwatt.mqtt")

Handler = Callable[[dict], Awaitable[None]]


class MqttBridge:
    def __init__(self, loop: asyncio.AbstractEventLoop, handlers: dict[str, Handler]):
        self._loop = loop
        self._handlers = handlers
        self._client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2, client_id=settings.mqtt_client_id
        )
        self._client.on_connect = self._on_connect
        self._client.on_message = self._on_message

    def start(self) -> None:
        self._client.connect_async(
            settings.mqtt_broker_host, settings.mqtt_broker_port, keepalive=30
        )
        self._client.loop_start()
        log.info(
            "mqtt bridge connecting to %s:%s",
            settings.mqtt_broker_host,
            settings.mqtt_broker_port,
        )

    def stop(self) -> None:
        self._client.loop_stop()
        self._client.disconnect()

    def publish(self, topic: str, payload: dict) -> None:
        self._client.publish(topic, json.dumps(payload))

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        client.subscribe([(topics.TELEMETRY, 0), (topics.CONFIG_REQUEST, 0)])
        log.info("mqtt connected (%s)", reason_code)

    def _on_message(self, client, userdata, message):
        try:
            payload = json.loads(message.payload.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            log.warning("discarding non-json message on %s", message.topic)
            return

        handler = self._handlers.get(message.topic)
        if handler is None:
            return

        future = asyncio.run_coroutine_threadsafe(handler(payload), self._loop)
        future.add_done_callback(self._log_failure)

    @staticmethod
    def _log_failure(future) -> None:
        error = future.exception()
        if error is not None:
            log.error("mqtt handler failed: %s", error, exc_info=error)


_bridge: MqttBridge | None = None


def init_bridge(loop: asyncio.AbstractEventLoop, handlers: dict[str, Handler]) -> MqttBridge:
    global _bridge
    _bridge = MqttBridge(loop, handlers)
    _bridge.start()
    return _bridge


def shutdown_bridge() -> None:
    global _bridge
    if _bridge is not None:
        _bridge.stop()
        _bridge = None


def publish(topic: str, payload: dict) -> None:
    if _bridge is not None:
        _bridge.publish(topic, payload)
