"""
Map detector class names to report categories via category_map.json.

``category_map.json`` is the single source of truth (see object_class_map loader).
"""

from __future__ import annotations

from typing import Any

from core.object_class_map import load_category_mapping
from core.object_model_validation import REPORT_CATEGORIES


def suggest_category_from_detections(
    detected_objects: list[dict[str, Any]],
    category_map: dict[str, str],
) -> str | None:
    """
  Return a report category suggestion from the highest-confidence detection.

  Returns ``None`` when mapping is empty or no detections (no suggestion yet).
    """
    if not category_map or not detected_objects:
        return None

    best = max(detected_objects, key=lambda d: float(d.get("confidence") or 0.0), default=None)
    if not best:
        return None

    class_name = str(best.get("class_name") or "").strip()
    if not class_name:
        return None

    suggested = category_map.get(class_name)
    if suggested in REPORT_CATEGORIES:
        return suggested
    return None


def load_category_map_from_settings(settings: Any) -> dict[str, str]:
    path = settings.resolved_object_category_map()
    return load_category_mapping(path)
