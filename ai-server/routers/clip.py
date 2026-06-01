from fastapi import APIRouter, Depends, File, Form, UploadFile

from core.internal_auth import verify_internal_secret
from dependencies import ClipServiceDep

router = APIRouter(prefix="/api/v1/clip", tags=["clip"])


@router.get("/status")
async def clip_status(clip_service: ClipServiceDep) -> dict:
    return clip_service.status


@router.post("/embedding/text", dependencies=[Depends(verify_internal_secret)])
async def embed_text(
    clip_service: ClipServiceDep,
    text: str = Form(..., description="Text to embed with CLIP"),
) -> dict:
    return await clip_service.embed_text(text)


@router.post("/embedding/image", dependencies=[Depends(verify_internal_secret)])
async def embed_image(
    clip_service: ClipServiceDep,
    image: UploadFile = File(..., description="JPEG or PNG image"),
) -> dict:
    image_bytes = await image.read()
    return await clip_service.embed_image(image_bytes)


@router.post("/embedding", dependencies=[Depends(verify_internal_secret)])
async def embed_image_alias(
    clip_service: ClipServiceDep,
    image: UploadFile = File(..., description="JPEG or PNG image"),
) -> dict:
    """Backward-compatible alias for image embeddings."""
    image_bytes = await image.read()
    return await clip_service.embed_image(image_bytes)
