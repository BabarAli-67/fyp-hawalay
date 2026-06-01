"""Load detector class names and optional category mapping from config files."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def load_json_file(path: Path | None) -> dict[str, Any] | list[Any] | None:
    if path is None or not path.is_file():
        return None
    try:
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Could not load JSON from %s: %s", path, exc)
        return None


def load_class_names(path: Path | None) -> dict[int, str]:
    """
    Load ``{ "0": "laptop", ... }`` or ``["laptop", ...]`` into id → name map.
    Returns empty dict when file is missing (weights not deployed yet).
    """
    raw = load_json_file(path)
    if raw is None:
        return {}
    if isinstance(raw, list):
        return {idx: str(name) for idx, name in enumerate(raw)}
    if isinstance(raw, dict):
        out: dict[int, str] = {}
        for key, value in raw.items():
            try:
                out[int(key)] = str(value)
            except (TypeError, ValueError):
                continue
        return out
    return {}


def load_category_mapping(path: Path | None) -> dict[str, str]:
    """
    Load detector class name → report category label (e.g. laptop → Electronics).
    Empty until ``object_category_map.json`` is populated for the trained model.
    """
    raw = load_json_file(path)
    if not isinstance(raw, dict):
        return {}
    return {str(k): str(v) for k, v in raw.items() if v}
