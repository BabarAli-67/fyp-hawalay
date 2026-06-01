from fastapi import APIRouter, Depends, File, Form, UploadFile

from core.internal_auth import verify_internal_secret
from dependencies import BlipServiceDep

router = APIRouter(prefix="/api/v1/blip", tags=["blip"])


@router.get("/status")
async def blip_status(blip_service: BlipServiceDep) -> dict:
    return blip_service.status


@router.post("/caption", dependencies=[Depends(verify_internal_secret)])
async def caption_image(
    blip_service: BlipServiceDep,
    image: UploadFile = File(..., description="JPEG or PNG image"),
    fallback_text: str = Form(
        default="",
        description="Unused fallback hint (Gemini failures return empty caption)",
    ),
) -> dict:
    image_bytes = await image.read()
    return await blip_service.caption(image_bytes, fallback_text=fallback_text)
