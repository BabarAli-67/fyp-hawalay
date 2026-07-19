"""
Build sensitive OCR regions (text + boundingBoxes + confidence) for Phase 2 masking.

Reuses YOLO field boxes and EasyOCR word-level boxes from the existing OCR pipeline.
"""

from __future__ import annotations

import re
from typing import Any

from utils.ocr_text_cleaning import combine_field_confidence

# YOLO/EasyOCR classes that may contain Phase 2 mask targets.
_SENSITIVE_FIELD_CLASSES = frozenset(
    {
        "card_number",
        "expiry_date",
    }
)

_CVC_PATTERN = re.compile(r"\b(\d{3,4})\b")
_CNIC_PATTERN = re.compile(r"\b(\d{5}[-\s]?\d{7}[-\s]?\d)\b")
_CARD_NUMBER_PATTERN = re.compile(r"\b(?:\d[ -]?){13,19}\b")
_EXPIRY_PATTERN = re.compile(r"\b(\d{2}[/\-]\d{2,4})\b")

_CNIC_DIGIT_COUNT = 13
_CNIC_DOC_TYPES = frozenset({"cnic", "national_id", "id", "id_card"})
_SAME_LINE_Y_TOLERANCE_PX = 30
_MAX_HORIZONTAL_GAP_PX = 80


def _label_for_field(field: str, document_type: str) -> str:
    doc = (document_type or "unknown").strip().lower()
    if field == "card_number":
        if doc in _CNIC_DOC_TYPES:
            return "CNIC Number"
        if doc == "debit_card":
            return "Debit Card Number"
        return "Credit Card Number"
    if field == "expiry_date":
        return "Expiry"
    if field == "cvc":
        return "CVC"
    return field.replace("_", " ").title()


def _boxes_from_text_boxes(text_boxes: list[dict[str, Any]] | None) -> list[list[int]]:
    if not text_boxes:
        return []
    return [box["bbox"] for box in text_boxes if isinstance(box.get("bbox"), list) and len(box["bbox"]) == 4]


def _confidence_from_text_boxes(
    text_boxes: list[dict[str, Any]] | None,
    *,
    fallback: float,
) -> float:
    if not text_boxes:
        return fallback
    values = [float(box.get("confidence") or 0.0) for box in text_boxes]
    if not values:
        return fallback
    return round(max(values), 3)


def _region(
    *,
    field: str,
    document_type: str,
    text: str,
    bounding_boxes: list[list[int]],
    confidence: float,
) -> dict[str, Any]:
    return {
        "field": field,
        "label": _label_for_field(field, document_type),
        "text": text,
        "boundingBoxes": bounding_boxes,
        "confidence": round(max(0.0, min(float(confidence), 1.0)), 3),
    }


def _extract_digits(text: str) -> str:
    return re.sub(r"\D", "", str(text or ""))


def _format_cnic_digits(digits: str) -> str:
    if len(digits) != _CNIC_DIGIT_COUNT:
        return digits
    return f"{digits[:5]}-{digits[5:12]}-{digits[12]}"


def _is_cnic_digit_sequence(digits: str) -> bool:
    return len(digits) == _CNIC_DIGIT_COUNT and digits.isdigit()


def _cnic_match_text(text: str) -> str | None:
    """
    Return canonical CNIC text (#####-#######-#) when OCR text contains a CNIC number.

    Handles hyphenated reads, missing separators, and ``normalize_card_number`` spacing
  (e.g. ``1234 5123 4567 1`` from a 13-digit CNIC).
    """
    cleaned = str(text or "").strip()
    if not cleaned:
        return None

    match = _CNIC_PATTERN.search(cleaned)
    if match:
        digits = _extract_digits(match.group(1))
        if _is_cnic_digit_sequence(digits):
            return _format_cnic_digits(digits)

    digits = _extract_digits(cleaned)
    if _is_cnic_digit_sequence(digits):
        return _format_cnic_digits(digits)

    return None


def text_matches_cnic(text: str) -> str | None:
    """Public helper — canonical CNIC when ``text`` contains a 13-digit national ID number."""
    return _cnic_match_text(text)


def detections_contain_cnic_signal(detections_map: dict[str, Any]) -> bool:
    """True when structured OCR detections include a CNIC number pattern."""
    return _detections_contain_cnic_signal(detections_map)


def _bbox_center_y(bbox: list[int]) -> float:
    return (float(bbox[1]) + float(bbox[3])) / 2.0


def _boxes_same_line(bbox_a: list[int], bbox_b: list[int]) -> bool:
    return abs(_bbox_center_y(bbox_a) - _bbox_center_y(bbox_b)) <= _SAME_LINE_Y_TOLERANCE_PX


def _horizontal_gap(left_bbox: list[int], right_bbox: list[int]) -> int:
    return int(left_bbox[0]) - int(right_bbox[2])


