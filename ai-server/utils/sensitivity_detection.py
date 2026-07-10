"""
Phase 1 sensitive-document detection from existing analyze pipeline outputs.

Uses OCR/card-pipeline signals (YOLO + EasyOCR results) and optional Gemini caption
text already produced by ``run_vision`` — no new AI endpoints or OCR changes.
"""

from __future__ import annotations

import re
from typing import Any

# Phase 1 scope: CNIC, national ID, credit card, debit card (see _normalize_sensitive_document_type).

_VISION_SENSITIVE_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\bdebit\s+card\b", re.IGNORECASE), "debit_card"),
    (re.compile(r"\bcredit\s+card\b", re.IGNORECASE), "credit_card"),
    (re.compile(r"\bpayment\s+card\b", re.IGNORECASE), "credit_card"),
    (re.compile(r"\bbank\s+card\b", re.IGNORECASE), "credit_card"),
    (re.compile(r"\bcnic\b", re.IGNORECASE), "cnic"),
    (re.compile(r"\bnational\s+id(?:entity)?\s+card\b", re.IGNORECASE), "national_id"),
    (re.compile(r"\bnational\s+id\b", re.IGNORECASE), "national_id"),
    (re.compile(r"\bidentity\s+card\b", re.IGNORECASE), "national_id"),
)


def _field_text(ocr_payload: dict[str, Any], key: str) -> str:
    fields = ocr_payload.get("fields")
    if isinstance(fields, dict):
        entry = fields.get(key)
        if isinstance(entry, dict):
            value = entry.get("value")
        else:
            value = entry
        if value is not None and str(value).strip():
            return str(value).strip()

    flat = ocr_payload.get(key)
    if flat is not None and str(flat).strip():
        return str(flat).strip()
    return ""


def _normalize_sensitive_document_type(raw_type: str) -> str | None:
    doc = (raw_type or "").strip().lower()
    if doc == "cnic":
        return "cnic"
    if doc in ("national_id", "id_card"):
        return "national_id"
    if doc == "debit_card":
        return "debit_card"
    if doc == "credit_card":
        return "credit_card"
    return None


def _classify_payment_card_type(ocr_payload: dict[str, Any]) -> str:
    brand = _field_text(ocr_payload, "card_brand").lower()
    combined = " ".join(
        [
            brand,
            _field_text(ocr_payload, "card_number"),
            str(ocr_payload.get("ocr_text") or ""),
        ]
    ).lower()
    if "debit" in combined:
        return "debit_card"
    return "credit_card"


def _classify_from_ocr(ocr_payload: dict[str, Any]) -> str | None:
    doc = _normalize_sensitive_document_type(str(ocr_payload.get("document_type") or ""))
    if doc:
        if doc == "credit_card":
            return _classify_payment_card_type(ocr_payload)
        return doc

    if _field_text(ocr_payload, "card_number") or _field_text(ocr_payload, "expiry_date"):
        return _classify_payment_card_type(ocr_payload)

    return None


def resolve_sensitivity_from_vision_text(
    *,
    caption: str = "",
    distinctive_features: str = "",
    ocr_text: str = "",
) -> tuple[bool, str | None]:
    """Fallback using Gemini caption/features already returned by analyze vision."""
    haystack = "\n".join([caption or "", distinctive_features or "", ocr_text or ""]).strip()
    if not haystack:
        return False, None

    for pattern, sensitive_type in _VISION_SENSITIVE_PATTERNS:
        if pattern.search(haystack):
            return True, sensitive_type
    return False, None


def resolve_image_sensitivity(
    ocr_payload: dict[str, Any] | None,
    *,
    yolo_threshold: float,
    caption: str = "",
    distinctive_features: str = "",
    ocr_text: str = "",
) -> tuple[bool, str | None]:
    """
    Determine whether an analyzed image contains Phase 1 sensitive documents.

    Returns:
        (is_sensitive, sensitive_document_type)
    """
    if ocr_payload:
        doc_type = _classify_from_ocr(ocr_payload)
        if doc_type:
            return True, doc_type

    return resolve_sensitivity_from_vision_text(
        caption=caption,
        distinctive_features=distinctive_features,
        ocr_text=ocr_text or (str((ocr_payload or {}).get("ocr_text") or "")),
    )
