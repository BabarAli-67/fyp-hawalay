"""
Analyze pipeline orchestration via ModelRegistry.

Routes must call this module instead of invoking OCR/Gemini services directly.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np

from config import Settings, get_settings
from core.inference_provider import InferenceInput
from core.model_ids import CARD_OCR_V1, GEMINI_CAPTION, GEMINI_EMBED, GEMINI_FEATURES, OBJECT_V1
from core.model_registry import ModelRegistry
from schemas.detection import DetectedObjectItem, ObjectDetectionResult
from services.clip_service import CLIP_EMBEDDING_DIM, fuse_vectors
from utils.image_utils import decode_image, image_to_bytes, resize_image
from schemas.extraction import ExtractedAttribute
from utils.analyze_context import build_analyze_context, build_extracted_attributes
from utils.report_caption import (
    build_caption_context_from_analyze,
    build_ocr_fallback_caption,
    build_structured_fallback_caption,
    is_truncated_caption,
    is_unusable_caption,
    repair_incomplete_caption,
)
from utils.report_features import format_feature_bullets, resolve_feature_points
from utils.gemini_debug import mask_api_key
from utils.text_builder import build_enriched_text

logger = logging.getLogger(__name__)

# Document/card uploads — object_v1 has no banking-card class; skip general classifier.
_CARD_DOCUMENT_TYPES = frozenset(
    {
        "credit_card",
        "cnic",
        "id_card",
        "national_id",
        "passport",
        "driving_license",
        "id",
        "document",
        "documents",
    }
)
_CARD_STRUCTURAL_YOLO_CLASSES = frozenset(
    {
        "card_boundary",
        "card_brand",
        "card_number",
        "cardholder_name",
        "expiry_date",
    }
)
_CARD_TEXT_FIELD_KEYS = ("card_number", "cardholder_name", "card_brand", "expiry_date")


def _normalize_document_type(document_type: str) -> str:
    return (document_type or "auto").strip().lower()


def _user_indicates_document_upload(*, document_type: str, category: str) -> bool:
    """Pre-OCR signal: explicit document hint or user chose Documents category."""
    doc = _normalize_document_type(document_type)
    if doc != "auto" and doc in _CARD_DOCUMENT_TYPES:
        return True
    return (category or "").strip() == "Documents"


def _ocr_has_card_text_fields(ocr_payload: dict[str, Any]) -> bool:
    fields = ocr_payload.get("fields")
    if isinstance(fields, dict):
        for key in _CARD_TEXT_FIELD_KEYS:
            entry = fields.get(key)
            if isinstance(entry, dict):
                value = entry.get("value")
            else:
                value = entry
            if value is not None and str(value).strip():
                return True
    for key in _CARD_TEXT_FIELD_KEYS:
        flat = ocr_payload.get(key)
        if flat is not None and str(flat).strip():
            return True
    return False


def _ocr_resolved_as_card_document(ocr_payload: dict[str, Any]) -> bool:
    doc = str(ocr_payload.get("document_type") or "").strip().lower()
    return doc in _CARD_DOCUMENT_TYPES


def _yolo_card_structural_confidence(ocr_payload: dict[str, Any]) -> float:
    """Highest YOLO box confidence among card-region classes in the OCR payload."""
    best = 0.0
    for item in ocr_payload.get("detections") or []:
        if not isinstance(item, dict):
            continue
        class_name = str(item.get("class_name") or "").strip()
        if class_name not in _CARD_STRUCTURAL_YOLO_CLASSES:
            continue
        raw = item.get("detection_confidence")
        if raw is None:
            raw = item.get("confidence", 0.0)
        try:
            best = max(best, float(raw or 0.0))
        except (TypeError, ValueError):
            continue

    fields = ocr_payload.get("fields")
    if isinstance(fields, dict):
        for key in _CARD_STRUCTURAL_YOLO_CLASSES:
            entry = fields.get(key)
            if not isinstance(entry, dict):
                continue
            raw = entry.get("detection_confidence")
            if raw is None:
                continue
            try:
                best = max(best, float(raw))
            except (TypeError, ValueError):
                continue
    return best


def _card_pipeline_active(ocr_payload: dict[str, Any], *, yolo_threshold: float) -> bool:
    """
    Post-OCR signal: resolved document type, high-confidence YOLO card regions,
    or successful structured card text extraction.
    """
    if not ocr_payload:
        return False
    if _ocr_resolved_as_card_document(ocr_payload):
        return True
    if _yolo_card_structural_confidence(ocr_payload) >= yolo_threshold:
        return True
    if bool(ocr_payload.get("success")) and _ocr_has_card_text_fields(ocr_payload):
        return True
    return False


def _card_pipeline_processing_text(ocr_payload: dict[str, Any]) -> bool:
    if not ocr_payload or not ocr_payload.get("success"):
        return False
    if _ocr_has_card_text_fields(ocr_payload):
        return True
    return bool((ocr_payload.get("ocr_text") or "").strip())


def _best_object_confidence(block: ObjectDetectionResult) -> float:
    if not block.detected_objects:
        return 0.0
    return max(obj.confidence for obj in block.detected_objects)


def _skipped_object_detection(message: str) -> ObjectDetectionResult:
    return ObjectDetectionResult(
        model=OBJECT_V1,
        status="skipped",
        ready=False,
        message=message,
        detected_objects=[],
    )


def _nullify_object_detection(block: ObjectDetectionResult, reason: str) -> ObjectDetectionResult:
    return ObjectDetectionResult(
        model=block.model or OBJECT_V1,
        version=block.version,
        status="skipped",
        ready=False,
        message=reason,
        detected_objects=[],
        processing_time_ms=block.processing_time_ms,
    )


def ensure_embedding_512(vec: np.ndarray | None) -> list[float]:
    if vec is None:
        return [0.0] * CLIP_EMBEDDING_DIM
    flat = np.asarray(vec, dtype=np.float32).flatten()
    if flat.size == 0:
        return [0.0] * CLIP_EMBEDDING_DIM
    if flat.size == CLIP_EMBEDDING_DIM:
        return flat.tolist()
    out = np.zeros(CLIP_EMBEDDING_DIM, dtype=np.float32)
    length = min(int(flat.size), CLIP_EMBEDDING_DIM)
    out[:length] = flat[:length]
    return out.tolist()


class AnalyzeOrchestrator:
    """Registry-driven analyze-image and vision pipelines."""

    def __init__(self, registry: ModelRegistry, settings: Settings | None = None) -> None:
        self._registry = registry
        self._settings = settings or get_settings()

    def build_models_info(
        self,
        *,
        embedding_dimension: int,
        yolo_ready: bool | None = None,
    ) -> dict[str, Any]:
        if yolo_ready is None:
            yolo_ready = self._registry.is_ready(CARD_OCR_V1)
        object_status = self._registry.all_statuses().get(OBJECT_V1, {})
        return {
            "caption": self._settings.gemini_caption_model,
            "embedding": self._settings.gemini_embedding_model,
            "ocr": "card_ocr_v1 (YOLO+EasyOCR)" if yolo_ready else "easyocr_degraded",
            "object": object_status.get("detail") or OBJECT_V1,
            "features": self._settings.gemini_caption_model,
            "pipeline_version": self._settings.pipeline_version,
            "embedding_dimension": embedding_dimension,
        }

    async def run_card_ocr(
        self,
        *,
        image_bytes: bytes,
        content_type: str | None,
        document_type: str,
    ) -> dict[str, Any]:
        provider = self._registry.get(CARD_OCR_V1)
        output = await provider.predict(
            InferenceInput(
                image_bytes=image_bytes,
                meta={"content_type": content_type, "document_type": document_type},
            )
        )
        if output.result:
            return output.result
        logger.warning("card_ocr_v1 failed: %s", output.error)
        return {
            "success": False,
            "status": "error",
            "document_type": document_type,
            "processing_time_ms": float(output.processing_time_ms or 0.0),
            "message": output.error or "OCR failed",
            "ocr_text": "",
            "fields": {},
            "detections": [],
        }

    async def run_object_detection(
        self,
        *,
        image_bytes: bytes,
        enabled: bool = True,
    ) -> ObjectDetectionResult:
        if not enabled:
            return ObjectDetectionResult(
                model=OBJECT_V1,
                status="skipped",
                ready=False,
                message="Object detection disabled for this request",
            )

        if OBJECT_V1 not in self._registry.all_statuses():
            return ObjectDetectionResult(
                model=OBJECT_V1,
                status="unavailable",
                ready=False,
                message="object_v1 provider not registered",
            )

        if not self._registry.is_ready(OBJECT_V1):
            status = self._registry.get(OBJECT_V1).status()
            return ObjectDetectionResult(
                model=OBJECT_V1,
                version=status.get("version", ""),
                status="unavailable",
                ready=False,
                message=status.get("detail") or "Object model not ready",
            )

        provider = self._registry.get(OBJECT_V1)
        output = await provider.predict(InferenceInput(image_bytes=image_bytes))
        result = output.result or {}
        items = [
            DetectedObjectItem.model_validate(item)
            for item in result.get("detected_objects", [])
            if isinstance(item, dict)
        ]
        return ObjectDetectionResult(
            model=result.get("model") or OBJECT_V1,
            version=result.get("version") or provider.version,
            status=result.get("status") or ("success" if output.success else "error"),
            ready=bool(result.get("ready")),
            message=result.get("message"),
            detected_objects=items,
            processing_time_ms=float(result.get("processing_time_ms") or output.processing_time_ms),
        )

    async def run_vision(
        self,
        *,
        raw_image: bytes | None,
        category: str,
        location: str,
        ocr_text: str,
        title: str = "",
        description: str = "",
        detected_object_names: list[str] | None = None,
        detected_objects: list[dict[str, Any]] | None = None,
        ocr_payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Caption + features + embeddings via registry."""
        empty = {
            "caption": "",
            "distinctive_features": "",
            "feature_points": [],
            "extracted_attributes": [],
            "ocr_text": ocr_text or "",
            "embedding_vector": None,
            "embedding_dimension": 0,
            "embedding_available": False,
            "vision_status": "empty",
            "vision_message": "",
        }
        try:
            image_bytes = b""
            if raw_image:
                try:
                    img = resize_image(decode_image(raw_image))
                    image_bytes = image_to_bytes(img)
                    logger.info(
                        "[vision] image prepared for Gemini bytes=%d (raw=%d)",
                        len(image_bytes),
                        len(raw_image),
                    )
                except Exception as exc:
                    logger.error(
                        "[vision] image decode/resize FAILED — Gemini will NOT be called: %s",
                        exc,
                        exc_info=True,
                    )

            caption_context = build_caption_context_from_analyze(
                category=category,
                location=location,
                title=title,
                user_description=description,
                ocr_payload=ocr_payload,
                detected_object_names=detected_object_names,
                detected_objects=detected_objects,
            )
            features_context = build_analyze_context(
                category=category,
                location=location,
                title=title,
                user_description=description,
                ocr_payload=ocr_payload,
                detected_object_names=detected_object_names,
                detected_objects=detected_objects,
            )

            caption = ""
            features_raw = ""
            quota_limited = False
            vision_status = "unavailable"
            vision_message = ""
            caption_skip_reason = ""

            gemini_ready = self._registry.is_ready(GEMINI_CAPTION)
            logger.info(
                "[vision] caption phase: image_bytes=%d gemini_caption_ready=%s key=%s model=%s",
                len(image_bytes),
                gemini_ready,
                mask_api_key(self._settings.gemini_api_key),
                self._settings.gemini_caption_model,
            )

            if not image_bytes:
                caption_skip_reason = "vision_image_empty"
                logger.warning("[vision] skipping Gemini caption — no image bytes after decode")
            elif not gemini_ready:
                caption_skip_reason = "gemini_not_ready"
                provider_status = self._registry.all_statuses().get(GEMINI_CAPTION, {})
                logger.error(
                    "[vision] skipping Gemini caption — provider not ready: %s",
                    provider_status.get("message") or provider_status,
                )

            if image_bytes and gemini_ready:
                logger.info("[vision] calling GEMINI_CAPTION provider.predict()")
                cap_out = await self._registry.get(GEMINI_CAPTION).predict(
                    InferenceInput(
                        image_bytes=image_bytes,
                        meta={
                            "caption_context": caption_context,
                            "ocr_payload": ocr_payload,
                            "detected_object_names": detected_object_names,
                            "category": category,
                        },
                    )
                )
                cap_result = cap_out.result or {}
                quota_limited = bool(cap_result.get("rate_limited"))
                caption = (cap_result.get("caption") or "").strip()
                if caption and is_truncated_caption(caption):
                    repaired = repair_incomplete_caption(caption)
                    if repaired:
                        logger.info(
                            "[vision] repaired truncated Gemini caption words=%d",
                            len(repaired.split()),
                        )
                        caption = repaired
                if cap_out.error:
                    logger.error(
                        "[vision] GEMINI_CAPTION provider error: %s",
                        cap_out.error,
                    )
                logger.info(
                    "[vision] GEMINI_CAPTION result success=%s rate_limited=%s words=%d ms=%s",
                    cap_out.success,
                    quota_limited,
                    len(caption.split()),
                    cap_out.processing_time_ms,
                )
                if caption:
                    vision_status = "ok"
                elif quota_limited:
                    caption_skip_reason = "gemini_rate_limited"
                elif not cap_out.success:
                    caption_skip_reason = "gemini_provider_failed"
                else:
                    caption_skip_reason = "gemini_empty_response"

            if (
                self._settings.gemini_features_enabled
                and image_bytes
                and not quota_limited
                and GEMINI_FEATURES in self._registry.all_statuses()
                and self._registry.is_ready(GEMINI_FEATURES)
            ):
                feat_out = await self._registry.get(GEMINI_FEATURES).predict(
                    InferenceInput(
                        image_bytes=image_bytes,
                        meta={"features_context": features_context},
                    )
                )
                feat_result = feat_out.result or {}
                if feat_result.get("rate_limited"):
                    quota_limited = True
                features_raw = (feat_result.get("features_text") or "").strip()

            ocr_ok = bool(ocr_payload and ocr_payload.get("success"))
            gemini_unusable = is_unusable_caption(caption, ocr_payload)
            if caption.strip() and gemini_unusable:
                logger.warning(
                    "[vision] Gemini caption unusable — will try OCR fallback if available words=%d",
                    len(caption.split()),
                )

            if gemini_unusable and ocr_ok:
                fallback = build_ocr_fallback_caption(ocr_payload)
                if fallback:
                    caption = fallback
                    vision_status = "ocr_fallback"
                    if caption_skip_reason == "gemini_not_ready":
                        vision_message = (
                            "Gemini client not ready — description drafted from OCR text. "
                            "Set GEMINI_API_KEY in ai-server/.env and restart python main.py."
                        )
                    elif caption_skip_reason == "vision_image_empty":
                        vision_message = (
                            "Could not prepare image for Gemini — description drafted from OCR text."
                        )
                    elif quota_limited or caption_skip_reason == "gemini_rate_limited":
                        vision_message = (
                            "Gemini API quota exceeded — description drafted from extracted text. "
                            "Check billing at ai.google.dev or retry later."
                        )
                    elif caption_skip_reason == "gemini_empty_response":
                        vision_message = (
                            "Gemini returned an empty description — drafted from extracted text instead."
                        )
                    else:
                        vision_message = (
                            "AI description unavailable — drafted from extracted text. "
                            "See ai-server logs for [caption] / [vision] details."
                        )
                    logger.warning(
                        "[vision] OCR fallback caption applied reason=%s words=%d",
                        caption_skip_reason or "unknown",
                        len(caption.split()),
                    )

            if (not caption.strip() or is_truncated_caption(caption)) and image_bytes:
                structured = build_structured_fallback_caption(
                    ocr_payload,
                    detected_object_names=detected_object_names,
                    category=category,
                )
                if structured:
                    caption = structured
                    vision_status = "structured_fallback"
                    if not vision_message:
                        vision_message = (
                            "AI description was incomplete — a complete draft was built from "
                            "detected item details."
                        )
                    logger.warning(
                        "[vision] structured fallback caption applied words=%d",
                        len(caption.split()),
                    )

            if quota_limited and vision_status != "ocr_fallback":
                vision_status = "rate_limited"
                vision_message = (
                    "Gemini API quota exceeded. OCR text was extracted, but AI description could not be generated. "
                    "Upgrade your API plan or wait and retry."
                )
            elif quota_limited and vision_status == "ocr_fallback":
                pass  # vision_message already set
            elif not caption.strip() and image_bytes and gemini_ready:
                vision_status = "empty"
                vision_message = (
                    f"Could not generate an AI description ({caption_skip_reason or 'unknown'}). "
                    "Check ai-server console for [gemini] / [caption] logs."
                )
            elif not image_bytes:
                vision_status = "skipped"
                vision_message = "No image provided for vision analysis."

            logger.info(
                "[vision] pipeline done vision_status=%s caption_words=%d",
                vision_status,
                len(caption.split()),
            )

            feature_points = resolve_feature_points(
                gemini_text=features_raw,
                ocr_payload=ocr_payload,
                detected_objects=detected_objects,
            )
            distinctive_features = format_feature_bullets(feature_points)

            # TODO FLOW 1: Embedding deferred to submit-time only via /ai/embed-item.
            # detection_hint = ""
            # if detected_object_names:
            #     detection_hint = ", ".join(detected_object_names[:5])
            #
            # enriched = build_enriched_text(
            #     category,
            #     location,
            #     caption,
            #     ocr_text,
            #     title=title,
            #     description=description,
            #     feature_points=feature_points,
            # )
            # if detection_hint:
            #     enriched = f"{enriched}. Objects: {detection_hint}".strip(". ")
            #
            # text_vec = None
            # img_vec = None
            # text_ok = False
            # img_ok = False
            #
            # if self._registry.is_ready(GEMINI_EMBED):
            #     if enriched.strip():
            #         text_out = await self._registry.get(GEMINI_EMBED).predict(
            #             InferenceInput(text=enriched)
            #         )
            #         if text_out.success and text_out.result.get("embedding_vector"):
            #             text_ok = bool(text_out.result.get("embedding_ok"))
            #             text_vec = np.array(text_out.result["embedding_vector"], dtype=np.float32)
            #
            #     if image_bytes:
            #         img_out = await self._registry.get(GEMINI_EMBED).predict(
            #             InferenceInput(image_bytes=image_bytes)
            #         )
            #         if img_out.success and img_out.result.get("embedding_vector"):
            #             img_ok = bool(img_out.result.get("embedding_ok"))
            #             img_vec = np.array(img_out.result["embedding_vector"], dtype=np.float32)
            #
            # embedding_available = (text_ok or img_ok) if image_bytes else text_ok
            # combined = fuse_vectors(img_vec, text_vec)
            # embedding_vector = ensure_embedding_512(combined)
            embedding_vector = None
            embedding_available = False
            embedding_dimension = 0

            extracted_attrs = build_extracted_attributes(
                ocr_payload=ocr_payload,
                detected_objects=detected_objects,
            )

            return {
                "caption": caption or "",
                "distinctive_features": distinctive_features,
                "feature_points": feature_points,
                "extracted_attributes": extracted_attrs,
                "ocr_text": ocr_text or "",
                "embedding_vector": embedding_vector,
                "embedding_dimension": embedding_dimension,
                "embedding_available": embedding_available,
                "vision_status": vision_status,
                "vision_message": vision_message,
            }
        except Exception as exc:
            logger.warning("vision pipeline failed: %s", exc)
            return {**empty, "ocr_text": ocr_text or ""}

    async def run_analyze(
        self,
        *,
        raw_image: bytes,
        content_type: str | None,
        document_type: str,
        category: str = "",
        location: str = "",
        title: str = "",
        description: str = "",
        enable_object_detect: bool = True,
    ) -> dict[str, Any]:
        """Full analyze-image pipeline: OCR → optional objects → vision."""
        yolo_threshold = self._settings.yolo_confidence_threshold
        object_threshold = self._settings.object_confidence_threshold
        pre_skip_object = _user_indicates_document_upload(
            document_type=document_type,
            category=category,
        )

        logger.info(
            "[analyze] run_analyze start bytes=%d document_type=%s category=%r object_detect=%s pre_skip_object=%s",
            len(raw_image),
            document_type,
            category,
            enable_object_detect,
            pre_skip_object,
        )

        ocr_payload = await self.run_card_ocr(
            image_bytes=raw_image,
            content_type=content_type,
            document_type=document_type,
        )
        structured_ocr_text = (ocr_payload.get("ocr_text") or "").strip()

        card_active = _card_pipeline_active(ocr_payload, yolo_threshold=yolo_threshold)
        skip_object = (
            not enable_object_detect
            or pre_skip_object
            or card_active
        )

        if skip_object:
            if not enable_object_detect:
                skip_reason = "Object detection disabled for this request"
            elif pre_skip_object:
                skip_reason = (
                    "object_v1 skipped — document/card upload indicated "
                    f"(document_type={document_type!r}, category={category!r})"
                )
            else:
                skip_reason = (
                    "object_v1 skipped — card_ocr_v1 detected document/card regions "
                    f"(document_type={ocr_payload.get('document_type')!r}, "
                    f"yolo_conf>={yolo_threshold:.2f})"
                )
            logger.info("[analyze] %s", skip_reason)
            object_block = _skipped_object_detection(skip_reason)
        else:
            object_block = await self.run_object_detection(
                image_bytes=raw_image,
                enabled=True,
            )
            nullify_reason = ""
            if _card_pipeline_processing_text(ocr_payload):
                nullify_reason = (
                    "object_v1 suppressed — card_ocr_v1 extracted structured card text"
                )
            elif card_active:
                nullify_reason = (
                    "object_v1 suppressed — card/document pipeline active "
                    "(avoids false labels such as eyewear on payment cards)"
                )
            elif (
                object_block.detected_objects
                and _best_object_confidence(object_block) < object_threshold
            ):
                nullify_reason = (
                    f"object_v1 suppressed — top confidence "
                    f"{_best_object_confidence(object_block):.2f} below threshold {object_threshold:.2f}"
                )

            if nullify_reason:
                logger.info("[analyze] %s", nullify_reason)
                object_block = _nullify_object_detection(object_block, nullify_reason)

        object_names = [obj.class_name for obj in object_block.detected_objects if obj.class_name]
        detected_objects = [obj.model_dump() for obj in object_block.detected_objects]

        vision = await self.run_vision(
            raw_image=raw_image,
            category=category,
            location=location,
            ocr_text=structured_ocr_text,
            title=title,
            description=description,
            detected_object_names=object_names,
            detected_objects=detected_objects,
            ocr_payload=ocr_payload,
        )

        return {
            "ocr": ocr_payload,
            "object_detection": object_block.model_dump(),
            "caption": vision["caption"],
            "distinctive_features": vision.get("distinctive_features") or "",
            "feature_points": vision.get("feature_points") or [],
            "extracted_attributes": vision.get("extracted_attributes") or [],
            "ocr_text": vision["ocr_text"] or structured_ocr_text,
            "embedding_vector": vision["embedding_vector"],
            "embedding_dimension": vision["embedding_dimension"],
            "embedding_available": vision["embedding_available"],
            "vision_status": vision.get("vision_status") or "empty",
            "vision_message": vision.get("vision_message") or "",
        }

    async def embed_item_report(
        self,
        *,
        raw_image: bytes | None = None,
        category: str = "",
        location: str = "",
        title: str = "",
        description: str = "",
        distinctive_features: str = "",
        brand: str = "",
        colors: list[str] | None = None,
        caption: str = "",
        ocr_text: str = "",
        feature_points: list[str] | None = None,
        object_labels: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Build matching fingerprint from final submitted report fields.

        Works with or without image: text-only manual reports still get embeddings.
        When both image and text exist, fuses visual + semantic signals.
        """
        empty = {
            "embedding_vector": [0.0] * CLIP_EMBEDDING_DIM,
            "embedding_dimension": CLIP_EMBEDDING_DIM,
            "embedding_available": False,
            "embedding_model": self._settings.gemini_embedding_model,
        }

        enriched = build_enriched_text(
            category,
            location,
            caption,
            ocr_text,
            title=title,
            description=description,
            brand=brand,
            colors=colors,
            distinctive_features=distinctive_features,
            feature_points=feature_points,
        )
        if object_labels:
            hint = ", ".join(object_labels[:8])
            enriched = f"{enriched}. Objects: {hint}".strip(". ") if enriched else f"Objects: {hint}"

        if not enriched.strip() and not raw_image:
            logger.info("[embed-item] no text or image — cannot build embedding")
            return empty

        logger.info(
            "[embed-item] enriched text chars=%d preview=%r",
            len(enriched),
            enriched[:240] + ("…" if len(enriched) > 240 else ""),
        )

        text_vec = None
        img_vec = None
        text_ok = False
        img_ok = False

        try:
            image_bytes = b""
            if raw_image:
                try:
                    img = resize_image(decode_image(raw_image))
                    image_bytes = image_to_bytes(img)
                except Exception as exc:
                    logger.warning("[embed-item] image decode failed: %s", exc)

            if self._registry.is_ready(GEMINI_EMBED):
                if enriched.strip():
                    text_out = await self._registry.get(GEMINI_EMBED).predict(
                        InferenceInput(text=enriched)
                    )
                    if text_out.success and text_out.result.get("embedding_vector"):
                        text_ok = bool(text_out.result.get("embedding_ok"))
                        text_vec = np.array(text_out.result["embedding_vector"], dtype=np.float32)

                if image_bytes and self._settings.gemini_embed_image:
                    img_out = await self._registry.get(GEMINI_EMBED).predict(
                        InferenceInput(image_bytes=image_bytes)
                    )
                    if img_out.success and img_out.result.get("embedding_vector"):
                        img_ok = bool(img_out.result.get("embedding_ok"))
                        img_vec = np.array(img_out.result["embedding_vector"], dtype=np.float32)

            embedding_available = (text_ok or img_ok) if (image_bytes and self._settings.gemini_embed_image) else text_ok
            combined = fuse_vectors(img_vec, text_vec)
            vector = ensure_embedding_512(combined)

            return {
                "embedding_vector": vector,
                "embedding_dimension": len(vector),
                "embedding_available": embedding_available and any(v != 0.0 for v in vector),
                "embedding_model": self._settings.gemini_embedding_model,
            }
        except Exception as exc:
            logger.warning("[embed-item] failed: %s", exc)
            return empty
