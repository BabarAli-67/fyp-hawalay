"""InferenceProvider wrappers for Gemini caption and embedding services."""

from __future__ import annotations

import logging
import time
from typing import Any

from core.inference_provider import InferenceInput, InferenceOutput
from services.blip_service import BlipService
from services.clip_service import ClipService
from utils.gemini_retry import is_transient_error

logger = logging.getLogger(__name__)


class GeminiCaptionProvider:
    name = "gemini_caption"
    version = "gemini-caption-v1"

    def __init__(self, blip_service: BlipService) -> None:
        self._service = blip_service

    async def predict(self, input: InferenceInput) -> InferenceOutput:
        started = time.perf_counter()
        if not input.image_bytes:
            logger.warning("[gemini_caption] predict skipped — image_bytes empty")
            return InferenceOutput(
                success=False,
                result={},
                error="image_bytes is required",
                model_version=self.version,
            )

        logger.info(
            "[gemini_caption] predict start bytes=%d",
            len(input.image_bytes),
        )
        try:
            meta = input.meta or {}
            detected_object_names = meta.get("detected_object_names")
            if not isinstance(detected_object_names, list):
                detected_object_names = None
            result = await self._service.caption(
                input.image_bytes,
                fallback_text=meta.get("fallback_text", ""),
                context=str(meta.get("caption_context") or ""),
                ocr_payload=meta.get("ocr_payload") if isinstance(meta.get("ocr_payload"), dict) else None,
                detected_object_names=detected_object_names,
                category=str(meta.get("category") or ""),
            )
            elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
            caption = (result.get("caption") or "").strip()
            logger.info(
                "[gemini_caption] predict done success=%s words=%d rate_limited=%s ms=%s",
                bool(caption),
                len(caption.split()),
                bool(result.get("rate_limited")),
                elapsed_ms,
            )
            return InferenceOutput(
                success=bool(caption),
                result=result,
                processing_time_ms=elapsed_ms,
                model_version=self.version,
            )
        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
            logger.error(
                "[gemini_caption] predict exception: %s",
                exc,
                exc_info=True,
            )
            return InferenceOutput(
                success=False,
                result={"rate_limited": is_transient_error(exc)},
                error=str(exc),
                processing_time_ms=elapsed_ms,
                model_version=self.version,
            )

    def status(self) -> dict[str, Any]:
        service_status = self._service.status
        return {
            "ready": bool(service_status.get("ready")),
            "name": self.name,
            "version": self.version,
            "detail": service_status.get("message") or "Gemini caption",
            "model_id": service_status.get("model_id"),
        }


class GeminiFeaturesProvider:
    name = "gemini_features"
    version = "gemini-features-v1"

    def __init__(self, blip_service: BlipService) -> None:
        self._service = blip_service

    async def predict(self, input: InferenceInput) -> InferenceOutput:
        started = time.perf_counter()
        if not input.image_bytes:
            return InferenceOutput(
                success=False,
                result={},
                error="image_bytes is required",
                model_version=self.version,
            )

        try:
            meta = input.meta or {}
            result = await self._service.features(
                input.image_bytes,
                context=str(meta.get("features_context") or meta.get("caption_context") or ""),
            )
            elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
            raw = (result.get("features_text") or "").strip()
            return InferenceOutput(
                success=bool(raw),
                result=result,
                processing_time_ms=elapsed_ms,
                model_version=self.version,
            )
        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
            return InferenceOutput(
                success=False,
                result={"rate_limited": is_transient_error(exc)},
                error=str(exc),
                processing_time_ms=elapsed_ms,
                model_version=self.version,
            )

    def status(self) -> dict[str, Any]:
        service_status = self._service.status
        return {
            "ready": bool(service_status.get("ready")),
            "name": self.name,
            "version": self.version,
            "detail": "Gemini distinctive features (bullet list)",
            "model_id": service_status.get("model_id"),
        }


class GeminiEmbedProvider:
    name = "gemini_embed"
    version = "gemini-embed-v1"

    def __init__(self, clip_service: ClipService) -> None:
        self._service = clip_service

    async def predict(self, input: InferenceInput) -> InferenceOutput:
        started = time.perf_counter()
        text = (input.text or "").strip()
        has_image = bool(input.image_bytes)

        if not text and not has_image:
            return InferenceOutput(
                success=False,
                result={},
                error="text or image_bytes is required",
                model_version=self.version,
            )

        try:
            if text:
                result = await self._service.embed_text(text)
            else:
                result = await self._service.embed_image(input.image_bytes)
            elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
            success = bool(result.get("embedding_ok")) or result.get("status") == "success"
            return InferenceOutput(
                success=success,
                result=result,
                confidence=1.0 if success else 0.0,
                processing_time_ms=elapsed_ms,
                model_version=self.version,
            )
        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
            return InferenceOutput(
                success=False,
                result={},
                error=str(exc),
                processing_time_ms=elapsed_ms,
                model_version=self.version,
            )

    def status(self) -> dict[str, Any]:
        service_status = self._service.status
        return {
            "ready": bool(service_status.get("ready")),
            "name": self.name,
            "version": self.version,
            "detail": service_status.get("message") or "Gemini embeddings",
            "model_id": service_status.get("model_id"),
            "embedding_dim": service_status.get("embedding_dim"),
        }
