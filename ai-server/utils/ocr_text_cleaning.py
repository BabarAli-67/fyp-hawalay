"""
Field-specific OCR text normalization and confidence helpers.
"""

from __future__ import annotations

import re
from typing import Any

# Known card field classes from YOLO training schema
OCR_FIELD_CLASSES = frozenset(
    {
        "card_boundary",
        "card_brand",
        "card_number",
        "cardholder_name",
        "expiry_date",
    }
)

TEXT_FIELD_CLASSES = frozenset(
    {
        "card_brand",
        "card_number",
        "cardholder_name",
        "expiry_date",
    }
)


def normalize_card_number(text: str) -> str:
    """Digits only, grouped as XXXX XXXX XXXX XXXX when length >= 13."""
    digits = re.sub(r"\D", "", text)
    if len(digits) > 19:
        digits = digits[:19]
    if len(digits) >= 13:
        return " ".join(digits[i : i + 4] for i in range(0, len(digits), 4))
    return digits


def normalize_expiry_date(text: str) -> str:
    """Format as MM/YY from common OCR patterns."""
    text = text.strip()
    match = re.search(r"(\d{2})[/\-](\d{2,4})", text)
    if match:
        month, year = match.group(1), match.group(2)
        if len(year) == 4:
            year = year[2:]
        return f"{month}/{year}"

    digits = re.sub(r"\D", "", text)
    if len(digits) >= 4:
        digits = digits[-4:]
        return f"{digits[:2]}/{digits[2:]}"
    return re.sub(r"[^\d/\-]", "", text).strip()


def normalize_name(text: str) -> str:
    """Letters and spaces only, uppercased."""
    cleaned = re.sub(r"[^A-Za-z\s]", " ", text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned.upper()


def normalize_brand(text: str) -> str:
    """Brand label — alpha tokens, uppercased."""
    return normalize_name(text)


def clean_text(text: str, class_name: str) -> str:
    """
    Class-specific cleanup (regex + normalization rules per field type).
    """
    text = (text or "").strip()
    if not text:
        return ""

    if class_name == "card_number":
        return normalize_card_number(text)

    if class_name == "expiry_date":
        return normalize_expiry_date(text)

    if class_name == "cardholder_name":
        return normalize_name(text)

    if class_name == "card_brand":
        return normalize_brand(text)

    # Generic: strip control chars, collapse whitespace
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s\-/]", " ", text)).strip()


def combine_field_confidence(
    detection_confidence: float | None,
    ocr_confidence: float | None,
    *,
    has_text: bool,
) -> float:
    """
    Weighted blend of YOLO detection score and EasyOCR recognition score.

    Returns 0.0 when no text was extracted.
    """
    if not has_text:
        return 0.0

    det = float(detection_confidence or 0.0)
    ocr = float(ocr_confidence or 0.0)

    if det > 0 and ocr > 0:
        return round(0.45 * det + 0.55 * ocr, 3)
    if ocr > 0:
        return round(ocr, 3)
    if det > 0:
        return round(det * 0.5, 3)
    return 0.0


def compute_overall_confidence(fields: dict[str, dict[str, Any]]) -> float:
    """Mean combined confidence across text fields that have a non-empty value."""
    scores = [
        float(f.get("confidence", 0.0))
        for f in fields.values()
        if f.get("value")
    ]
    if not scores:
        return 0.0
    return round(sum(scores) / len(scores), 3)
