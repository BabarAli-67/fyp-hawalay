"""
Validate object_v1 artifact bundle at startup (plug-and-play model swap).

Artifacts (single source of truth):
  - class_names.json  — model class labels
  - category_map.json — class name → report category
  - weights/best.pt   — YOLO weights (path from OBJECT_MODEL_PATH)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

from core.object_class_map import load_category_mapping, load_class_names, normalize_class_name_list

logger = logging.getLogger(__name__)

# Must stay in sync with server/models/Item.js and server/utils/categoryMapping.js
REPORT_CATEGORIES: tuple[str, ...] = (
    "Electronics",
    "Clothing",
    "Documents",
    "Accessories",
    "Other",
)


@dataclass
class ObjectModelValidationReport:
    ready: bool = False
    class_count: int = 0
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def log(self) -> None:
        for message in self.errors:
            logger.error("[object_v1] %s", message)
        for message in self.warnings:
            logger.warning("[object_v1] %s", message)
        if self.ready:
            logger.info(
                "[object_v1] artifact bundle valid — %d class(es), category_map complete",
                self.class_count,
            )
        elif not self.errors and not self.warnings:
            logger.info(
                "[object_v1] not deployed — add best.pt, class_names.json, and category_map.json "
                "then restart (no code changes required)",
            )


def validate_object_model_artifacts(
    *,
    weights_path: Path | None,
    class_names_path: Path | None,
    category_map_path: Path | None,
) -> ObjectModelValidationReport:
    """
    Validate object detector artifacts.

    When weights are present, class_names.json and category_map.json must exist and
    category_map must cover every class with a valid report category.
    """
    report = ObjectModelValidationReport()
    weights_exists = bool(weights_path and weights_path.is_file())
    class_names_exists = bool(class_names_path and class_names_path.is_file())
    category_map_exists = bool(category_map_path and category_map_path.is_file())

    if not weights_exists:
        if class_names_exists or category_map_exists:
            report.warnings.append(
                f"weights missing at {weights_path} but JSON artifact(s) present — "
                "object detector will stay unavailable until best.pt is added",
            )
        return report

    if not class_names_exists:
        report.errors.append(
            f"class_names.json missing at {class_names_path} — required when {weights_path.name} is present",
        )
        return report

    if not category_map_exists:
        report.errors.append(
            f"category_map.json missing at {category_map_path} — required when {weights_path.name} is present",
        )
        return report

    raw_names = _load_raw_json(class_names_path)
    if raw_names is None:
        report.errors.append(f"class_names.json is invalid or unreadable: {class_names_path}")
        return report

    class_names = normalize_class_name_list(raw_names)
    if not class_names:
        report.errors.append(f"class_names.json contains no valid classes: {class_names_path}")
        return report

    if len(set(class_names)) != len(class_names):
        report.errors.append(f"class_names.json contains duplicate class names: {class_names_path}")
        return report

    id_map = load_class_names(class_names_path)
    if len(id_map) != len(class_names):
        report.warnings.append(
            f"class_names.json parsed {len(id_map)} id(s) from {len(class_names)} name(s) — "
            "check numeric keys if using object format",
        )

    category_map = load_category_mapping(category_map_path)
    if not category_map:
        report.errors.append(f"category_map.json is empty or invalid: {category_map_path}")
        return report

    missing_mappings = [name for name in class_names if name not in category_map]
    if missing_mappings:
        preview = ", ".join(missing_mappings[:8])
        suffix = "…" if len(missing_mappings) > 8 else ""
        report.errors.append(
            f"category_map.json missing {len(missing_mappings)} class(es): {preview}{suffix}",
        )

    invalid_categories = {
        name: cat
        for name, cat in category_map.items()
        if cat not in REPORT_CATEGORIES
    }
    if invalid_categories:
        sample = next(iter(invalid_categories.items()))
        report.errors.append(
            f"category_map.json has invalid report category for '{sample[0]}': '{sample[1]}' "
            f"(allowed: {', '.join(REPORT_CATEGORIES)})",
        )

    extra_keys = sorted(set(category_map.keys()) - set(class_names))
    if extra_keys:
        preview = ", ".join(extra_keys[:8])
        suffix = "…" if len(extra_keys) > 8 else ""
        report.warnings.append(
            f"category_map.json has {len(extra_keys)} extra key(s) not in class_names.json: {preview}{suffix}",
        )

    if report.errors:
        return report

    report.ready = True
    report.class_count = len(class_names)
    return report


def _load_raw_json(path: Path | None):
    if path is None or not path.is_file():
        return None
    try:
        import json

        with path.open(encoding="utf-8-sig") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None
