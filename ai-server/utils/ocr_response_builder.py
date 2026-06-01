"""Assemble OCR service output into API response models."""

from __future__ import annotations

from typing import Any

from schemas.ocr import (
    OcrDetectionItem,
    OcrExtractResponse,
    OcrSuggestedFields,
    build_fields_model,
)
from utils.ocr_text_cleaning import compute_overall_confidence
from utils.text_builder import (
    build_ocr_text_summary,
    build_suggested_fields,
    detections_to_list,
    resolve_document_type,
)


def build_ocr_response(
    *,
    status: str,
    document_type_hint: str,
    detections_map: dict[str, Any],
    processing_time_ms: float,
    message: str | None = None,
    yolo_available: bool = True,
    detection_count: int = 0,
    degraded_ocr_text: str | None = None,
) -> OcrExtractResponse:
    """
    Convert internal detection map → typed ``OcrExtractResponse``.

    ``success`` is True when status is ``success`` or ``degraded`` with partial text.
    """
    resolved_type = resolve_document_type(document_type_hint, detections_map)
    fields = build_fields_model(detections_map)
    overall = compute_overall_confidence({k: v.model_dump() for k, v in fields.items()})

    detections_list = [
        OcrDetectionItem(
            class_name=item["class_name"],
            text=item.get("text"),
            detection_confidence=item.get("detection_confidence"),
            ocr_confidence=item.get("ocr_confidence"),
            confidence=_item_combined_confidence(item),
            bbox=item.get("bbox"),
        )
        for item in detections_to_list(detections_map)
    ]

    ocr_text = build_ocr_text_summary(detections_map) or degraded_ocr_text
    suggested_raw = build_suggested_fields(detections_map)
    suggested = OcrSuggestedFields(**suggested_raw) if suggested_raw else None

    success = status == "success" or (
        status in ("degraded", "no_regions") and bool(ocr_text or any(f.value for f in fields.values()))
    )

    return OcrExtractResponse(
        success=success,
        status=status,
        document_type=resolved_type,
        processing_time_ms=round(processing_time_ms, 1),
        overall_confidence=overall,
        fields=fields,
        detections=detections_list,
        message=message,
        ocr_text=ocr_text or None,
        suggested=suggested,
        yolo_available=yolo_available,
        detection_count=detection_count,
        card_brand=fields.get("card_brand").value if fields.get("card_brand") else None,
        card_number=fields.get("card_number").value if fields.get("card_number") else None,
        cardholder_name=fields.get("cardholder_name").value if fields.get("cardholder_name") else None,
        expiry_date=fields.get("expiry_date").value if fields.get("expiry_date") else None,
    )


def _item_combined_confidence(item: dict[str, Any]) -> float:
    from utils.ocr_text_cleaning import combine_field_confidence

    return combine_field_confidence(
        item.get("detection_confidence"),
        item.get("ocr_confidence"),
        has_text=bool(item.get("text")),
    )


def response_to_dict(response: OcrExtractResponse) -> dict[str, Any]:
    """JSON-serializable dict for FastAPI (includes nested models)."""
    return response.model_dump(mode="json")
