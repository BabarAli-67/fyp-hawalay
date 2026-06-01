"""FastAPI dependency injection helpers."""

from __future__ import annotations

import asyncio
from typing import Annotated, Any

from fastapi import Depends, Request
from google.genai import Client

from config import Settings, get_settings
from services.blip_service import BlipService
from services.clip_service import ClipService
from services.matching_service import MatchingService
from services.ocr_service import OcrService


def get_app_settings() -> Settings:
    return get_settings()


def get_db(request: Request) -> Any:
    return request.app.state.db


def get_ocr_reader(request: Request) -> Any:
    reader = getattr(request.app.state, "ocr_reader", None)
    if reader is None:
        raise RuntimeError("EasyOCR reader is not initialized")
    return reader


def get_easyocr_lock(request: Request) -> asyncio.Semaphore:
    lock = getattr(request.app.state, "easyocr_lock", None)
    if lock is None:
        raise RuntimeError("EasyOCR lock is not initialized")
    return lock


def get_yolo_detector(request: Request) -> Any:
    return getattr(request.app.state, "yolo_detector", None)


def get_ocr_service(request: Request) -> OcrService:
    service = getattr(request.app.state, "ocr_service", None)
    if service is None:
        raise RuntimeError("OCR service is not initialized")
    return service


def get_blip_service(request: Request) -> BlipService:
    return getattr(request.app.state, "blip_service", BlipService())


def get_clip_service(request: Request) -> ClipService:
    return getattr(request.app.state, "clip_service", ClipService())


def get_gemini_client(request: Request) -> Client | None:
    return getattr(request.app.state, "gemini_client", None)


def get_matching_service(request: Request) -> MatchingService:
    service = getattr(request.app.state, "matching_service", None)
    if service is None:
        db = getattr(request.app.state, "db", None)
        if db is None:
            raise RuntimeError("MongoDB is not initialized")
        return MatchingService(db)
    return service


SettingsDep = Annotated[Settings, Depends(get_app_settings)]
DbDep = Annotated[Any, Depends(get_db)]
OcrServiceDep = Annotated[OcrService, Depends(get_ocr_service)]
BlipServiceDep = Annotated[BlipService, Depends(get_blip_service)]
ClipServiceDep = Annotated[ClipService, Depends(get_clip_service)]
MatchingServiceDep = Annotated[MatchingService, Depends(get_matching_service)]
GeminiClientDep = Annotated[Client | None, Depends(get_gemini_client)]
