"""Caption generation via Google Gemini Vision API.

File named blip_service for backward compatibility.
"""

from __future__ import annotations

import asyncio
import logging
from io import BytesIO
from typing import Any

from google.genai import Client
from google.genai import types
from PIL import Image

from config import get_settings
from utils.gemini_debug import mask_api_key
from utils.gemini_retry import (
    extract_response_text,
    generate_content_with_retry,
    is_rate_limit_error,
    is_transient_error,
)
from utils.report_caption import (
    caption_quality_score,
    compose_caption_prompt,
    explain_caption_validation,
    is_truncated_caption,
    is_unusable_caption,
    is_valid_report_caption,
    is_weak_report_caption,
    normalize_caption_output,
    repair_incomplete_caption,
)
from utils.report_features import compose_features_prompt

logger = logging.getLogger(__name__)

DEFAULT_CAPTION_MODEL = "gemini-2.0-flash"

_CAPTION_GENERATION_PASSES: tuple[dict[str, Any], ...] = (
    {"retry": False, "detail_retry": False, "operation": "caption_primary"},
    {"retry": True, "detail_retry": False, "operation": "caption_quality_retry"},
    {"retry": False, "detail_retry": True, "operation": "caption_detail_retry"},
)


def _generate_caption_attempt(
    client: Client,
    model: str,
    image: Any,
    context: str,
    ocr_payload: dict[str, Any] | None,
    gen_config: types.GenerateContentConfig,
    *,
    retry: bool = False,
    detail_retry: bool = False,
    operation: str = "caption_primary",
) -> tuple[str, str]:
    """
    Call Gemini for one caption pass.

    Returns ``(raw_text, normalized_caption)``.
    """
    prompt = compose_caption_prompt(
        context=context,
        retry=retry,
        detail_retry=detail_retry,
    )
    max_attempts = get_settings().gemini_generate_max_attempts
    response = generate_content_with_retry(
        client,
        model=model,
        contents=[prompt, image],
        config=gen_config,
        max_attempts=max_attempts,
        operation=operation,
    )
    raw_text = extract_response_text(response)
    parsed = normalize_caption_output(raw_text)
    logger.info(
        "[caption] pass parse operation=%s raw_chars=%d raw_words=%d parsed_chars=%d parsed_words=%d",
        operation,
        len(raw_text),
        len(raw_text.split()),
        len(parsed),
        len(parsed.split()),
    )
    if raw_text and raw_text != parsed:
        logger.debug("[caption] raw response operation=%s text=%r", operation, raw_text[:500])
    if parsed:
        logger.info("[caption] parsed caption operation=%s preview=%r", operation, parsed[:200])
    return raw_text, parsed


def _pick_best_caption(candidates: list[str], ocr_payload: dict[str, Any] | None) -> str:
    """Choose the highest-quality non-empty Gemini attempt."""
    non_empty = [c.strip() for c in candidates if c and c.strip()]
    if not non_empty:
        return ""
    return max(non_empty, key=lambda text: caption_quality_score(text, ocr_payload))


