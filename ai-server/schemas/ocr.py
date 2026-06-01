"""Pydantic schemas for OCR API responses."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class OcrFieldResult(BaseModel):
    """Single extracted document field with confidence metadata."""

    value: str | None = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    ocr_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    detection_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    bbox: list[int] | None = None


class OcrDetectionItem(BaseModel):
    """Raw detection + OCR row (debug / UI overlays)."""

    class_name: str
    text: str | None = None
    detection_confidence: float | None = None
    ocr_confidence: float | None = None
    confidence: float = 0.0
    bbox: list[int] | None = None


class OcrSuggestedFields(BaseModel):
    suggested_title: str | None = None
    suggested_description: str | None = None
    suggested_distinctive_features: str | None = None


class OcrExtractResponse(BaseModel):
    """
    Primary OCR extract response (production contract).

    ``fields`` maps logical document keys to value + confidence.
  Legacy flat keys (``card_number``, etc.) are included for MERN backward compatibility.
    """

    success: bool
    status: str = Field(description="success | no_regions | degraded | error")
    document_type: str
    processing_time_ms: float = Field(ge=0.0)
    overall_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    fields: dict[str, OcrFieldResult]
    detections: list[OcrDetectionItem] = Field(default_factory=list)
    message: str | None = None
    ocr_text: str | None = None
    suggested: OcrSuggestedFields | None = None
    yolo_available: bool = False
    detection_count: int = 0
    module: str = "ocr"

    # Legacy flat aliases (deprecated — prefer ``fields``)
    card_brand: str | None = None
    card_number: str | None = None
    cardholder_name: str | None = None
    expiry_date: str | None = None

    model_config = {"extra": "ignore"}


def empty_field() -> OcrFieldResult:
    return OcrFieldResult()


def build_fields_model(
    detections_map: dict[str, Any],
) -> dict[str, OcrFieldResult]:
    """Build ``fields`` dict from internal detections map."""
    from utils.ocr_text_cleaning import combine_field_confidence, TEXT_FIELD_CLASSES

    fields: dict[str, OcrFieldResult] = {}
    for class_name in sorted(TEXT_FIELD_CLASSES):
        data = detections_map.get(class_name, {})
        text = data.get("text")
        value = text if text else None
        det_conf = data.get("detection_confidence")
        ocr_conf = data.get("ocr_confidence")
        fields[class_name] = OcrFieldResult(
            value=value,
            confidence=combine_field_confidence(det_conf, ocr_conf, has_text=bool(value)),
            ocr_confidence=ocr_conf,
            detection_confidence=det_conf,
            bbox=data.get("bbox"),
        )
    return fields
