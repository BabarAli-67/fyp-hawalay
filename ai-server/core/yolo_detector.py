"""
YOLOv8 detector lifecycle — loads only when weight file exists.

Ultralytics is imported lazily so the server starts without opencv/ultralytics
until weights are deployed.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

# Class schema from training repo (credit card / document regions)
DEFAULT_CLASS_NAMES: dict[int, str] = {
    0: "card_boundary",
    1: "card_brand",
    2: "card_number",
    3: "cardholder_name",
    4: "expiry_date",
}


class YoloDetector:
    """Optional YOLO region detector. Safe to construct without weights on disk."""

    def __init__(
        self,
        weights_path: Path | None,
        *,
        confidence: float = 0.5,
        use_gpu: bool = False,
        class_names: dict[int, str] | None = None,
    ) -> None:
        self._weights_path = weights_path
        self._confidence = confidence
        self._use_gpu = use_gpu
        self._class_names = DEFAULT_CLASS_NAMES if class_names is None else class_names
        self._model: Any = None
        self._load_error: str | None = None

        if weights_path is None:
            self._load_error = "YOLO_WEIGHTS_PATH is not set"
            logger.warning("[yolo] %s — detection disabled until weights are configured", self._load_error)
            return

        if not weights_path.is_file():
            self._load_error = f"Weight file not found: {weights_path}"
            logger.warning("[yolo] %s — detection disabled", self._load_error)
            return

        self._try_load(weights_path)

    @property
    def is_ready(self) -> bool:
        return self._model is not None

    @property
    def status(self) -> dict[str, Any]:
        return {
            "ready": self.is_ready,
            "weights_path": str(self._weights_path) if self._weights_path else None,
            "error": self._load_error,
            "class_names": self._class_names,
        }

    def _try_load(self, weights_path: Path) -> None:
        try:
            from ultralytics import YOLO  # noqa: PLC0415 — lazy import

            device = 0 if self._use_gpu else "cpu"
            self._model = YOLO(str(weights_path))
            # Warm-up not required; first predict will compile
            self._model.to(device)
            self._load_error = None
            logger.info("[yolo] loaded weights from %s (device=%s)", weights_path, device)
        except ImportError:
            self._load_error = (
                "ultralytics is not installed. Add opencv-python-headless and ultralytics to requirements.txt"
            )
            logger.warning("[yolo] %s", self._load_error)
        except Exception as exc:  # noqa: BLE001 — surface load failures without crashing app
            self._load_error = str(exc)
            logger.exception("[yolo] failed to load weights: %s", exc)

    def predict(self, image_bgr: np.ndarray) -> list[dict[str, Any]]:
        """
        Run detection. Returns empty list if model is not ready.
        Each detection: class_id, class_name, confidence, bbox [x1,y1,x2,y2]
        """
        if not self.is_ready or self._model is None:
            return []

        results = self._model.predict(
            source=image_bgr,
            conf=self._confidence,
            verbose=False,
        )
        boxes = results[0].boxes
        if boxes is None or len(boxes) == 0:
            return []

        detections: list[dict[str, Any]] = []
        for box in boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            class_id = int(box.cls[0].item())
            confidence = float(box.conf[0].item())
            detections.append(
                {
                    "class_id": class_id,
                    "class_name": self._class_names.get(class_id, "unknown"),
                    "confidence": confidence,
                    "bbox": [x1, y1, x2, y2],
                }
            )
        return detections
