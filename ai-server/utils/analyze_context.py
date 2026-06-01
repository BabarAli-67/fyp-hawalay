"""
Universal analyze context for lost-and-found reporting.

Aggregates signals from any registered extractor (card OCR, object_v1, future models)
into one structure consumed by caption, features, and embeddings — without card-only logic.
"""

from __future__ import annotations

import re
from typing import Any

from core.model_ids import CARD_OCR_V1, OBJECT_V1

# Optional human labels for known OCR keys (extend when card OCR adds fields).
# Unknown keys are derived automatically from snake_case.
# card_number label is dynamic — see ``label_for_ocr_field``.
FIELD_LABEL_OVERRIDES: dict[str, str] = {
    "card_brand": "brand or bank name visible on card",
    "cardholder_name": "name printed on card",
    "expiry_date": "expiry date on card",
    "card_boundary": "card outline detected",
}

# OCR document_type values → short hints for vision models (not UI categories).
DOCUMENT_TYPE_HINTS: dict[str, str] = {
    "credit_card": "bank or payment card (debit/credit)",
    "cnic": "national identity card (CNIC/ID card)",
    "unknown": "document or text-bearing item",
}


def card_number_digits(value: str | None) -> str:
    return re.sub(r"\D", "", value or "")


def is_full_card_number(value: str | None) -> bool:
    """True when OCR returned a complete PAN-length number (13–19 digits)."""
    length = len(card_number_digits(value))
    return 13 <= length <= 19


def is_partial_card_number(value: str | None) -> bool:
    digits = card_number_digits(value)
    return 4 <= len(digits) < 13


def label_for_ocr_field(key: str, value: str | None = None) -> str:
    """UI / context label; card number wording reflects how much was read."""
    if key == "card_number":
        if is_full_card_number(value):
            return "card number"
        if value and card_number_digits(value):
            return "card number (partial)"
        return "card number"
    return FIELD_LABEL_OVERRIDES.get(key, key.replace("_", " "))


def humanize_field_key(key: str, value: str | None = None) -> str:
    """snake_case → readable label."""
    return label_for_ocr_field(key, value)


def field_value(field: Any) -> str | None:
    if field is None:
        return None
    if isinstance(field, dict):
        raw = field.get("value")
    else:
        raw = getattr(field, "value", None)
    if raw is None:
        return None
    text = str(raw).strip()
    return text or None


def field_confidence(field: Any) -> float:
    if field is None:
        return 0.0
    if isinstance(field, dict):
        return float(field.get("confidence") or 0.0)
    return float(getattr(field, "confidence", 0.0) or 0.0)


