"""Detect a stale Hawalay AI server already bound to the Express proxy port."""

from __future__ import annotations

import logging
import socket

logger = logging.getLogger(__name__)

_HEALTH_PATH = "/health"
_EXPECTED_SERVICE = "hawalay-ai-server"
_REQUIRED_HEALTH_KEYS = frozenset({"gemini_client_initialized", "gemini_key_suffix"})


def _port_accepting_connections(host: str, port: int, timeout: float = 1.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def warn_if_stale_ai_server_on_proxy_port(port: int, *, proxy_host: str = "127.0.0.1") -> None:
    """
    Express uses FASTAPI_URL=http://127.0.0.1:8000 — if an old uvicorn instance is
    still bound there, requests never reach the newly started ``python main.py`` process.
    """
    if not _port_accepting_connections(proxy_host, port):
        return

    url = f"http://{proxy_host}:{port}{_HEALTH_PATH}"
    try:
        import httpx  # noqa: PLC0415 — optional dev dependency already in venv

        response = httpx.get(url, timeout=2.0)
        payload = response.json()
    except Exception as exc:
        logger.warning(
            "[startup] Port %s on %s is in use but /health is not Hawalay (%s). "
            "Stop other services on this port before starting ai-server.",
            port,
            proxy_host,
            exc,
        )
        return

    service = payload.get("service")
    missing = _REQUIRED_HEALTH_KEYS - set(payload.keys())
    if service == _EXPECTED_SERVICE and not missing:
        logger.warning(
            "[startup] Another Hawalay AI server is already listening on %s:%s. "
            "Stop it first (Task Manager / Stop-Process) or Express may hit the wrong instance.",
            proxy_host,
            port,
        )
        return

    logger.error(
        "[startup] STALE ai-server detected on %s:%s (service=%r missing=%s). "
        "Express proxies to 127.0.0.1 — kill ALL old python/uvicorn on port %s, then restart:\n"
        "  netstat -ano | findstr :%s\n"
        "  Stop-Process -Id <PID> -Force",
        proxy_host,
        port,
        service,
        sorted(missing) if missing else "legacy build",
        port,
        port,
    )
