from datetime import datetime, timezone

from fastapi import APIRouter, Request

from config import get_settings
from core.model_registry import registry
from utils.gemini_debug import mask_api_key

router = APIRouter(tags=["health"])


def _registry(request: Request):
    return getattr(request.app.state, "model_registry", registry)


def _build_health_payload(request: Request) -> dict:
    ocr_reader = getattr(request.app.state, "ocr_reader", None)
    db = getattr(request.app.state, "db", None)
    gemini_client = getattr(request.app.state, "gemini_client", None)
    settings = get_settings()
    gemini_key_configured = bool(settings.gemini_api_key.strip())
    gemini_client_initialized = gemini_client is not None
    reg = _registry(request)

    return {
        "status": "ok",
        "ocr_ready": ocr_reader is not None,
        "motor_ready": db is not None,
        "gemini_configured": gemini_key_configured and gemini_client_initialized,
        "gemini_key_configured": gemini_key_configured,
        "gemini_client_initialized": gemini_client_initialized,
        "gemini_key_suffix": mask_api_key(settings.gemini_api_key),
        "gemini_caption_model": settings.gemini_caption_model,
        "models": reg.health_report(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/ai/health")
async def ai_health(request: Request) -> dict:
    """Primary health check for MERN / Render probes."""
    return _build_health_payload(request)


@router.get("/ai/models/status")
async def models_status(request: Request) -> dict:
    """Registered inference providers and readiness (ModelRegistry)."""
    return {"status": "ok", "models": _registry(request).health_report()}


@router.get("/health")
async def health(request: Request) -> dict:
    """Alias for load balancers that expect /health."""
    payload = _build_health_payload(request)
    ocr_service = getattr(request.app.state, "ocr_service", None)
    caption = getattr(request.app.state, "blip_service", None)
    embedding = getattr(request.app.state, "clip_service", None)
    matching = getattr(request.app.state, "matching_service", None)
    return {
        **payload,
        "service": "hawalay-ai-server",
        "yolo_ready": bool(ocr_service and ocr_service.yolo_status.get("ready")),
        "object_detector_ready": bool(
            getattr(request.app.state, "object_detector", None)
            and request.app.state.object_detector.is_ready
        ),
        "modules": {
            "caption": caption.status if caption else None,
            "embedding": embedding.status if embedding else None,
            "matching": matching.status if matching else None,
        },
    }
