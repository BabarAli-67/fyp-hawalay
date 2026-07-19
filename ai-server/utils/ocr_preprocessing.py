"""
OCR-oriented image preprocessing (grayscale → CLAHE → denoise → threshold → sharpen).

Used before EasyOCR on YOLO crops and full-image fallback paths.
"""

from __future__ import annotations

import logging

import numpy as np

logger = logging.getLogger(__name__)

_MIN_CROP_HEIGHT = 50
_CLAHE_CLIP = 2.0
_CLAHE_TILE = (8, 8)


def _require_cv2():
    try:
        import cv2  # noqa: PLC0415

        return cv2
    except ImportError as exc:
        raise RuntimeError(
            "opencv-python-headless is required for OCR preprocessing. "
            "Install with: pip install opencv-python-headless"
        ) from exc


def _fallback_grayscale(crop_bgr: np.ndarray) -> np.ndarray:
    if crop_bgr.ndim == 2:
        return crop_bgr.astype(np.uint8)
    if crop_bgr.ndim == 3:
        return crop_bgr.mean(axis=2).astype(np.uint8)
    return crop_bgr.astype(np.uint8)


def preprocess_for_easyocr(
    crop_bgr: np.ndarray,
    *,
    apply_threshold: bool = False,
) -> tuple[np.ndarray, float]:
    """
    Full preprocessing chain for EasyOCR input.

    Pipeline:
      1. Grayscale
      2. CLAHE contrast enhancement
      3. Non-local means denoising
      4. Optional adaptive threshold (for faint embossed text)
      5. Unsharp mask sharpening
      6. Upscale small crops

    Args:
        crop_bgr: BGR or grayscale crop (views OK — no full-image copy).
        apply_threshold: Use adaptive threshold when contrast is very low.

    Returns:
        ``(processed_image, scale)`` where ``scale`` is the upscale factor applied
        to short crops (1.0 when no upscale). EasyOCR boxes must be divided by
        ``scale`` before mapping back to the original crop / full image.
    """
    if crop_bgr.size == 0:
        return crop_bgr, 1.0

    try:
        cv2 = _require_cv2()
    except RuntimeError as exc:
        logger.warning("[ocr-preprocess] %s — using fallback grayscale", exc)
        return _fallback_grayscale(crop_bgr), 1.0

    if crop_bgr.ndim == 3:
        gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
    else:
        gray = crop_bgr.astype(np.uint8)

    clahe = cv2.createCLAHE(clipLimit=_CLAHE_CLIP, tileGridSize=_CLAHE_TILE)
    enhanced = clahe.apply(gray)

    denoised = cv2.fastNlMeansDenoising(enhanced, h=10, templateWindowSize=7, searchWindowSize=21)

    if apply_threshold or float(denoised.std()) < 25.0:
        denoised = cv2.adaptiveThreshold(
            denoised,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            11,
            2,
        )

    sharpened = _unsharp_mask(denoised, cv2)

    height, width = sharpened.shape[:2]
    scale = 1.0
    if height < _MIN_CROP_HEIGHT:
        scale = _MIN_CROP_HEIGHT / max(height, 1)
        sharpened = cv2.resize(
            sharpened,
            (int(width * scale), int(height * scale)),
            interpolation=cv2.INTER_CUBIC,
        )

    return sharpened, float(scale)


def _unsharp_mask(gray: np.ndarray, cv2, *, amount: float = 1.2, sigma: float = 1.0) -> np.ndarray:
    """Light sharpening — improves small embossed card text."""
    blurred = cv2.GaussianBlur(gray, (0, 0), sigma)
    sharpened = cv2.addWeighted(gray, 1.0 + amount, blurred, -amount, 0)
    return np.clip(sharpened, 0, 255).astype(np.uint8)


def preprocess_full_image_for_ocr(image_bgr: np.ndarray) -> np.ndarray:
    """Preprocess a full document image for degraded (no-YOLO) OCR fallback."""
    processed, _scale = preprocess_for_easyocr(image_bgr, apply_threshold=False)
    return processed
