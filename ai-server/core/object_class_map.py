"""Load detector class names and optional category mapping from config files."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

__all__ = [
    "load_json_file",
    "normalize_class_name_list",
    "load_class_names",
    "load_class_name_list",
    "load_category_mapping",
]


def load_json_file(path: Path | None) -> dict[str, Any] | list[Any] | None:
    if path is None or not path.is_file():
        return None
    try:
        with path.open(encoding="utf-8-sig") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Could not load JSON from %s: %s", path, exc)
        return None


def normalize_class_name_list(raw: Any) -> list[str]:
    """Ordered class labels from JSON list or id→name dict."""
    if isinstance(raw, list):
        return [str(name).strip() for name in raw if str(name).strip()]
    if isinstance(raw, dict):
        ordered: list[tuple[int, str]] = []
        for key, value in raw.items():
            try:
                ordered.append((int(key), str(value).strip()))
            except (TypeError, ValueError):
                continue
        ordered.sort(key=lambda pair: pair[0])
        return [name for _, name in ordered if name]
    return []


def load_class_names(path: Path | None) -> dict[int, str]:
    """
    Load ``{ "0": "laptop", ... }`` or ``["laptop", ...]`` into id → name map.
    Returns empty dict when file is missing or invalid.
    """
    raw = load_json_file(path)
    names = normalize_class_name_list(raw)
    if not names:
        return {}
    if isinstance(raw, list):
        return {idx: name for idx, name in enumerate(names)}
    if isinstance(raw, dict):
        out: dict[int, str] = {}
        for key, value in raw.items():
            try:
                out[int(key)] = str(value).strip()
            except (TypeError, ValueError):
                continue
        return out
    return {}


def load_class_name_list(path: Path | None) -> list[str]:
    """Ordered class labels from ``class_names.json`` (list or id→name dict)."""
    id_map = load_class_names(path)
    if not id_map:
        return []
    return [id_map[class_id] for class_id in sorted(id_map.keys())]


def load_category_mapping(path: Path | None) -> dict[str, str]:
    """
    Load detector class name → report category label (e.g. laptop → Electronics).
    Reads ``category_map.json`` — single source of truth for mappings.
    """
    raw = load_json_file(path)
    if not isinstance(raw, dict):
        return {}
    return {str(k): str(v) for k, v in raw.items() if v}