def iter_ocr_fields(ocr_payload: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Normalized OCR field rows regardless of document type."""
    if not ocr_payload:
        return []
    fields = ocr_payload.get("fields") or {}
    rows: list[dict[str, Any]] = []
    for key in sorted(fields.keys()):
        value = field_value(fields.get(key))
        if not value:
            continue
        entry = fields.get(key)
        bbox = None
        if isinstance(entry, dict):
            bbox = entry.get("bbox")
        else:
            bbox = getattr(entry, "bbox", None)
        rows.append(
            {
                "source": CARD_OCR_V1,
                "key": key,
                "label": label_for_ocr_field(key, value),
                "value": value,
                "confidence": field_confidence(entry),
                "bbox": bbox,
            }
        )
    return rows


def iter_object_detections(
    detected_objects: list[dict[str, Any]] | None,
    *,
    source: str = OBJECT_V1,
) -> list[dict[str, Any]]:
    """Normalized object detector rows (object_v1 or future models)."""
    rows: list[dict[str, Any]] = []
    for obj in detected_objects or []:
        if not isinstance(obj, dict):
            continue
        class_name = str(obj.get("class_name") or obj.get("className") or "").strip()
        if not class_name:
            continue
        rows.append(
            {
                "source": source,
                "key": class_name,
                "label": class_name.replace("_", " "),
                "value": None,
                "confidence": float(obj.get("confidence") or 0.0),
                "bbox": obj.get("bbox"),
            }
        )
    return rows


def build_extracted_attributes(
    *,
    ocr_payload: dict[str, Any] | None = None,
    detected_objects: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """
    Unified attribute list for API consumers and Gemini context.

    New models only need to contribute rows here (or via OCR fields / detected_objects).
    """
    return iter_ocr_fields(ocr_payload) + iter_object_detections(detected_objects)


def build_analyze_context(
    *,
    category: str = "",
    location: str = "",
    title: str = "",
    user_description: str = "",
    ocr_payload: dict[str, Any] | None = None,
    detected_objects: list[dict[str, Any]] | None = None,
    detected_object_names: list[str] | None = None,
) -> str:
    """Text block passed to Gemini caption + features (model-agnostic)."""
    lines: list[str] = []

    if category.strip():
        lines.append(f"Reporter selected category: {category.strip()}")
    if title.strip():
        lines.append(f"Reporter title: {title.strip()}")
    if location.strip():
        lines.append(f"Location context: {location.strip()}")
    if user_description.strip():
        lines.append(f"Reporter notes: {user_description.strip()}")

    if ocr_payload:
        doc_type = str(ocr_payload.get("document_type") or "unknown").strip().lower()
        doc_hint = DOCUMENT_TYPE_HINTS.get(doc_type, doc_type.replace("_", " "))
        if doc_hint:
            lines.append(f"Automated document hint: {doc_hint}")

        ocr_rows = iter_ocr_fields(ocr_payload)
        if ocr_rows:
            lines.append("Automated text extraction from image:")
            for row in ocr_rows:
                lines.append(f"  • {row['label']}: {row['value']}")

    names = detected_object_names or [
        str(o.get("class_name") or o.get("className") or "")
        for o in (detected_objects or [])
        if isinstance(o, dict)
    ]
    names = [n.replace("_", " ") for n in names if n][:12]
    if names:
        lines.append(f"Object detector labels: {', '.join(names)}")

    obj_rows = iter_object_detections(detected_objects)
    high_conf = [r for r in obj_rows if r["confidence"] >= 0.5]
    if high_conf and not names:
        lines.append(
            "Detected object classes: "
            + ", ".join(r["label"] for r in high_conf[:8])
        )

    return "\n".join(lines).strip()


def build_ocr_fallback_bullets(ocr_payload: dict[str, Any] | None) -> list[str]:
    """Generic OCR → feature bullets (any field keys)."""
    bullets: list[str] = []
    seen: set[str] = set()

    def add(line: str) -> None:
        key = line.strip().lower()
        if not key or key in seen or len(line.strip()) < 4:
            return
        seen.add(key)
        bullets.append(line.strip())

    if ocr_payload:
        doc_type = str(ocr_payload.get("document_type") or "unknown").strip().lower()
        doc_hint = DOCUMENT_TYPE_HINTS.get(doc_type)
        if doc_hint:
            add(f"{doc_hint.capitalize()} identified in image")

        for row in iter_ocr_fields(ocr_payload):
            label = row["label"]
            value = row["value"]
            key = row["key"]
            if key == "card_number" and value:
                if is_full_card_number(value):
                    add("Card number fully visible in image")
                else:
                    add("Card number partially visible in image")
            elif value:
                add(f"{label.capitalize()}: {value}")

    return bullets


def build_object_fallback_bullets(detected_objects: list[dict[str, Any]] | None) -> list[str]:
    """Generic object detector → feature bullets."""
    bullets: list[str] = []
    seen: set[str] = set()

    for row in iter_object_detections(detected_objects):
        label = row["label"]
        key = label.lower()
        if key in seen:
            continue
        seen.add(key)
        conf = row["confidence"]
        if conf >= 0.5:
            bullets.append(f"{label.capitalize()} detected in image")
        else:
            bullets.append(f"Possible {label} visible in image")

    return bullets
