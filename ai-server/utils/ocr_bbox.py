"""Map EasyOCR crop-local boxes to full-image [x1, y1, x2, y2] coordinates."""

from __future__ import annotations

from typing import Any


def quad_to_bbox(
    quad: list[list[float]],
    *,
    offset_x: int = 0,
    offset_y: int = 0,
    scale: float = 1.0,
) -> list[int]:
    """Convert EasyOCR quadrilateral to axis-aligned integer bbox in image space."""
    xs = [float(point[0]) for point in quad]
    ys = [float(point[1]) for point in quad]
    inv_scale = 1.0 / scale if scale and scale > 0 else 1.0
    return [
        int(round(min(xs) * inv_scale)) + offset_x,
        int(round(min(ys) * inv_scale)) + offset_y,
        int(round(max(xs) * inv_scale)) + offset_x,
        int(round(max(ys) * inv_scale)) + offset_y,
    ]


def readtext_boxes_to_image_space(
    readtext_results: list[Any],
    *,
    offset_x: int,
    offset_y: int,
    scale: float = 1.0,
) -> list[dict[str, Any]]:
    """Normalize EasyOCR detail=1 rows into text + bbox + confidence.

    ``scale`` is the preprocess upscale factor (short crops). Boxes from EasyOCR
    are in the upscaled crop space and must be divided back before applying
    ``offset_x`` / ``offset_y``.
    """
    boxes: list[dict[str, Any]] = []
    for row in readtext_results:
        if not row or len(row) < 3:
            continue
        quad, text, confidence = row[0], row[1], row[2]
        cleaned = str(text or "").strip()
        if not cleaned:
            continue
        try:
            conf = float(confidence)
        except (TypeError, ValueError):
            conf = 0.0
        boxes.append(
            {
                "text": cleaned,
                "bbox": quad_to_bbox(quad, offset_x=offset_x, offset_y=offset_y, scale=scale),
                "confidence": round(max(0.0, min(conf, 1.0)), 3),
            }
        )
    return boxes
