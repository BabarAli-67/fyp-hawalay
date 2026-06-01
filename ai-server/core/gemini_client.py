"""Shared Google Gemini API client (singleton per FastAPI process)."""

from __future__ import annotations

import logging

from google import genai
from google.genai import Client

from config import Settings, get_settings
from utils.gemini_debug import mask_api_key

logger = logging.getLogger(__name__)


def create_gemini_client(settings: Settings | None = None) -> Client | None:
    """Create one ``genai.Client`` at application startup, or ``None`` if unconfigured."""
    cfg = settings or get_settings()
    api_key = cfg.gemini_api_key.strip()
    if not api_key:
        logger.warning("[gemini] create_gemini_client: no GEMINI_API_KEY in ai-server/.env")
        return None
    try:
        client = Client(api_key=api_key)
        logger.info("[gemini] Client created (key=%s)", mask_api_key(api_key))
        return client
    except Exception:
        logger.exception(
            "[gemini] Client() failed for key=%s — caption/embed calls will not reach Google",
            mask_api_key(api_key),
        )
        return None
