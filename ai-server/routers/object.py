"""object_v1 routes — Keras detection + Gemini caption (mirrors OCR router layout)."""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from core.internal_auth import verify_internal_secret
from dependencies import ObjectServiceDep
from schemas.object import ObjectDetectResponse

router = APIRouter(prefix="/api/v1/object", tags=["object"])


@router.get("/status", dependencies=[Depends(verify_internal_secret)])
async def object_status(object_service: ObjectServiceDep) -> dict:
    """object_v1 Keras detector + Gemini caption readiness."""
    return {
        "module": "object_v1",
        "detector": object_service.detector_status,
        "gemini": object_service.gemini_status,
        "category_map_size": object_service.category_map_size,
    }


@router.post(
    "/detect",
    summary="Detect objects with object_v1 Keras model and describe with Gemini",
    response_model=ObjectDetectResponse,
    response_description="Detected features with categories plus Gemini caption",
    dependencies=[Depends(verify_internal_secret)],
)
async def detect_objects(
    object_service: ObjectServiceDep,
    image: UploadFile = File(..., description="JPEG or PNG image (max 5MB)"),
    category: str = Form(default="", description="Optional report category hint for Gemini"),
    location: str = Form(default="", description="Optional location hint for Gemini"),
    title: str = Form(default="", description="Optional title hint for Gemini"),
    enable_caption: bool = Form(
        default=True,
        description="When false, run Keras detection only (no Gemini call)",
    ),
) -> ObjectDetectResponse:
    """
    Upload an image (multipart/form-data).

    **Pipeline:** Keras ``object_v1/weights/hawaly_model_final.keras`` → category_map.json → Gemini caption.

    **Partial success:** detections are returned if Gemini fails; caption is returned if
    detection fails but Gemini succeeds.
    """
    if not image.content_type:
        raise HTTPException(status_code=400, detail="Missing content type")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image file")

    try:
        payload = await object_service.detect_and_describe(
            image_bytes,
            content_type=image.content_type,
            category=category.strip(),
            location=location.strip(),
            title=title.strip(),
            enable_caption=enable_caption,
        )
        return ObjectDetectResponse.model_validate(payload)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Object detection failed") from exc
