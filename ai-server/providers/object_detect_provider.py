"""InferenceProvider for future 21-class object detection (separate YOLO weights)."""

from __future__ import annotations

import asyncio
import time
from typing import Any

from core.inference_provider import InferenceInput, InferenceOutput
from core.yolo_detector import YoloDetector
from utils.image_utils import decode_image, pil_to_bgr_numpy, resize_image

PROVIDER_NAME = "object_v1"


class ObjectDetectProvider:
    """
    Generic object detector — inactive until ``OBJECT_MODEL_PATH`` weights exist.

    Uses a dedicated ``YoloDetector`` instance (not the card OCR detector).
    """

    name = PROVIDER_NAME
    version = "object-yolov8-v1"

    def __init__(self, detector: YoloDetector) -> None:
        self._detector = detector

    async def predict(self, input: InferenceInput) -> InferenceOutput:
        started = time.perf_counter()
        if not input.image_bytes:
            return InferenceOutput(
                success=False,
                result={},
                error="image_bytes is required",
                model_version=self.version,
            )

        if not self._detector.is_ready:
            elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
            return InferenceOutput(
                success=True,
                result={
                    "model": self.name,
                    "version": self.version,
                    "status": "unavailable",
                    "ready": False,
                    "message": self._detector.status.get("error") or "Object model weights not configured",
                    "detected_objects": [],
                    "processing_time_ms": elapsed_ms,
                },
                processing_time_ms=elapsed_ms,
                model_version=self.version,
            )

        try:
            pil_image = resize_image(decode_image(input.image_bytes))
            image_bgr = pil_to_bgr_numpy(pil_image)
            raw_detections = await asyncio.to_thread(self._detector.predict, image_bgr)
            detected_objects = [
                {
                    "class_name": det["class_name"],
                    "confidence": round(float(det["confidence"]), 4),
                    "bbox": det["bbox"],
                }
                for det in raw_detections
            ]
            elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
            return InferenceOutput(
                success=True,
                result={
                    "model": self.name,
                    "version": self.version,
                    "status": "success" if detected_objects else "skipped",
                    "ready": True,
                    "detected_objects": detected_objects,
                    "processing_time_ms": elapsed_ms,
                },
                confidence=max((d["confidence"] for d in detected_objects), default=0.0),
                processing_time_ms=elapsed_ms,
                model_version=self.version,
            )
        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
            return InferenceOutput(
                success=False,
                result={
                    "model": self.name,
                    "status": "error",
                    "detected_objects": [],
                },
                error=str(exc),
                processing_time_ms=elapsed_ms,
                model_version=self.version,
            )

    def status(self) -> dict[str, Any]:
        detector_status = self._detector.status
        class_count = len(detector_status.get("class_names") or {})
        return {
            "ready": self._detector.is_ready,
            "name": self.name,
            "version": self.version,
            "detail": (
                f"Object detector ({class_count} classes configured)"
                if self._detector.is_ready
                else detector_status.get("error") or "Awaiting object model weights"
            ),
            "class_count": class_count,
            "weights_path": detector_status.get("weights_path"),
            "placeholder": not self._detector.is_ready,
        }
