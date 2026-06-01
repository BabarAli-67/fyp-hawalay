"""
OCR pipeline: YOLO region detection + EasyOCR text recognition.

Architecture:
  1. Validate upload → decode → resize (once)
  2. YOLO predict (model loaded at startup — not per request)
  3. Best box per class → preprocess crop → EasyOCR (minimized calls)
  4. Field-specific text cleaning → confidence scoring → Pydantic response
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from typing import TYPE_CHECKING, Any

import numpy as np
from PIL import Image

from core.yolo_detector import YoloDetector
from schemas.ocr import OcrExtractResponse
from utils.image_utils import (
    crop_with_padding,
    decode_image,
    pil_to_bgr_numpy,
    resize_image,
    validate_image_upload,
)
from utils.ocr_preprocessing import preprocess_for_easyocr, preprocess_full_image_for_ocr
from utils.ocr_response_builder import build_ocr_response, response_to_dict
from utils.ocr_text_cleaning import OCR_FIELD_CLASSES, clean_text
from utils.text_builder import merge_detection_results

if TYPE_CHECKING:
    import easyocr

logger = logging.getLogger(__name__)

_OCR_SUPPORTING_TEXT_MAX_LEN = 200
_SKIP_OCR_CLASSES = frozenset({"card_boundary"})


def extract_text(image: Image.Image, reader: "easyocr.Reader") -> str:
    """
    Full-image supporting OCR signal (used by ``/ai/process-image``).

    Never raises — failures return ``""``.
    """
    bgr = pil_to_bgr_numpy(image)
    processed = preprocess_full_image_for_ocr(bgr)

    try:
        results = reader.readtext(processed, detail=0)
    except Exception as exc:
        logger.warning("[ocr] supporting readtext failed: %s", exc)
        return ""

    if not results:
        return ""

    joined = " ".join(str(line) for line in results)
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", " ", joined).lower()
    tokens = list(dict.fromkeys(cleaned.split()))
    return " ".join(tokens)[:_OCR_SUPPORTING_TEXT_MAX_LEN]


def _best_detection_per_class(
    raw_detections: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Keep highest-confidence YOLO box per class — reduces duplicate OCR calls."""
    best: dict[str, dict[str, Any]] = {}
    for det in raw_detections:
        class_name = det["class_name"]
        if class_name not in OCR_FIELD_CLASSES:
            continue
        existing = best.get(class_name)
        if existing is None or det["confidence"] > existing["confidence"]:
            best[class_name] = det
    return best


