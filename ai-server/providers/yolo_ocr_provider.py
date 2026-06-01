"""InferenceProvider wrapper for structured OCR (YOLO + EasyOCR)."""

from __future__ import annotations

import time
from typing import Any

from core.inference_provider import InferenceInput, InferenceOutput
from services.ocr_service import OcrService


class YoloOcrProvider:
    name = "card_ocr_v1"
    version = "yolov8-easyocr-v1"

    def __init__(self, ocr_service: OcrService) -> None:
        self._service = ocr_service

    def is_ready(self) -> bool:
        return getattr(self._service, "_reader", None) is not None

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
            result = await self._service.extract(
                input.image_bytes,
                content_type=meta.get("content_type"),
                document_type=meta.get("document_type", "auto"),
            )
            elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
            success = bool(result.get("success"))
            confidence = float(result.get("overall_confidence") or 0.0)
            return InferenceOutput(
                success=success,
                result=result,
                confidence=confidence,
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
        yolo_ready = bool(self._service.yolo_status.get("ready"))
        return {
            "ready": self.is_ready(),
            "name": self.name,
            "version": self.version,
            "detail": "YOLO + EasyOCR" if yolo_ready else "EasyOCR degraded (YOLO not ready)",
            "yolo_ready": yolo_ready,
        }
