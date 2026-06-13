"""
object_v1 prediction service — Keras detection + category mapping + Gemini caption.

Mirrors the OCR service workflow: validate upload → model inference → structured response.
Detection and caption phases are independent; partial success is returned when one fails.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from config import Settings, get_settings
from core.keras_object_detector import KerasObjectDetector
from core.model_ids import OBJECT_V1
from services.blip_service import BlipService
from utils.category_mapping import load_category_map_from_settings, suggest_category_from_detections
from utils.image_utils import decode_image, image_to_numpy, resize_image, validate_image_upload
from utils.report_caption import build_caption_context_from_analyze

logger = logging.getLogger(__name__)

SERVICE_VERSION = "object-keras-v1"


def _best_detection_per_class(
    detections: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Keep highest-confidence box per class (one feature row per class)."""
    best: dict[str, dict[str, Any]] = {}
    for det in detections:
        class_name = str(det.get("class_name") or "").strip()
        if not class_name:
            continue
        existing = best.get(class_name)
        if existing is None or float(det.get("confidence") or 0.0) > float(
            existing.get("confidence") or 0.0
        ):
            best[class_name] = det
    return list(best.values())


def _enrich_detection(
    det: dict[str, Any],
    category_map: dict[str, str],
) -> dict[str, Any]:
    class_name = str(det.get("class_name") or "").strip()
    category = category_map.get(class_name)
    return {
        "class_name": class_name,
        "category": category,
        "confidence": round(float(det.get("confidence") or 0.0), 4),
        "bbox": list(det.get("bbox") or []),
        "source": OBJECT_V1,
    }