class OcrService:
    """Production OCR service — YOLO + EasyOCR, models loaded once at startup."""

    def __init__(
        self,
        ocr_reader: Any,
        yolo_detector: YoloDetector,
        *,
        easyocr_lock: asyncio.Semaphore | None = None,
    ) -> None:
        self._reader = ocr_reader
        self._yolo = yolo_detector
        self._lock = easyocr_lock or asyncio.Semaphore(1)

    @property
    def yolo_status(self) -> dict[str, Any]:
        return self._yolo.status

    async def extract(
        self,
        image_bytes: bytes,
        *,
        content_type: str | None = None,
        document_type: str = "auto",
    ) -> dict[str, Any]:
        validate_image_upload(content_type, len(image_bytes))
        started = time.perf_counter()

        logger.info(
            "[ocr] request received bytes=%d content_type=%s document_type=%s",
            len(image_bytes),
            content_type,
            document_type,
        )

        pil_image = resize_image(decode_image(image_bytes))
        image_bgr = pil_to_bgr_numpy(pil_image)
        logger.info("[ocr] decoded image size=%sx%s", pil_image.width, pil_image.height)

        try:
            if self._yolo.is_ready:
                async with self._lock:
                    response = await asyncio.to_thread(
                        self._extract_with_yolo,
                        image_bgr,
                        pil_image,
                        document_type,
                    )
            else:
                async with self._lock:
                    response = await asyncio.to_thread(
                        self._extract_degraded,
                        pil_image,
                        document_type,
                    )
        except Exception as exc:
            logger.exception("[ocr] pipeline failed: %s", exc)
            elapsed_ms = (time.perf_counter() - started) * 1000
            fallback = build_ocr_response(
                status="error",
                document_type_hint=document_type,
                detections_map={},
                processing_time_ms=elapsed_ms,
                message=str(exc),
                yolo_available=self._yolo.is_ready,
            )
            fallback.success = False
            return response_to_dict(fallback)

        elapsed_ms = (time.perf_counter() - started) * 1000
        response.processing_time_ms = round(elapsed_ms, 1)
        logger.info(
            "[ocr] complete success=%s status=%s ms=%.1f overall_conf=%.3f",
            response.success,
            response.status,
            response.processing_time_ms,
            response.overall_confidence,
        )
        return response_to_dict(response)

    def _extract_with_yolo(
        self,
        image_bgr: np.ndarray,
        pil_image: Image.Image,
        document_type: str,
    ) -> OcrExtractResponse:
        started = time.perf_counter()
        raw_detections = self._yolo.predict(image_bgr)
        detection_count = len(raw_detections)
        logger.info("[ocr] YOLO detection_count=%d", detection_count)

        if not raw_detections:
            logger.warning("[ocr] no regions — attempting full-image fallback")
            return self._full_image_fallback(
                pil_image,
                document_type=document_type,
                started=started,
                message="No document regions detected; used full-image OCR fallback",
                status="no_regions",
                yolo_available=True,
                detection_count=0,
            )

        best_by_class = _best_detection_per_class(raw_detections)
        ocr_by_class = self._batch_ocr_on_crops(image_bgr, best_by_class)

        for class_name in _SKIP_OCR_CLASSES:
            if class_name in best_by_class:
                ocr_by_class[class_name] = {"text": None, "ocr_confidence": None}

        detections_map = merge_detection_results(list(best_by_class.values()), ocr_by_class)
        elapsed_ms = (time.perf_counter() - started) * 1000

        return build_ocr_response(
            status="success",
            document_type_hint=document_type,
            detections_map=detections_map,
            processing_time_ms=elapsed_ms,
            yolo_available=True,
            detection_count=detection_count,
        )

    def _batch_ocr_on_crops(
        self,
        image_bgr: np.ndarray,
        best_by_class: dict[str, dict[str, Any]],
    ) -> dict[str, dict[str, Any]]:
        """
        Run EasyOCR once per class (best box only) — avoids redundant readtext calls.
        """
        ocr_by_class: dict[str, dict[str, Any]] = {}
        ocr_jobs = [
            (class_name, det)
            for class_name, det in best_by_class.items()
            if class_name not in _SKIP_OCR_CLASSES
        ]
        logger.info("[ocr] OCR jobs=%d (one per class max)", len(ocr_jobs))

        for class_name, det in ocr_jobs:
            crop = crop_with_padding(image_bgr, det["bbox"])
            ocr_by_class[class_name] = self._ocr_on_crop(crop, class_name)

        return ocr_by_class

    def _extract_degraded(self, pil_image: Image.Image, document_type: str) -> OcrExtractResponse:
        started = time.perf_counter()
        logger.warning("[ocr] YOLO unavailable — degraded full-image path")

        supporting_text = extract_text(pil_image, self._reader)
        elapsed_ms = (time.perf_counter() - started) * 1000

        return build_ocr_response(
            status="degraded",
            document_type_hint=document_type,
            detections_map={},
            processing_time_ms=elapsed_ms,
            message=(
                "YOLO weights not loaded; region OCR disabled. "
                "Configure YOLO_WEIGHTS_PATH for structured field extraction."
            ),
            yolo_available=False,
            detection_count=0,
            degraded_ocr_text=supporting_text or None,
        )

    def _full_image_fallback(
        self,
        pil_image: Image.Image,
        *,
        document_type: str,
        started: float,
        message: str,
        status: str,
        yolo_available: bool,
        detection_count: int,
    ) -> OcrExtractResponse:
        """Graceful fallback when YOLO finds no boxes."""
        supporting_text = extract_text(pil_image, self._reader)
        elapsed_ms = (time.perf_counter() - started) * 1000
        return build_ocr_response(
            status=status,
            document_type_hint=document_type,
            detections_map={},
            processing_time_ms=elapsed_ms,
            message=message,
            yolo_available=yolo_available,
            detection_count=detection_count,
            degraded_ocr_text=supporting_text or None,
        )

    def _readtext_on_crop(self, processed: np.ndarray, class_name: str, *, detail: int) -> list:
        """Sync readtext — only call while ``extract()`` holds ``easyocr_lock``."""
        try:
            return self._reader.readtext(processed, detail=detail)
        except Exception as exc:
            logger.warning("[ocr] EasyOCR failed class=%s: %s", class_name, exc)
            return []

    def _ocr_on_crop(self, crop_bgr: np.ndarray, class_name: str) -> dict[str, Any]:
        if crop_bgr.size == 0:
            logger.warning("[ocr] invalid empty crop class=%s", class_name)
            return {"text": "", "ocr_confidence": 0.0}

        processed = preprocess_for_easyocr(crop_bgr)
        results = self._readtext_on_crop(processed, class_name, detail=1)
        if not results:
            logger.debug("[ocr] no text class=%s", class_name)
            return {"text": "", "ocr_confidence": 0.0}

        full_text = " ".join(r[1] for r in results)
        avg_confidence = sum(r[2] for r in results) / len(results)
        cleaned = clean_text(full_text, class_name)

        logger.info(
            "[ocr] extracted class=%s value=%r ocr_conf=%.3f",
            class_name,
            cleaned[:40] if cleaned else "",
            avg_confidence,
        )
        return {"text": cleaned, "ocr_confidence": round(avg_confidence, 3)}