def generate_caption(
    image_bytes: bytes,
    gemini_api_key: str = "",
    fallback_text: str = "",
    *,
    model_id: str | None = None,
    client: Client | None = None,
    context: str = "",
    ocr_payload: dict[str, Any] | None = None,
    detected_object_names: list[str] | None = None,
    category: str = "",
) -> tuple[str, bool]:
    """
    Generate a lost-and-found report description with Gemini Vision.

    Returns ``(caption, rate_limited_or_transient_exhausted)``.

    OCR/structured fallbacks are NOT applied here — the orchestrator uses OCR only
    when this function returns empty or unusable text.
    """
    del gemini_api_key, fallback_text, detected_object_names, category

    settings = get_settings()
    model = (model_id or settings.gemini_caption_model or DEFAULT_CAPTION_MODEL).strip()
    if model.startswith("models/"):
        model = model.removeprefix("models/")

    logger.info(
        "[caption] generate_caption start model=%s image_bytes=%d client=%s key=%s",
        model,
        len(image_bytes or b""),
        "live" if client is not None else "NONE",
        mask_api_key(settings.gemini_api_key),
    )

    if not image_bytes:
        logger.warning("[caption] abort: empty image bytes — Gemini will NOT be called")
        return "", False

    if client is None:
        logger.error(
            "[caption] abort: gemini Client is None (key=%s). "
            "Set GEMINI_API_KEY in ai-server/.env and restart python main.py",
            mask_api_key(settings.gemini_api_key),
        )
        return "", False

    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        logger.info("[caption] PIL decode ok size=%sx%s", image.width, image.height)
        max_output_tokens = settings.gemini_caption_max_output_tokens
        gen_config = types.GenerateContentConfig(
            temperature=0.45,
            max_output_tokens=max_output_tokens,
        )
        configured_passes = (
            settings.gemini_caption_max_passes
            if settings.gemini_caption_quality_retry
            else 1
        )
        max_passes = min(configured_passes, len(_CAPTION_GENERATION_PASSES))

        attempts: list[str] = []
        caption = ""

        for pass_index, pass_cfg in enumerate(_CAPTION_GENERATION_PASSES[:max_passes], start=1):
            if pass_index > 1 and is_valid_report_caption(caption, ocr_payload):
                logger.info(
                    "[caption] early exit before pass %d — ideal quality already met",
                    pass_index,
                )
                break

            _raw, attempt_caption = _generate_caption_attempt(
                client,
                model,
                image,
                context,
                ocr_payload,
                gen_config,
                retry=bool(pass_cfg["retry"]),
                detail_retry=bool(pass_cfg["detail_retry"]),
                operation=str(pass_cfg["operation"]),
            )
            if attempt_caption:
                attempts.append(attempt_caption)
                caption = _pick_best_caption(attempts, ocr_payload)

            validation = explain_caption_validation(caption, ocr_payload)
            logger.info(
                "[caption] pass %d/%d op=%s words=%d chars=%d ideal=%s usable=%s "
                "validation=%s preview=%r",
                pass_index,
                max_passes,
                pass_cfg["operation"],
                len(caption.split()),
                len(caption),
                is_valid_report_caption(caption, ocr_payload),
                not is_unusable_caption(caption, ocr_payload),
                validation or ["ok"],
                caption[:120],
            )

            if is_valid_report_caption(caption, ocr_payload):
                break

        caption = _pick_best_caption(attempts, ocr_payload)

        if caption.strip() and is_truncated_caption(caption):
            repaired = repair_incomplete_caption(caption)
            if repaired:
                logger.info(
                    "[caption] repaired truncated caption words=%d chars=%d",
                    len(repaired.split()),
                    len(repaired),
                )
                caption = repaired

        if caption.strip() and not is_unusable_caption(caption, ocr_payload):
            if is_valid_report_caption(caption, ocr_payload):
                logger.info(
                    "[caption] generate_caption done — GEMINI IDEAL words=%d chars=%d",
                    len(caption.split()),
                    len(caption),
                )
            else:
                logger.warning(
                    "[caption] generate_caption done — GEMINI USABLE (below ideal) words=%d "
                    "chars=%d validation=%s",
                    len(caption.split()),
                    len(caption),
                    explain_caption_validation(caption, ocr_payload),
                )
        elif caption.strip():
            logger.warning(
                "[caption] generate_caption done — GEMINI UNUSABLE, OCR may apply words=%d "
                "validation=%s",
                len(caption.split()),
                explain_caption_validation(caption, ocr_payload),
            )
            return "", False
        else:
            logger.warning(
                "[caption] generate_caption done — empty after all passes "
                "(check [gemini] logs for HTTP errors or blocked content)",
            )

        return caption, False
    except Exception as exc:
        transient = is_transient_error(exc)
        if transient:
            logger.error(
                "[caption] generate_caption FAILED — transient error exhausted retries model=%s",
                model,
                exc_info=True,
            )
        else:
            logger.error(
                "[caption] generate_caption FAILED model=%s error=%s",
                model,
                exc,
                exc_info=True,
            )
        return "", transient