class ObjectService:
    """Production object_v1 service — Keras weights + Gemini caption."""

    def __init__(
        self,
        detector: KerasObjectDetector,
        blip_service: BlipService,
        *,
        category_map: dict[str, str] | None = None,
        settings: Settings | None = None,
    ) -> None:
        self._detector = detector
        self._blip = blip_service
        self._settings = settings or get_settings()
        self._category_map = category_map if category_map is not None else load_category_map_from_settings(
            self._settings
        )

    @property
    def detector_status(self) -> dict[str, Any]:
        return self._detector.status

    @property
    def gemini_status(self) -> dict[str, Any]:
        return self._blip.status

    @property
    def category_map_size(self) -> int:
        return len(self._category_map)

    async def detect_and_describe(
        self,
        image_bytes: bytes,
        *,
        content_type: str | None = None,
        category: str = "",
        location: str = "",
        title: str = "",
        enable_caption: bool = True,
    ) -> dict[str, Any]:
        """
        Run object_v1 Keras inference, map categories, optionally caption with Gemini.

        Returns a dict compatible with ``ObjectDetectResponse``.
        """
        validate_image_upload(content_type, len(image_bytes))
        pipeline_started = time.perf_counter()

        logger.info(
            "[object_v1] request received bytes=%d content_type=%s caption=%s",
            len(image_bytes),
            content_type,
            enable_caption,
        )

        detector_ready = self._detector.is_ready
        gemini_ready = bool(self._blip.status.get("ready"))

        detected_objects: list[dict[str, Any]] = []
        detected_features: list[dict[str, Any]] = []
        suggested_category: str | None = None
        detection_status = "skipped"
        detection_message: str | None = None
        detection_time_ms = 0.0

        caption = ""
        caption_status = "skipped"
        caption_message: str | None = None
        caption_time_ms = 0.0

        if not detector_ready:
            detection_status = "unavailable"
            detection_message = self._detector.status.get("error") or "Object model weights not configured"
            logger.warning("[object_v1] detector unavailable: %s", detection_message)
        else:
            det_started = time.perf_counter()
            try:
                pil_image = resize_image(decode_image(image_bytes))
                image_rgb = image_to_numpy(pil_image)
                logger.info(
                    "[object_v1] decoded image size=%sx%s",
                    pil_image.width,
                    pil_image.height,
                )
                raw_detections = await asyncio.to_thread(self._detector.predict, image_rgb)
                detection_time_ms = round((time.perf_counter() - det_started) * 1000, 1)

                detected_objects = [
                    _enrich_detection(det, self._category_map) for det in raw_detections
                ]
                feature_rows = _best_detection_per_class(raw_detections)
                detected_features = [
                    _enrich_detection(det, self._category_map) for det in feature_rows
                ]
                suggested_category = suggest_category_from_detections(
                    detected_features,
                    self._category_map,
                )

                detection_status = "success" if detected_objects else "skipped"
                logger.info(
                    "[object_v1] detection_count=%d unique_classes=%d suggested_category=%s ms=%.1f",
                    len(detected_objects),
                    len(detected_features),
                    suggested_category,
                    detection_time_ms,
                )
            except Exception as exc:
                detection_time_ms = round((time.perf_counter() - det_started) * 1000, 1)
                detection_status = "error"
                detection_message = str(exc)
                logger.exception("[object_v1] detection failed: %s", exc)

        if enable_caption:
            if not gemini_ready:
                caption_status = "unavailable"
                caption_message = (
                    self._blip.status.get("message")
                    or "Gemini client not ready — set GEMINI_API_KEY and restart ai-server"
                )
                logger.warning("[object_v1] caption skipped — gemini not ready")
            else:
                cap_started = time.perf_counter()
                try:
                    gemini_bytes = image_bytes
                    detected_object_names = [row["class_name"] for row in detected_features if row.get("class_name")]
                    caption_context = build_caption_context_from_analyze(
                        category=category or (suggested_category or ""),
                        location=location,
                        title=title,
                        detected_object_names=detected_object_names,
                        detected_objects=detected_features,
                    )
                    cap_result = await self._blip.caption(
                        gemini_bytes,
                        context=caption_context,
                        detected_object_names=detected_object_names,
                        category=category or (suggested_category or ""),
                    )
                    caption_time_ms = round((time.perf_counter() - cap_started) * 1000, 1)
                    caption = str(cap_result.get("caption") or "").strip()
                    if caption:
                        caption_status = "success"
                        logger.info(
                            "[object_v1] Gemini caption success words=%d ms=%.1f",
                            len(caption.split()),
                            caption_time_ms,
                        )
                    else:
                        caption_status = "degraded"
                        caption_message = (
                            "Gemini returned an empty caption"
                            if not cap_result.get("rate_limited")
                            else "Gemini rate limited or transient error — caption unavailable"
                        )
                        logger.warning(
                            "[object_v1] Gemini caption empty status=%s rate_limited=%s",
                            cap_result.get("status"),
                            cap_result.get("rate_limited"),
                        )
                except Exception as exc:
                    caption_time_ms = round((time.perf_counter() - cap_started) * 1000, 1)
                    caption_status = "error"
                    caption_message = str(exc)
                    logger.exception("[object_v1] caption failed: %s", exc)

        processing_time_ms = round((time.perf_counter() - pipeline_started) * 1000, 1)

        detection_ok = detection_status in ("success", "skipped")
        caption_ok = caption_status == "success"
        overall_success = detection_ok or caption_ok
        if detection_ok and caption_ok:
            overall_status = "success"
        elif detection_ok or caption_ok:
            overall_status = "degraded"
        elif detection_status == "unavailable" and caption_status == "unavailable":
            overall_status = "unavailable"
        else:
            overall_status = "error"

        message_parts: list[str] = []
        if detection_message:
            message_parts.append(detection_message)
        if caption_message and caption_status != "success":
            message_parts.append(caption_message)
        combined_message = "; ".join(message_parts) if message_parts else None

        payload = {
            "success": overall_success,
            "status": overall_status,
            "model": OBJECT_V1,
            "version": SERVICE_VERSION,
            "message": combined_message,
            "detected_objects": detected_objects,
            "detected_features": detected_features,
            "suggested_category": suggested_category,
            "caption": caption,
            "caption_status": caption_status,
            "caption_message": caption_message if caption_status != "success" else None,
            "detection_time_ms": detection_time_ms,
            "caption_time_ms": caption_time_ms,
            "processing_time_ms": processing_time_ms,
            "detector_ready": detector_ready,
            "gemini_ready": gemini_ready,
        }

        logger.info(
            "[object_v1] complete status=%s detection=%s caption=%s objects=%d features=%d "
            "caption_words=%d ms=%.1f",
            overall_status,
            detection_status,
            caption_status,
            len(detected_objects),
            len(detected_features),
            len(caption.split()),
            processing_time_ms,
        )
        return payload
