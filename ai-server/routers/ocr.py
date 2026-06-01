from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from core.internal_auth import verify_internal_secret
from dependencies import OcrServiceDep
from schemas.ocr import OcrExtractResponse

router = APIRouter(prefix="/api/v1/ocr", tags=["ocr"])


@router.get("/status", dependencies=[Depends(verify_internal_secret)])
async def ocr_status(ocr_service: OcrServiceDep) -> dict:
    """YOLO + EasyOCR readiness (YOLO loads once at startup)."""
    return {
        "module": "ocr",
        "yolo": ocr_service.yolo_status,
    }


@router.post(
    "/extract",
    summary="Extract structured OCR from ID/credit card image",
    response_model=OcrExtractResponse,
    response_description="Structured fields with YOLO + OCR confidence scores",
    dependencies=[Depends(verify_internal_secret)],
)
async def extract_ocr(
    ocr_service: OcrServiceDep,
    image: UploadFile = File(..., description="JPEG or PNG document image (max 5MB)"),
    document_type: str = Form(
        default="auto",
        description="Document hint: auto | credit_card | cnic",
    ),
) -> OcrExtractResponse:
    """
    Upload a card image (multipart/form-data).

    **Validation:** JPEG/PNG only, max 5MB, corrupt files rejected with 422.

    **Response:** ``fields`` map with ``value`` + ``confidence`` per logical field.
    """
    if not image.content_type:
        raise HTTPException(status_code=400, detail="Missing content type")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image file")

    try:
        payload = await ocr_service.extract(
            image_bytes,
            content_type=image.content_type,
            document_type=document_type.strip().lower() or "auto",
        )
        return OcrExtractResponse.model_validate(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="OCR extraction failed") from exc