def generate_features(
    image_bytes: bytes,
    gemini_api_key: str = "",
    *,
    model_id: str | None = None,
    client: Client | None = None,
    context: str = "",
) -> tuple[str, bool]:
    """Generate distinctive-feature bullet list with Gemini Vision."""
    del gemini_api_key

    if not image_bytes or client is None:
        logger.warning(
            "[features] skip: image_bytes=%d client=%s",
            len(image_bytes or b""),
            "live" if client is not None else "NONE",
        )
        return "", False

    settings = get_settings()
    model = (model_id or settings.gemini_caption_model or DEFAULT_CAPTION_MODEL).strip()
    if model.startswith("models/"):
        model = model.removeprefix("models/")

    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        prompt = compose_features_prompt(context=context)
        response = generate_content_with_retry(
            client,
            model=model,
            contents=[prompt, image],
            max_attempts=get_settings().gemini_generate_max_attempts,
            operation="features_primary",
        )
        return extract_response_text(response), False
    except Exception as exc:
        transient = is_transient_error(exc)
        logger.error(
            "[features] generate_features FAILED model=%s transient=%s",
            model,
            transient,
            exc_info=True,
        )
        return "", transient


class BlipService:
    """Caption generation via Gemini (module id ``blip`` kept for API compatibility)."""

    MODULE = "blip"

    def __init__(
        self,
        *,
        model_id: str | None = None,
        gemini_api_key: str = "",
        client: Client | None = None,
    ) -> None:
        self._model_id = (model_id or get_settings().gemini_caption_model or DEFAULT_CAPTION_MODEL).strip()
        self._gemini_api_key = gemini_api_key
        self._client = client

    @property
    def status(self) -> dict[str, Any]:
        key_configured = bool(get_settings().gemini_api_key.strip() or self._gemini_api_key.strip())
        client_live = self._client is not None
        if key_configured and not client_live:
            message = (
                "GEMINI_API_KEY is set but Gemini client was not initialized — "
                "restart ai-server after updating ai-server/.env"
            )
        elif key_configured:
            message = "Gemini caption API configured"
        else:
            message = "GEMINI_API_KEY not set in ai-server/.env"
        return {
            "ready": key_configured and client_live,
            "client_initialized": client_live,
            "key_configured": key_configured,
            "module": self.MODULE,
            "provider": "google_gemini",
            "message": message,
            "model_id": self._model_id,
            "gemini_configured": key_configured and client_live,
            "inference_url": "https://generativelanguage.googleapis.com",
        }

    async def caption(
        self,
        image_bytes: bytes,
        *,
        fallback_text: str = "",
        context: str = "",
        ocr_payload: dict[str, Any] | None = None,
        detected_object_names: list[str] | None = None,
        category: str = "",
    ) -> dict[str, Any]:
        caption, rate_limited = await asyncio.to_thread(
            generate_caption,
            image_bytes,
            "",
            fallback_text,
            model_id=self._model_id,
            client=self._client,
            context=context,
            ocr_payload=ocr_payload,
            detected_object_names=detected_object_names,
            category=category,
        )
        logger.info(
            "[caption] BlipService.caption done status=%s rate_limited=%s words=%d",
            "success" if caption else "degraded",
            rate_limited,
            len(caption.split()),
        )
        return {
            "status": "success" if caption else "degraded",
            "module": self.MODULE,
            "model_id": self._model_id,
            "caption": caption,
            "rate_limited": rate_limited,
        }

    async def features(
        self,
        image_bytes: bytes,
        *,
        context: str = "",
    ) -> dict[str, Any]:
        raw, rate_limited = await asyncio.to_thread(
            generate_features,
            image_bytes,
            "",
            model_id=self._model_id,
            client=self._client,
            context=context,
        )
        return {
            "status": "success" if raw else "degraded",
            "module": self.MODULE,
            "model_id": self._model_id,
            "features_text": raw,
            "rate_limited": rate_limited,
        }
