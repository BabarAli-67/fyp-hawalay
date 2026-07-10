"""Image loading, resizing, and conversion helpers for AI modules."""

from __future__ import annotations

import io

import numpy as np
from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError

ALLOWED_CONTENT_TYPES = frozenset({"image/jpeg", "image/png", "image/jpg"})
MAX_IMAGE_BYTES = 5 * 1024 * 1024

try:
    _RESAMPLE_LANCZOS = Image.Resampling.LANCZOS
except AttributeError:
    _RESAMPLE_LANCZOS = Image.LANCZOS  # Pillow < 10


def decode_image(raw_bytes: bytes) -> Image.Image:
    """
    Decode raw upload bytes into an RGB PIL image.

    Args:
        raw_bytes: File contents from multipart upload or storage.

    Returns:
        PIL Image in RGB mode.

    Raises:
        HTTPException: 422 if the file is missing, empty, or not a valid image.
    """
    if not raw_bytes:
        raise HTTPException(status_code=422, detail="Empty image file")

    try:
        image = Image.open(io.BytesIO(raw_bytes))
        image.load()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(
            status_code=422,
            detail="Invalid or corrupt image file",
        ) from exc

    return image.convert("RGB")


def resize_image(img: Image.Image, max_size: int = 1024) -> Image.Image:
    """
    Resize preserving aspect ratio when the longest edge exceeds max_size.

    Args:
        img: Source PIL image.
        max_size: Maximum width or height in pixels.

    Returns:
        Original image if already within bounds, otherwise a resized copy.
    """
    width, height = img.size
    longest = max(width, height)

    if longest <= max_size:
        return img

    scale = max_size / longest
    new_size = (int(width * scale), int(height * scale))
    return img.resize(new_size, _RESAMPLE_LANCZOS)


def image_to_bytes(img: Image.Image, format: str = "JPEG") -> bytes:
    """
    Serialize a PIL image to bytes (e.g. for GridFS or HTTP responses).

    Args:
        img: PIL image (RGB recommended for JPEG).
        format: PIL format name, e.g. ``JPEG`` or ``PNG``.

    Returns:
        Encoded image bytes.
    """
    buffer = io.BytesIO()
    save_kwargs: dict = {}
    if format.upper() in ("JPEG", "JPG"):
        save_kwargs["quality"] = 90
        if img.mode != "RGB":
            img = img.convert("RGB")
    img.save(buffer, format=format, **save_kwargs)
    return buffer.getvalue()


def image_to_numpy(img: Image.Image) -> np.ndarray:
    """
    Convert a PIL image to an RGB numpy array (H, W, 3), dtype uint8.

    Args:
        img: PIL image.

    Returns:
        Numpy array in row-major RGB order.
    """
    if img.mode != "RGB":
        img = img.convert("RGB")
    return np.array(img, dtype=np.uint8)


def validate_image_upload(content_type: str | None, size: int) -> None:
    """
    Validate upload metadata before decode (size and MIME type).

    Raises:
        ValueError: With a message suitable for HTTP 400 responses.
    """
    if size <= 0:
        raise ValueError("Empty image file")
    if size > MAX_IMAGE_BYTES:
        raise ValueError(f"Image exceeds maximum size of {MAX_IMAGE_BYTES // (1024 * 1024)}MB")
    if content_type and content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise ValueError("Only JPEG and PNG images are allowed")


def pil_to_bgr_numpy(image: Image.Image) -> np.ndarray:
    """
    Convert PIL RGB to BGR numpy (OpenCV convention) when cv2 is available.

    Args:
        image: PIL image in RGB mode.

    Returns:
        BGR uint8 array shaped (H, W, 3).
    """
    rgb = image_to_numpy(image)
    try:
        import cv2  # noqa: PLC0415

        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    except ImportError:
        return rgb[:, :, ::-1].copy()


def crop_bounds_with_padding(
    bbox: list[int],
    image_shape: tuple[int, ...],
    *,
    pad: int = 5,
) -> tuple[int, int, int, int]:
    """Return ``(crop_x1, crop_y1, crop_x2, crop_y2)`` with padding clamped to image bounds."""
    x1, y1, x2, y2 = bbox
    h, w = image_shape[:2]
    crop_x1 = max(0, x1 - pad)
    crop_y1 = max(0, y1 - pad)
    crop_x2 = min(w, x2 + pad)
    crop_y2 = min(h, y2 + pad)
    return crop_x1, crop_y1, crop_x2, crop_y2


def crop_with_padding(
    image_bgr: np.ndarray,
    bbox: list[int],
    *,
    pad: int = 5,
) -> np.ndarray:
    """
    Crop a region from a BGR image with optional pixel padding clamped to bounds.

    Args:
        image_bgr: Source image as numpy BGR.
        bbox: ``[x1, y1, x2, y2]`` pixel coordinates.
        pad: Padding applied on each side.

    Returns:
        Cropped BGR numpy array.
    """
    crop_x1, crop_y1, crop_x2, crop_y2 = crop_bounds_with_padding(
        bbox,
        image_bgr.shape,
        pad=pad,
    )
    return image_bgr[crop_y1:crop_y2, crop_x1:crop_x2]


def preprocess_crop_for_ocr(crop_bgr: np.ndarray) -> np.ndarray:
    """
    Grayscale + CLAHE + denoise + sharpen for OCR (delegates to ``ocr_preprocessing``).

    Args:
        crop_bgr: Cropped BGR region.

    Returns:
        Single-channel numpy array ready for EasyOCR.
    """
    from utils.ocr_preprocessing import preprocess_for_easyocr  # noqa: PLC0415

    return preprocess_for_easyocr(crop_bgr)
