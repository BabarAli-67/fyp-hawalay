"""Unified AI pipeline routes (OCR + Gemini caption + embedding fusion)."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

from config import get_settings
from core.internal_auth import verify_internal_secret
from core.model_registry import registry
from core.pipeline_orchestrator import AnalyzeOrchestrator
from dependencies import MatchingServiceDep
from schemas.analyze import AnalyzeImageResponse, AnalyzeModelsInfo
from schemas.ocr import OcrExtractResponse
from services.ocr_service import extract_text
from utils.image_utils import decode_image, resize_image
from utils.ocr_response_builder import build_ocr_response, response_to_dict

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])


class ProcessImageResponse(BaseModel):
    """Response from ``POST /ai/process-image``."""

    caption: str = ""
    ocr_text: str = ""
    embedding_vector: list[float] = Field(default_factory=list)
    embedding_available: bool = False


class EmbedItemResponse(BaseModel):
    """Matching fingerprint from final report text (+ optional image)."""

    embedding_vector: list[float] = Field(default_factory=list)
    embedding_dimension: int = Field(default=0, ge=0)
    embedding_available: bool = False
    embedding_model: str | None = None


def _orchestrator(request: Request) -> AnalyzeOrchestrator:
    reg = getattr(request.app.state, "model_registry", registry)
    return AnalyzeOrchestrator(reg, get_settings())


def _empty_ocr_payload(document_type: str = "auto", *, message: str | None = None) -> dict[str, Any]:
    response = build_ocr_response(
        status="error",
        document_type_hint=document_type,
        detections_map={},
        processing_time_ms=0.0,
        message=message or "OCR unavailable",
        yolo_available=False,
    )
    response.success = False
    return response_to_dict(response)


def _empty_analyze_response(document_type: str, *, message: str | None = None) -> AnalyzeImageResponse:
    orch = AnalyzeOrchestrator(registry, get_settings())
    empty_vision = {
        "embedding_vector": [0.0] * 512,
        "embedding_dimension": 512,
        "embedding_available": False,
    }
    return AnalyzeImageResponse(
        ocr=OcrExtractResponse.model_validate(_empty_ocr_payload(document_type, message=message)),
        caption="",
        ocr_text="",
        processing_time_ms=0.0,
        models=AnalyzeModelsInfo.model_validate(
            orch.build_models_info(embedding_dimension=empty_vision["embedding_dimension"])
        ),
        **empty_vision,
    )


async def run_process_image_pipeline(
    request: Request,
    *,
    raw_image: bytes | None,
    category: str,
    location: str,
) -> dict[str, Any]:
    """Legacy process-image: supporting OCR text + registry vision pipeline."""
    orch = _orchestrator(request)
    try:
        ocr_text = ""
        if raw_image:
            ocr_reader = request.app.state.ocr_reader
            try:
                img = resize_image(decode_image(raw_image))
                ocr_text = extract_text(img, ocr_reader)
            except Exception as exc:
                logger.warning("OCR supporting text extraction failed: %s", exc)

        vision = await orch.run_vision(
            raw_image=raw_image,
            category=category,
            location=location,
            ocr_text=ocr_text,
        )
        return vision
    except Exception as exc:
        logger.warning("process-image pipeline failed: %s", exc)
        return {
            "caption": "",
            "ocr_text": "",
            "embedding_vector": [0.0] * 512,
            "embedding_available": False,
        }


@router.post(
    "/process-image",
    dependencies=[Depends(verify_internal_secret)],
    response_model=ProcessImageResponse,
)
async def process_image(
    request: Request,
    image: UploadFile | None = File(default=None),
    category: str = Form(default=""),
    location: str = Form(default=""),
) -> ProcessImageResponse:
    raw_image: bytes | None = None
    if image is not None and image.filename:
        raw_image = await image.read()
        if not raw_image:
            raw_image = None

    result = await run_process_image_pipeline(
        request,
        raw_image=raw_image,
        category=category,
        location=location,
    )
    return ProcessImageResponse.model_validate(result)


@router.post(
    "/analyze-image",
    dependencies=[Depends(verify_internal_secret)],
    response_model=AnalyzeImageResponse,
    summary="Unified OCR + optional object detect + Gemini caption + embeddings",
)
async def analyze_image(
    request: Request,
    image: UploadFile = File(..., description="JPEG or PNG image"),
    category: str = Form(default=""),
    location: str = Form(default=""),
    title: str | None = Form(default=None),
    description: str | None = Form(default=None),
    document_type: str = Form(
        default="auto",
        description="Document hint: auto | credit_card | cnic",
    ),
    enable_object_detect: bool = Form(
        default=True,
        description="Run object_v1 when weights are configured",
    ),
) -> AnalyzeImageResponse:
    started = time.perf_counter()
    doc_type = document_type.strip().lower() or "auto"
    orch = _orchestrator(request)

    if not image.content_type:
        return _empty_analyze_response(doc_type, message="Missing content type")

    raw_image = await image.read()
    if not raw_image:
        return _empty_analyze_response(doc_type, message="Empty image file")

    try:
        pipeline = await orch.run_analyze(
            raw_image=raw_image,
            content_type=image.content_type,
            document_type=doc_type,
            category=category,
            location=location,
            title=title or "",
            description=description or "",
            enable_object_detect=enable_object_detect,
        )
    except Exception as exc:
        logger.error("analyze-image orchestration failed: %s", exc, exc_info=True)
        return _empty_analyze_response(doc_type, message=str(exc))

    elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
    embedding_dimension = pipeline.get("embedding_dimension", 0)
    caption_words = len((pipeline.get("caption") or "").split())
    logger.info(
        "[analyze-image] done ms=%s vision_status=%s caption_words=%d ocr_success=%s",
        elapsed_ms,
        pipeline.get("vision_status"),
        caption_words,
        bool((pipeline.get("ocr") or {}).get("success")),
    )

    return AnalyzeImageResponse(
        ocr=OcrExtractResponse.model_validate(pipeline["ocr"]),
        object_detection=pipeline["object_detection"],
        caption=pipeline["caption"],
        distinctive_features=pipeline.get("distinctive_features") or "",
        feature_points=pipeline.get("feature_points") or [],
        extracted_attributes=pipeline.get("extracted_attributes") or [],
        ocr_text=pipeline["ocr_text"],
        embedding_vector=pipeline["embedding_vector"],
        embedding_dimension=embedding_dimension,
        embedding_available=pipeline["embedding_available"],
        vision_status=pipeline.get("vision_status") or "empty",
        vision_message=pipeline.get("vision_message") or "",
        processing_time_ms=elapsed_ms,
        models=AnalyzeModelsInfo.model_validate(
            orch.build_models_info(embedding_dimension=embedding_dimension)
        ),
    )


def _parse_json_list(raw: str | None) -> list[str]:
    if not raw or not str(raw).strip():
        return []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(x).strip() for x in parsed if str(x).strip()]
    except json.JSONDecodeError:
        return [part.strip() for part in str(raw).split(",") if part.strip()]
    return []


@router.post(
    "/embed-item",
    dependencies=[Depends(verify_internal_secret)],
    response_model=EmbedItemResponse,
    summary="Build matching embedding from final report fields (with or without image)",
)
async def embed_item(
    request: Request,
    image: UploadFile | None = File(default=None),
    category: str = Form(default=""),
    location: str = Form(default=""),
    title: str = Form(default=""),
    description: str = Form(default=""),
    distinctive_features: str = Form(default=""),
    brand: str = Form(default=""),
    colors: str = Form(default="", description="JSON array of color strings"),
    caption: str = Form(default=""),
    ocr_text: str = Form(default=""),
    feature_points: str = Form(default="", description="JSON array of feature bullet strings"),
    object_labels: str = Form(default="", description="JSON array of detector class names"),
) -> EmbedItemResponse:
    raw_image: bytes | None = None
    if image is not None and image.filename:
        raw_image = await image.read()
        if not raw_image:
            raw_image = None

    result = await _orchestrator(request).embed_item_report(
        raw_image=raw_image,
        category=category.strip(),
        location=location.strip(),
        title=title.strip(),
        description=description.strip(),
        distinctive_features=distinctive_features.strip(),
        brand=brand.strip(),
        colors=_parse_json_list(colors),
        caption=caption.strip(),
        ocr_text=ocr_text.strip(),
        feature_points=_parse_json_list(feature_points),
        object_labels=_parse_json_list(object_labels),
    )
    return EmbedItemResponse.model_validate(result)


class MatchRequestBody(BaseModel):
    item_id: str = Field(..., description="MongoDB item _id to match against candidates")
    limit: int = Field(default=5, ge=1, le=50)


@router.post(
    "/match",
    dependencies=[Depends(verify_internal_secret)],
    summary="Background matching job (Express → FastAPI)",
)
async def match_item(
    body: MatchRequestBody,
    matching_service: MatchingServiceDep,
) -> dict[str, Any]:
    try:
        return await matching_service.find_matches(item_id=body.item_id, limit=body.limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
