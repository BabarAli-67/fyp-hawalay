"""Shared Gemini diagnostics helpers (masked keys, structured log lines)."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def mask_api_key(api_key: str | None) -> str:
    """Return a safe key fingerprint for logs, e.g. ``***3ShA``."""
    raw = (api_key or "").strip()
    if not raw:
        return "(not set)"
    if len(raw) <= 8:
        return "***"
    return f"***{raw[-4:]}"


def log_gemini_env_status(*, settings: Any, client: Any | None) -> None:
    """Log whether GEMINI_API_KEY is present and whether a live client was created."""
    key = getattr(settings, "gemini_api_key", "") or ""
    key_present = bool(key.strip())
    client_live = client is not None
    caption_model = getattr(settings, "gemini_caption_model", "?")
    embed_model = getattr(settings, "gemini_embedding_model", "?")

    logger.info(
        "[gemini] env key=%s client_initialized=%s caption_model=%s embed_model=%s",
        mask_api_key(key),
        client_live,
        caption_model,
        embed_model,
    )
    if key_present and not client_live:
        logger.error(
            "[gemini] GEMINI_API_KEY is set but Client() was not created — "
            "caption calls will be skipped until ai-server is restarted"
        )
    elif not key_present:
        logger.warning(
            "[gemini] GEMINI_API_KEY missing in ai-server/.env — "
            "load key from ai-server/.env only (server/.env is NOT read by FastAPI)"
        )