def _avg_confidence(boxes: list[dict[str, Any]]) -> float:
    if not boxes:
        return 0.0
    values = [float(box.get("confidence") or 0.0) for box in boxes]
    return round(sum(values) / len(values), 3)


def _dedupe_cnic_regions(regions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    best_by_text: dict[str, dict[str, Any]] = {}
    for region in regions:
        key = str(region.get("text") or "")
        existing = best_by_text.get(key)
        if existing is None or float(region.get("confidence") or 0.0) > float(
            existing.get("confidence") or 0.0
        ):
            best_by_text[key] = region
    return list(best_by_text.values())


def _merge_line_boxes_for_cnic(line: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Merge adjacent EasyOCR word boxes on one line into a single CNIC region."""
    regions: list[dict[str, Any]] = []
    count = len(line)

    for start in range(count):
        combined_digits = ""
        used_boxes: list[dict[str, Any]] = []

        for idx in range(start, count):
            if idx > start:
                gap = _horizontal_gap(line[idx]["bbox"], line[idx - 1]["bbox"])
                if gap > _MAX_HORIZONTAL_GAP_PX:
                    break

            segment_digits = _extract_digits(str(line[idx].get("text") or ""))
            if not segment_digits:
                break

            combined_digits += segment_digits
            used_boxes.append(line[idx])

            if len(combined_digits) > _CNIC_DIGIT_COUNT:
                break

            if _is_cnic_digit_sequence(combined_digits):
                regions.append(
                    _region(
                        field="card_number",
                        document_type="cnic",
                        text=_format_cnic_digits(combined_digits),
                        bounding_boxes=[box["bbox"] for box in used_boxes],
                        confidence=_avg_confidence(used_boxes),
                    )
                )
                break

    return regions


def _extract_cnic_regions_from_text_boxes(
    text_boxes: list[dict[str, Any]],
    *,
    document_type: str = "cnic",
) -> list[dict[str, Any]]:
    """
    CNIC-specific region extraction from EasyOCR word boxes.

    Supports single-box reads and fragmented multi-box CNIC numbers common on ID cards.
    """
    regions: list[dict[str, Any]] = []
    valid_boxes = [
        box
        for box in (text_boxes or [])
        if isinstance(box, dict)
        and isinstance(box.get("bbox"), list)
        and len(box["bbox"]) == 4
        and str(box.get("text") or "").strip()
    ]

    for box in valid_boxes:
        canonical = _cnic_match_text(str(box.get("text") or ""))
        if not canonical:
            continue
        regions.append(
            _region(
                field="card_number",
                document_type=document_type,
                text=canonical,
                bounding_boxes=[box["bbox"]],
                confidence=float(box.get("confidence") or 0.0),
            )
        )

    if regions:
        return _dedupe_cnic_regions(regions)

    digit_boxes = [box for box in valid_boxes if _extract_digits(str(box.get("text") or ""))]
    if not digit_boxes:
        return []

    digit_boxes.sort(key=lambda item: (_bbox_center_y(item["bbox"]), item["bbox"][0]))
    lines: list[list[dict[str, Any]]] = []
    for box in digit_boxes:
        placed = False
        for line in lines:
            if _boxes_same_line(line[0]["bbox"], box["bbox"]):
                line.append(box)
                placed = True
                break
        if not placed:
            lines.append([box])

    for line in lines:
        line.sort(key=lambda item: item["bbox"][0])
        regions.extend(_merge_line_boxes_for_cnic(line))

    return _dedupe_cnic_regions(regions)


def _collect_detection_text_boxes(detections_map: dict[str, Any]) -> list[dict[str, Any]]:
    boxes: list[dict[str, Any]] = []
    for data in detections_map.values():
        if not isinstance(data, dict):
            continue
        for box in data.get("text_boxes") or []:
            if isinstance(box, dict) and isinstance(box.get("bbox"), list) and len(box["bbox"]) == 4:
                boxes.append(box)
    return boxes


def _detections_contain_cnic_signal(detections_map: dict[str, Any]) -> bool:
    for data in detections_map.values():
        if not isinstance(data, dict):
            continue
        if _cnic_match_text(str(data.get("text") or "")):
            return True
        for box in data.get("text_boxes") or []:
            if isinstance(box, dict) and _cnic_match_text(str(box.get("text") or "")):
                return True
    return False


def _is_cnic_document_context(
    document_type: str,
    resolved_doc_type: str,
    detections_map: dict[str, Any],
) -> bool:
    doc_hint = (document_type or "").strip().lower()
    if doc_hint in _CNIC_DOC_TYPES:
        return True
    if resolved_doc_type in _CNIC_DOC_TYPES:
        return True
    if _detections_contain_cnic_signal(detections_map):
        return True

    card_data = detections_map.get("card_number")
    if isinstance(card_data, dict) and _is_cnic_digit_sequence(
        _extract_digits(str(card_data.get("text") or ""))
    ):
        return True

    return False


def _resolve_document_type_for_labels(
    detections_map: dict[str, Any],
    document_type: str,
) -> str:
    doc = (document_type or "unknown").strip().lower()
    if doc in _CNIC_DOC_TYPES:
        return "cnic"
    brand = str((detections_map.get("card_brand") or {}).get("text") or "").lower()
    number = str((detections_map.get("card_number") or {}).get("text") or "").lower()
    if "debit" in f"{brand} {number}":
        return "debit_card"
    if doc in ("debit_card", "credit_card"):
        return doc
    return "credit_card" if doc == "unknown" else doc


def _union_bounding_boxes(boxes: list[list[int]]) -> list[int] | None:
    valid = [box for box in boxes if isinstance(box, list) and len(box) == 4]
    if not valid:
        return None
    return [
        min(int(box[0]) for box in valid),
        min(int(box[1]) for box in valid),
        max(int(box[2]) for box in valid),
        max(int(box[3]) for box in valid),
    ]


def _box_area(box: list[int]) -> int:
    return max(0, int(box[2]) - int(box[0])) * max(0, int(box[3]) - int(box[1]))


def _tighten_cnic_region(region: dict[str, Any]) -> dict[str, Any]:
    """Collapse fragmented CNIC word boxes into one tight strip for precise blur."""
    boxes = region.get("boundingBoxes") or []
    if not isinstance(boxes, list) or len(boxes) <= 1:
        return region
    union = _union_bounding_boxes(boxes)
    if not union:
        return region
    return {**region, "boundingBoxes": [union]}


def _clamp_boxes_to_bounds(
    boxes: list[list[int]],
    bounds: list[int] | None,
) -> list[list[int]]:
    if not bounds or len(bounds) != 4:
        return boxes
    bx1, by1, bx2, by2 = (int(bounds[0]), int(bounds[1]), int(bounds[2]), int(bounds[3]))
    clamped: list[list[int]] = []
    for box in boxes:
        if not isinstance(box, list) or len(box) != 4:
            continue
        x1 = max(bx1, min(bx2, int(box[0])))
        y1 = max(by1, min(by2, int(box[1])))
        x2 = max(bx1, min(bx2, int(box[2])))
        y2 = max(by1, min(by2, int(box[3])))
        if x2 > x1 and y2 > y1:
            clamped.append([x1, y1, x2, y2])
    return clamped


def build_sensitive_regions_from_detections(
    detections_map: dict[str, Any],
    *,
    document_type: str,
) -> list[dict[str, Any]]:
    """Primary path — structured YOLO + per-crop EasyOCR word boxes."""
    regions: list[dict[str, Any]] = []
    resolved_doc_type = _resolve_document_type_for_labels(detections_map, document_type)
    is_cnic = _is_cnic_document_context(document_type, resolved_doc_type, detections_map)

    # Identity cards: mask ONLY the ID number — never DOB/expiry YOLO boxes
    # (those often cover half the card and bleach the image when blurred).
    if is_cnic:
        cnic_regions = [
            _tighten_cnic_region(region)
            for region in _extract_cnic_regions_from_text_boxes(
                _collect_detection_text_boxes(detections_map),
                document_type="cnic",
            )
        ]
        if cnic_regions:
            return cnic_regions

        card_data = detections_map.get("card_number")
        if isinstance(card_data, dict):
            text = str(card_data.get("text") or "").strip()
            text_boxes = card_data.get("text_boxes") if isinstance(card_data.get("text_boxes"), list) else []
            bounding_boxes = _boxes_from_text_boxes(text_boxes)
            field_bbox = card_data.get("bbox")
            if not bounding_boxes and isinstance(field_bbox, list) and len(field_bbox) == 4:
                # Last resort: YOLO number box, but reject card-sized detections.
                # A real CNIC number strip is a thin horizontal band.
                area = _box_area(field_bbox)
                width = max(1, int(field_bbox[2]) - int(field_bbox[0]))
                height = max(1, int(field_bbox[3]) - int(field_bbox[1]))
                if area > 0 and height <= max(48, width * 0.35):
                    bounding_boxes = [field_bbox]
            elif bounding_boxes and isinstance(field_bbox, list) and len(field_bbox) == 4:
                bounding_boxes = _clamp_boxes_to_bounds(bounding_boxes, field_bbox)

            if text and bounding_boxes:
                union = _union_bounding_boxes(bounding_boxes)
                return [
                    _region(
                        field="card_number",
                        document_type="cnic",
                        text=text_matches_cnic(text) or text,
                        bounding_boxes=[union] if union else bounding_boxes,
                        confidence=_confidence_from_text_boxes(
                            text_boxes,
                            fallback=combine_field_confidence(
                                card_data.get("detection_confidence"),
                                card_data.get("ocr_confidence"),
                                has_text=True,
                            ),
                        ),
                    )
                ]
        return []

    for class_name in sorted(_SENSITIVE_FIELD_CLASSES):
        data = detections_map.get(class_name)
        if not isinstance(data, dict):
            continue

        text = str(data.get("text") or "").strip()
        if not text:
            continue

        text_boxes = data.get("text_boxes") if isinstance(data.get("text_boxes"), list) else []
        bounding_boxes = _boxes_from_text_boxes(text_boxes)
        field_bbox = data.get("bbox")
        if not bounding_boxes:
            if isinstance(field_bbox, list) and len(field_bbox) == 4:
                bounding_boxes = [field_bbox]
        elif isinstance(field_bbox, list) and len(field_bbox) == 4:
            bounding_boxes = _clamp_boxes_to_bounds(bounding_boxes, field_bbox) or bounding_boxes

        confidence = _confidence_from_text_boxes(
            text_boxes,
            fallback=combine_field_confidence(
                data.get("detection_confidence"),
                data.get("ocr_confidence"),
                has_text=True,
            ),
        )

        regions.append(
            _region(
                field=class_name,
                document_type=resolved_doc_type,
                text=text,
                bounding_boxes=bounding_boxes,
                confidence=confidence,
            )
        )

    regions.extend(
        _extract_cvc_regions(detections_map, document_type=resolved_doc_type),
    )

    return regions


def _extract_cvc_regions(
    detections_map: dict[str, Any],
    *,
    document_type: str,
) -> list[dict[str, Any]]:
    """Heuristic CVC detection from EasyOCR word boxes (excludes PAN fields)."""
    if document_type not in ("credit_card", "debit_card", "unknown"):
        return []

    regions: list[dict[str, Any]] = []
    for class_name in ("cardholder_name", "expiry_date", "card_brand"):
        data = detections_map.get(class_name)
        if not isinstance(data, dict):
            continue
        for box in data.get("text_boxes") or []:
            if not isinstance(box, dict):
                continue
            text = str(box.get("text") or "").strip()
            if not re.fullmatch(r"\d{3}", text):
                continue
            bbox = box.get("bbox")
            if not isinstance(bbox, list) or len(bbox) != 4:
                continue
            regions.append(
                _region(
                    field="cvc",
                    document_type=document_type,
                    text=text,
                    bounding_boxes=[bbox],
                    confidence=float(box.get("confidence") or 0.0),
                )
            )
    return regions


def build_sensitive_regions_from_full_image_boxes(
    text_boxes: list[dict[str, Any]],
    *,
    document_type: str,
) -> list[dict[str, Any]]:
    """Degraded/no-YOLO path — pattern match on full-image EasyOCR boxes."""
    regions: list[dict[str, Any]] = []
    doc = (document_type or "unknown").strip().lower()

    if doc in _CNIC_DOC_TYPES:
        cnic_regions = _extract_cnic_regions_from_text_boxes(text_boxes, document_type="cnic")
        if cnic_regions:
            return [_tighten_cnic_region(region) for region in cnic_regions]

    for box in text_boxes:
        if not isinstance(box, dict):
            continue
        text = str(box.get("text") or "").strip()
        bbox = box.get("bbox")
        if not text or not isinstance(bbox, list) or len(bbox) != 4:
            continue
        conf = float(box.get("confidence") or 0.0)

        if doc in _CNIC_DOC_TYPES:
            canonical = _cnic_match_text(text)
            if canonical:
                regions.append(
                    _region(
                        field="card_number",
                        document_type="cnic",
                        text=canonical,
                        bounding_boxes=[bbox],
                        confidence=conf,
                    )
                )
                continue

        if _CARD_NUMBER_PATTERN.search(text):
            regions.append(
                _region(
                    field="card_number",
                    document_type=document_type,
                    text=text,
                    bounding_boxes=[bbox],
                    confidence=conf,
                )
            )
            continue

        if _EXPIRY_PATTERN.search(text):
            regions.append(
                _region(
                    field="expiry_date",
                    document_type=document_type,
                    text=text,
                    bounding_boxes=[bbox],
                    confidence=conf,
                )
            )
            continue

        if _CVC_PATTERN.fullmatch(text) and len(text) == 3:
            regions.append(
                _region(
                    field="cvc",
                    document_type=document_type,
                    text=text,
                    bounding_boxes=[bbox],
                    confidence=conf,
                )
            )

    if doc in _CNIC_DOC_TYPES and not regions:
        cnic_regions = _extract_cnic_regions_from_text_boxes(text_boxes, document_type="cnic")
        if cnic_regions:
            return [_tighten_cnic_region(region) for region in cnic_regions]

    return regions
