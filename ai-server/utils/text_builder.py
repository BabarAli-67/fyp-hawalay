"""Post-processing and Hawalay-facing text builders."""

from __future__ import annotations

import re
from typing import Any

from utils.ocr_text_cleaning import clean_text  # re-export for backward compatibility
from utils.sensitive_regions import detections_contain_cnic_signal, text_matches_cnic

_IDENTITY_DOC_KEYWORDS = re.compile(
    r"\b(?:cnic|nadra|national\s+id(?:entity)?(?:\s+card)?|identity\s+card|"
    r"pakistan\s+national|government\s+of\s+pakistan)\b",
    re.IGNORECASE,
)
_PAYMENT_NETWORK_KEYWORDS = re.compile(
    r"\b(?:visa|mastercard|master\s*card|american\s+express|amex|union\s?pay|"
    r"debit\s+card|credit\s+card|valid\s+thru|cvv|cvc)\b",
    re.IGNORECASE,
)


def merge_detection_results(
    raw_detections: list[dict[str, Any]],
    ocr_by_class: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Build API response detections map (highest detection confidence per class)."""
    output: dict[str, Any] = {}
    for det in raw_detections:
        class_name = det["class_name"]
        entry = {
            "text": ocr_by_class.get(class_name, {}).get("text"),
            "detection_confidence": round(float(det["confidence"]), 3),
            "ocr_confidence": ocr_by_class.get(class_name, {}).get("ocr_confidence"),
            "bbox": det["bbox"],
            "text_boxes": ocr_by_class.get(class_name, {}).get("text_boxes") or [],
        }
        existing = output.get(class_name)
        if existing is None or entry["detection_confidence"] > existing["detection_confidence"]:
            output[class_name] = entry
    return output


def build_ocr_text_summary(detections: dict[str, Any]) -> str:
    """Flatten structured detections into a single string for MongoDB ocrText."""
    parts: list[str] = []
    for class_name, data in detections.items():
        text = data.get("text")
        if text:
            label = class_name.replace("_", " ").title()
            parts.append(f"{label}: {text}")
    return "\n".join(parts)


def _is_present(value: str | None) -> bool:
    """True when value is non-empty and not the literal string ``none``."""
    if value is None:
        return False
    stripped = str(value).strip()
    return bool(stripped) and stripped.lower() != "none"


MAX_ENRICHED_TEXT_LEN = 1000


def build_enriched_text(
    category: str | None,
    location: str | None,
    caption: str | None,
    ocr_text: str | None,
    title: str = "",
    description: str = "",
    *,
    brand: str = "",
    colors: list[str] | None = None,
    distinctive_features: str = "",
    feature_points: list[str] | None = None,
) -> str:
    """
    Build a single embedding-ready string from report metadata and AI signals.

    Used for matching fingerprints — supports image-based and manual-only reports.
    Manual description and AI caption can both appear (helps lost vs found wording).

    Omits empty fields and never emits the literal word ``None``.
    Truncates long user text fields when the combined string exceeds 1000 characters.
    """
    colors_value = ", ".join(
        str(c).strip() for c in (colors or []) if c is not None and str(c).strip()
    ) or None
    features_line = None
    if feature_points:
        cleaned = [str(p).strip().lstrip("•").strip() for p in feature_points if p and str(p).strip()]
        if cleaned:
            features_line = "; ".join(cleaned)

    field_specs: list[tuple[str, str | None]] = [
        ("Category", category),
        ("Location", location),
        ("Title", title),
        ("Brand", brand),
        ("Colors", colors_value),
        ("Description", description),
        ("Distinctive features", distinctive_features),
        ("Caption", caption),
        ("Keywords", ocr_text),
        ("Features", features_line),
    ]
    parts: list[str] = []
    for label, value in field_specs:
        if _is_present(value):
            parts.append(f"{label}: {str(value).strip()}")

    if not parts:
        return ""

    joined = ". ".join(parts)
    if len(joined) <= MAX_ENRICHED_TEXT_LEN:
        return joined

    truncatable_prefixes = ("Description: ", "Distinctive features: ", "Features: ")
    for prefix in truncatable_prefixes:
        idx = next((i for i, part in enumerate(parts) if part.startswith(prefix)), None)
        if idx is None:
            continue
        before = ". ".join(parts[:idx])
        after_parts = parts[idx + 1 :]
        after = (". " + ". ".join(after_parts)) if after_parts else ""
        sep = ". " if before else ""
        fixed_len = len(before) + len(sep) + len(prefix) + len(after)
        max_body = MAX_ENRICHED_TEXT_LEN - fixed_len
        if max_body <= 0:
            parts = parts[:idx] + parts[idx + 1 :]
            joined = ". ".join(parts)
            if len(joined) <= MAX_ENRICHED_TEXT_LEN:
                return joined
            continue
        body = parts[idx][len(prefix) :]
        parts[idx] = prefix + body[:max_body].rstrip()
        joined = ". ".join(parts)
        if len(joined) <= MAX_ENRICHED_TEXT_LEN:
            return joined

    return joined[:MAX_ENRICHED_TEXT_LEN]


def _detection_field_text(detections: dict[str, Any], class_name: str) -> str:
    data = detections.get(class_name)
    if not isinstance(data, dict):
        return ""
    return str(data.get("text") or "").strip()


def _detections_haystack(detections: dict[str, Any]) -> str:
    parts: list[str] = []
    for data in detections.values():
        if not isinstance(data, dict):
            continue
        text = str(data.get("text") or "").strip()
        if text:
            parts.append(text)
        for box in data.get("text_boxes") or []:
            if isinstance(box, dict):
                box_text = str(box.get("text") or "").strip()
                if box_text:
                    parts.append(box_text)
    return " ".join(parts)


def resolve_document_type(document_type: str, detections: dict[str, Any]) -> str:
    """
    Resolve ``auto`` to a concrete document type from YOLO/OCR field presence.

    CNIC numbers share the ``card_number`` detection class with payment cards, so
    identity signals must win before falling back to ``credit_card``.
    """
    normalized = (document_type or "auto").strip().lower()
    if normalized in ("credit_card", "cnic"):
        return normalized
    if normalized in ("id", "id_card", "national_id"):
        return "cnic"

    if detections_contain_cnic_signal(detections):
        return "cnic"

    haystack = _detections_haystack(detections)
    if text_matches_cnic(haystack) or _IDENTITY_DOC_KEYWORDS.search(haystack):
        return "cnic"

    number_text = _detection_field_text(detections, "card_number")
    brand_text = _detection_field_text(detections, "card_brand")
    expiry_text = _detection_field_text(detections, "expiry_date")
    payment_haystack = " ".join([number_text, brand_text, expiry_text, haystack])

    if _PAYMENT_NETWORK_KEYWORDS.search(payment_haystack):
        return "credit_card"
    if expiry_text and not text_matches_cnic(number_text):
        return "credit_card"
    if number_text and not text_matches_cnic(number_text):
        digits = re.sub(r"\D", "", number_text)
        # 13 digits → CNIC; 14–19 → typical payment PAN length.
        if len(digits) == 13:
            return "cnic"
        if 14 <= len(digits) <= 19:
            return "credit_card"

    # Card-shaped boundary alone is ambiguous (CNIC vs payment) — leave unknown
    # so caption/sensitivity can classify from vision text.
    return "unknown"


def detections_to_list(detections: dict[str, Any]) -> list[dict[str, Any]]:
    """Convert detections map to a stable list for API consumers."""
    items: list[dict[str, Any]] = []
    for class_name in sorted(detections.keys()):
        data = detections[class_name]
        items.append(
            {
                "class_name": class_name,
                "text": data.get("text"),
                "detection_confidence": data.get("detection_confidence"),
                "ocr_confidence": data.get("ocr_confidence"),
                "bbox": data.get("bbox"),
            }
        )
    return items


def build_structured_ocr_payload(
    detections: dict[str, Any],
    *,
    document_type: str = "auto",
) -> dict[str, Any]:
    """
    Flatten detection map into top-level fields plus a ``detections`` list.

    Example shape::

        {
          "document_type": "credit_card",
          "card_number": "...",
          "cardholder_name": "...",
          "expiry_date": "...",
          "card_brand": "...",
          "detections": [...]
        }
    """

    def field_text(class_name: str) -> str | None:
        text = detections.get(class_name, {}).get("text")
        return text if text else None

    resolved_type = resolve_document_type(document_type, detections)
    return {
        "document_type": resolved_type,
        "card_brand": field_text("card_brand"),
        "card_number": field_text("card_number"),
        "cardholder_name": field_text("cardholder_name"),
        "expiry_date": field_text("expiry_date"),
        "detections": detections_to_list(detections),
    }


def build_suggested_fields(
    detections: dict[str, Any],
    *,
    document_type: str | None = None,
) -> dict[str, str | None]:
    """Hints for MERN report form autofill (structured fields only — not full descriptions)."""
    name = detections.get("cardholder_name", {}).get("text")
    number = detections.get("card_number", {}).get("text")
    brand = detections.get("card_brand", {}).get("text")
    expiry = detections.get("expiry_date", {}).get("text")

    doc = (document_type or "").strip().lower()
    if doc in ("cnic", "national_id", "id_card", "id"):
        suggested_title = "CNIC / ID Card"
    else:
        suggested_title = brand or name

    distinctive_parts = [p for p in [brand, number, expiry] if p]
    return {
        "suggested_title": suggested_title,
        "suggested_description": None,
        "suggested_distinctive_features": " | ".join(distinctive_parts) if distinctive_parts else None,
    }
