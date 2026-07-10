"""Map EasyOCR crop-local boxes to full-image [x1, y1, x2, y2] coordinates."""

from __future__ import annotations

from typing import Any


def quad_to_bbox(quad: list[list[float]], *, offset_x: int = 0, offset_y: int = 0) -> list[int]:
    """Convert EasyOCR quadrilateral to axis-aligned integer bbox in image space."""
    xs = [float(point[0]) for point in quad]
    ys = [float(point[1]) for point in quad]
    return [
        int(min(xs)) + offset_x,
        int(min(ys)) + offset_y,
        int(max(xs)) + offset_x,
        int(max(ys)) + offset_y,
    ]


def readtext_boxes_to_image_space(
    readtext_results: list[Any],
    *,
    offset_x: int,
    offset_y: int,
) -> list[dict[str, Any]]:
    """Normalize EasyOCR detail=1 rows into text + bbox + confidence."""
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
                "bbox": quad_to_bbox(quad, offset_x=offset_x, offset_y=offset_y),
                "confidence": round(max(0.0, min(conf, 1.0)), 3),
            }
        )
    return boxes
