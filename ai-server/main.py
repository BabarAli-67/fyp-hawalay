"""
Hawalay AI Server — multi-model FastAPI microservice.

Modules:
  - OCR (YOLO + EasyOCR) — active; YOLO optional until weights exist
  - Gemini caption + embeddings, Matching
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

import easyocr
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from config import get_settings
from core.gemini_client import create_gemini_client
from utils.gemini_debug import log_gemini_env_status, mask_api_key
from core.model_ids import CARD_OCR_V1, GEMINI_CAPTION, GEMINI_EMBED, GEMINI_FEATURES, OBJECT_V1
from core.model_registry import registry
from core.object_class_map import load_class_names
from core.object_model_validation import validate_object_model_artifacts
from core.keras_object_detector import KerasObjectDetector
from core.yolo_detector import YoloDetector
from providers.gemini_vision_provider import (
    GeminiCaptionProvider,
    GeminiEmbedProvider,
    GeminiFeaturesProvider,
)
from providers.object_detect_provider import ObjectDetectProvider
from providers.yolo_ocr_provider import YoloOcrProvider
from routers import ai, blip, clip, health, matching, object, ocr
from services.blip_service import BlipService
from services.clip_service import ClipService
from services.matching_service import MatchingService
from services.object_service import ObjectService
from services.ocr_service import OcrService
from utils.category_mapping import load_category_map_from_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("hawalay.ai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("Starting Hawalay AI server (env=%s)", settings.environment)

    # 1) EasyOCR reader (module-level heavy load)
    logger.info("Loading EasyOCR (langs=%s, gpu=%s)...", settings.easyocr_lang_list, settings.easyocr_use_gpu)
    app.state.ocr_reader = easyocr.Reader(
        settings.easyocr_lang_list,
        gpu=settings.easyocr_use_gpu,
    )
    logger.info("EasyOCR ready")

    app.state.easyocr_lock = asyncio.Semaphore(1)

    # 2) MongoDB — shared DB for matching (same database as Express/Mongoose)
    logger.info("Connecting to MongoDB...")
    app.state.mongo_client = AsyncIOMotorClient(settings.mongo_uri)
    db_name = settings.mongo_db_name
    uri_db_match = __import__("re").search(
        r"mongodb(?:\+srv)?://[^/]+/([^/?]+)",
        settings.mongo_uri,
    )
    if uri_db_match and uri_db_match.group(1):
        db_name = uri_db_match.group(1)
    app.state.db = app.state.mongo_client[db_name]
    logger.info("MongoDB database: %s", db_name)

    app.state.gemini_client = create_gemini_client(settings)
    log_gemini_env_status(settings=settings, client=app.state.gemini_client)
    if app.state.gemini_client is not None:
        logger.info(
            "Gemini client initialized for caption model: %s, embedding model: %s (key=%s)",
            settings.gemini_caption_model,
            settings.gemini_embedding_model,
            mask_api_key(settings.gemini_api_key),
        )
        logger.info(
            "Gemini usage: max_attempts=%s caption_quality_retry=%s caption_max_passes=%s "
            "caption_max_output_tokens=%s features=%s embed_image=%s",
            settings.gemini_generate_max_attempts,
            settings.gemini_caption_quality_retry,
            settings.gemini_caption_max_passes,
            settings.gemini_caption_max_output_tokens,
            settings.gemini_features_enabled,
            settings.gemini_embed_image,
        )
    else:
        logger.warning("Gemini client not initialized — GEMINI_API_KEY is missing")

    # 3) Model services
    weights = settings.resolved_yolo_weights()
    app.state.yolo_detector = YoloDetector(
        weights,
        confidence=settings.yolo_confidence_threshold,
        use_gpu=settings.yolo_use_gpu,
    )

    object_class_names_path = settings.expected_object_class_names_path()
    category_map_path = settings.expected_object_category_map_path()
    object_weights_path = settings.expected_object_weights_path()

    object_validation = validate_object_model_artifacts(
        weights_path=object_weights_path,
        class_names_path=object_class_names_path,
        category_map_path=category_map_path,
    )
    object_validation.log()
    app.state.object_model_validation = object_validation

    object_class_names = load_class_names(settings.resolved_object_class_names())
    object_weights_path = settings.expected_object_weights_path()
    app.state.object_detector = KerasObjectDetector(
        object_weights_path,
        confidence=settings.object_confidence_threshold,
        use_gpu=settings.object_use_gpu,
        class_names=object_class_names,
    )
    if app.state.object_detector.is_ready and object_validation.ready:
        detector_status = app.state.object_detector.status
        logger.info(
            "Object detector ready (%d classes, mode=%s, input=%s, output=%s)",
            len(object_class_names),
            detector_status.get("output_mode"),
            detector_status.get("input_shape"),
            detector_status.get("output_shape"),
        )
    elif app.state.object_detector.is_ready:
        logger.warning(
            "Object detector weights loaded but artifact validation failed — "
            "check class_names.json / category_map.json logs above",
        )
    else:
        logger.info(
            "Object detector placeholder registered — %s",
            app.state.object_detector.status.get("error") or "awaiting OBJECT_MODEL_PATH",
        )
    app.state.ocr_service = OcrService(
        app.state.ocr_reader,
        app.state.yolo_detector,
        easyocr_lock=app.state.easyocr_lock,
    )
    app.state.blip_service = BlipService(
        model_id=settings.gemini_caption_model,
        gemini_api_key=settings.gemini_api_key,
        client=app.state.gemini_client,
    )
    app.state.object_service = ObjectService(
        app.state.object_detector,
        app.state.blip_service,
        category_map=load_category_map_from_settings(settings),
        settings=settings,
    )
    app.state.clip_service = ClipService(
        model_id=settings.gemini_embedding_model,
        gemini_api_key=settings.gemini_api_key,
        client=app.state.gemini_client,
    )
    app.state.matching_service = MatchingService(
        app.state.db,
        similarity_threshold=settings.similarity_threshold,
        match_radius_meters=settings.match_radius_meters,
        date_window_days=settings.date_window_days,
        match_limit=settings.match_limit,
        max_candidates=settings.max_match_candidates,
        category_bonus=settings.category_bonus,
    )

    app.state.model_registry = registry
    for reg_name, provider in (
        (CARD_OCR_V1, YoloOcrProvider(app.state.ocr_service)),
        (GEMINI_CAPTION, GeminiCaptionProvider(app.state.blip_service)),
        (GEMINI_FEATURES, GeminiFeaturesProvider(app.state.blip_service)),
        (GEMINI_EMBED, GeminiEmbedProvider(app.state.clip_service)),
        (OBJECT_V1, ObjectDetectProvider(app.state.object_detector)),
    ):
        try:
            registry.register(reg_name, provider)
        except Exception as exc:
            logger.warning("Failed to register model '%s': %s", reg_name, exc)

    report = registry.health_report()
    logger.info(
        "Model registry: registered=%s ready=%s unavailable=%s",
        report["registered"],
        report["ready"],
        report["unavailable"],
    )

    if app.state.yolo_detector.is_ready:
        logger.info("YOLO detector ready")
    else:
        logger.warning("YOLO detector not ready: %s", app.state.yolo_detector.status.get("error"))

    yield

    logger.info("Shutting down Hawalay AI server...")
    app.state.gemini_client = None
    app.state.mongo_client.close()
    logger.info("MongoDB connection closed")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Hawalay AI Server",
        description="Modular AI inference: OCR, Gemini caption/embeddings, matching",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.node_server_url.rstrip("/")],
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )

    app.include_router(health.router)
    app.include_router(ai.router)
    app.include_router(ocr.router)
    app.include_router(object.router)
    app.include_router(blip.router)
    app.include_router(clip.router)
    app.include_router(matching.router)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    from utils.port_check import warn_if_stale_ai_server_on_proxy_port

    cfg = get_settings()
    warn_if_stale_ai_server_on_proxy_port(cfg.port)
    uvicorn.run(
        "main:app",
        host=cfg.host,
        port=cfg.port,
        reload=not cfg.is_production,
    )
