"""
Keras object classifier lifecycle for object_v1.

Loads ``hawalay_final_model.keras`` (InceptionV3-style, 299×299, TensorFlow/Keras) —
separate from the OCR YOLO detector in ``yolo_detector.py``.

TensorFlow is imported lazily so the server starts when the model file is absent.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

DEFAULT_KERAS_WEIGHTS_NAME = "hawalay_final_model.keras"


class KerasObjectDetector:
    """Optional Keras object model. Safe to construct without weights on disk."""

    def __init__(
        self,
        model_path: Path | None,
        *,
        confidence: float = 0.5,
        use_gpu: bool = False,
        class_names: dict[int, str] | None = None,
    ) -> None:
        self._model_path = model_path
        self._confidence = confidence
        self._use_gpu = use_gpu
        self._class_names: dict[int, str] = class_names or {}
        self._model: Any = None
        self._load_error: str | None = None
        self._input_shape: tuple[int | None, ...] | None = None
        self._output_shape: tuple[int | None, ...] | None = None
        self._output_mode: str = "unknown"
        self._input_height = 224
        self._input_width = 224
        self._normalize_divisor = 255.0
        self._preprocess_mode = "scale_255"

        if model_path is None:
            self._load_error = "OBJECT_MODEL_PATH is not set"
            logger.warning(
                "[object_v1] %s — detection disabled until weights are configured",
                self._load_error,
            )
            return

        if not model_path.is_file():
            self._load_error = f"Keras model file not found: {model_path}"
            logger.warning("[object_v1] %s — detection disabled", self._load_error)
            return

        if model_path.suffix.lower() not in {".keras", ".h5"}:
            logger.warning(
                "[object_v1] unexpected model extension '%s' — attempting Keras load anyway",
                model_path.suffix,
            )

        self._try_load(model_path)

    @property
    def is_ready(self) -> bool:
        return self._model is not None

    @property
    def status(self) -> dict[str, Any]:
        return {
            "ready": self.is_ready,
            "backend": "keras",
            "weights_path": str(self._model_path) if self._model_path else None,
            "error": self._load_error,
            "class_names": self._class_names,
            "input_shape": list(self._input_shape) if self._input_shape else None,
            "output_shape": list(self._output_shape) if self._output_shape else None,
            "output_mode": self._output_mode,
            "confidence_threshold": self._confidence,
        }

    def _try_load(self, model_path: Path) -> None:
        logger.info("[object_v1] loading Keras model from %s", model_path)
        try:
            import os

            os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
            import tensorflow as tf  # noqa: PLC0415 — lazy import

            if not self._use_gpu:
                try:
                    tf.config.set_visible_devices([], "GPU")
                except Exception:  # noqa: BLE001 — CPU fallback is best-effort
                    pass

            self._model = tf.keras.models.load_model(str(model_path), compile=False)
            self._input_shape = tuple(self._model.input_shape)  # type: ignore[union-attr]
            self._output_shape = self._resolve_output_shape(self._model)
            self._configure_input_size()
            self._output_mode = self._detect_output_mode(self._output_shape)
            self._load_error = None

            if (
                self._output_shape
                and len(self._output_shape) >= 2
                and self._output_shape[-1] is not None
                and self._class_names
            ):
                model_classes = int(self._output_shape[-1])
                mapped_classes = len(self._class_names)
                if model_classes != mapped_classes:
                    logger.warning(
                        "[object_v1] Keras output has %d class(es) but class_names.json has %d — "
                        "indices >= %d will be ignored; verify class_names.json matches training labels",
                        model_classes,
                        mapped_classes,
                        mapped_classes,
                    )

            logger.info("[object_v1] model loaded successfully from %s", model_path)
            logger.info("[object_v1] input shape: %s", self._input_shape)
            logger.info("[object_v1] output shape: %s", self._output_shape)
            logger.info(
                "[object_v1] inference mode=%s preprocess=%s classes=%d confidence_threshold=%.2f device=%s",
                self._output_mode,
                self._preprocess_mode,
                len(self._class_names),
                self._confidence,
                "gpu" if self._use_gpu else "cpu",
            )
        except ImportError:
            self._load_error = (
                "tensorflow is not installed. Add tensorflow to ai-server/requirements.txt"
            )
            logger.warning("[object_v1] %s", self._load_error)
        except Exception as exc:  # noqa: BLE001 — surface load failures without crashing app
            self._load_error = str(exc)
            logger.exception("[object_v1] failed to load Keras model: %s", exc)

    @staticmethod
    def _resolve_output_shape(model: Any) -> tuple[int | None, ...] | None:
        output = getattr(model, "output", None)
        if output is not None and hasattr(output, "shape"):
            return tuple(output.shape)
        outputs = getattr(model, "outputs", None)
        if isinstance(outputs, list) and outputs:
            first = outputs[0]
            if hasattr(first, "shape"):
                return tuple(first.shape)
        return None

    def _configure_input_size(self) -> None:
        if not self._input_shape or len(self._input_shape) < 4:
            return
        _batch, height, width, channels = self._input_shape[:4]
        if height is not None and int(height) > 0:
            self._input_height = int(height)
        if width is not None and int(width) > 0:
            self._input_width = int(width)
        if channels == 1:
            self._normalize_divisor = 255.0

        # InceptionV3 (299×299) expects preprocess_input scaling to [-1, 1], not /255.
        if self._input_height == 299 and self._input_width == 299:
            self._preprocess_mode = "inception_v3"

    def _detect_output_mode(self, output_shape: tuple[int | None, ...] | None) -> str:
        if output_shape is None:
            return "unknown"
        if len(output_shape) == 2:
            class_dim = output_shape[-1]
            if class_dim is not None and len(self._class_names):
                if int(class_dim) == len(self._class_names):
                    return "classification"
            if class_dim is not None and int(class_dim) > 1:
                return "classification"
        if len(output_shape) == 3 and output_shape[-1] in (4, 5, 6):
            return "detection_rows"
        return "unknown"

    def _preprocess(self, image_rgb: np.ndarray) -> np.ndarray:
        """Resize RGB uint8 image to model input tensor."""
        from PIL import Image  # noqa: PLC0415

        if image_rgb.ndim != 3 or image_rgb.shape[2] != 3:
            raise ValueError("Expected RGB image array shaped (H, W, 3)")

        pil = Image.fromarray(image_rgb.astype(np.uint8), mode="RGB")
        resized = pil.resize((self._input_width, self._input_height))
        arr = np.asarray(resized, dtype=np.float32)

        if self._input_shape and len(self._input_shape) >= 4 and self._input_shape[-1] == 1:
            arr = np.mean(arr, axis=-1, keepdims=True)

        if self._preprocess_mode == "inception_v3":
            from tensorflow.keras.applications.inception_v3 import preprocess_input  # noqa: PLC0415

            arr = preprocess_input(arr)
        else:
            arr = arr / self._normalize_divisor
        return np.expand_dims(arr, axis=0)

    def predict(self, image_rgb: np.ndarray) -> list[dict[str, Any]]:
        """
        Run inference. Returns empty list if model is not ready.

        Each detection: class_id, class_name, confidence, bbox [x1,y1,x2,y2]
        """
        if not self.is_ready or self._model is None:
            return []

        img_h, img_w = image_rgb.shape[:2]
        batch = self._preprocess(image_rgb)
        raw = self._model.predict(batch, verbose=0)
        return self._postprocess(raw, img_w=img_w, img_h=img_h)

    def _postprocess(
        self,
        raw: Any,
        *,
        img_w: int,
        img_h: int,
    ) -> list[dict[str, Any]]:
        if isinstance(raw, (list, tuple)):
            if len(raw) == 1:
                raw = raw[0]
            elif len(raw) >= 2:
                return self._postprocess_detection_outputs(raw, img_w=img_w, img_h=img_h)

        array = np.asarray(raw)
        if array.ndim == 0:
            return []

        if self._output_mode == "classification" or (array.ndim == 2 and array.shape[-1] > 1):
            return self._postprocess_classification(array, img_w=img_w, img_h=img_h)

        if array.ndim == 2 and array.shape[-1] in (5, 6):
            return self._postprocess_detection_rows(array, img_w=img_w, img_h=img_h)

        if array.ndim == 3 and array.shape[-1] in (5, 6):
            return self._postprocess_detection_rows(array[0], img_w=img_w, img_h=img_h)

        logger.warning(
            "[object_v1] unsupported Keras output shape %s — returning empty detections",
            array.shape,
        )
        return []

    def _postprocess_classification(
        self,
        array: np.ndarray,
        *,
        img_w: int,
        img_h: int,
    ) -> list[dict[str, Any]]:
        probs = np.asarray(array[0], dtype=np.float32).flatten()
        if probs.size == 0:
            return []

        if probs.max() > 1.0 or probs.min() < 0.0:
            exp = np.exp(probs - probs.max())
            probs = exp / exp.sum()

        num_classes = len(self._class_names) or probs.size
        if num_classes and probs.size > num_classes:
            # Model may expose more logits than class_names.json (extra indices are ignored).
            probs = probs[:num_classes]
            if probs.sum() > 0:
                probs = probs / probs.sum()
        order = np.argsort(probs)[::-1]
        detections: list[dict[str, Any]] = []
        full_bbox = [0, 0, img_w, img_h]

        for rank, class_id in enumerate(order[: min(3, probs.size)]):
            confidence = float(probs[class_id])
            if confidence < self._confidence:
                break
            if class_id >= num_classes:
                continue
            detections.append(
                {
                    "class_id": int(class_id),
                    "class_name": self._class_names.get(int(class_id), f"class_{class_id}"),
                    "confidence": confidence,
                    "bbox": full_bbox,
                }
            )
        if not detections and order.size:
            top_id = int(order[0])
            if top_id < num_classes:
                detections.append(
                    {
                        "class_id": top_id,
                        "class_name": self._class_names.get(top_id, f"class_{top_id}"),
                        "confidence": float(probs[top_id]),
                        "bbox": full_bbox,
                    }
                )
        return detections

    def _postprocess_detection_rows(
        self,
        rows: np.ndarray,
        *,
        img_w: int,
        img_h: int,
    ) -> list[dict[str, Any]]:
        detections: list[dict[str, Any]] = []
        for row in np.asarray(rows):
            if row.size < 5:
                continue
            if row.size >= 6:
                x1, y1, x2, y2, class_id, score = row[:6]
            else:
                x1, y1, x2, y2, score = row[:5]
                class_id = 0
            confidence = float(score)
            if confidence < self._confidence:
                continue
            class_id_int = int(class_id)
            detections.append(
                {
                    "class_id": class_id_int,
                    "class_name": self._class_names.get(class_id_int, f"class_{class_id_int}"),
                    "confidence": confidence,
                    "bbox": [
                        int(max(0, min(img_w, x1))),
                        int(max(0, min(img_h, y1))),
                        int(max(0, min(img_w, x2))),
                        int(max(0, min(img_h, y2))),
                    ],
                }
            )
        return detections

    def _postprocess_detection_outputs(
        self,
        outputs: list[Any] | tuple[Any, ...],
        *,
        img_w: int,
        img_h: int,
    ) -> list[dict[str, Any]]:
        arrays = [np.asarray(item) for item in outputs]
        for arr in arrays:
            if arr.ndim >= 2 and arr.shape[-1] in (5, 6):
                flat = arr[0] if arr.ndim == 3 else arr
                parsed = self._postprocess_detection_rows(flat, img_w=img_w, img_h=img_h)
                if parsed:
                    return parsed
        logger.warning("[object_v1] could not parse multi-output Keras detection tensors")
        return []
