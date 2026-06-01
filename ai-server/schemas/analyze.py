"""Pydantic schemas for unified image analysis (OCR + Gemini caption + embeddings)."""

from __future__ import annotations

from pydantic import BaseModel, Field

from schemas.detection import ObjectDetectionResult
from schemas.extraction import ExtractedAttribute
from schemas.ocr import OcrExtractResponse


class AnalyzeModelsInfo(BaseModel):
    """Model identifiers used for the analyze-image pipeline (for Item aiMetadata)."""

    caption: str = ""
    embedding: str = ""
    ocr: str = ""
    object: str = ""
    features: str = ""
    pipeline_version: str = "analyze_v1"
    embedding_dimension: int = Field(default=0, ge=0)


class AnalyzeImageResponse(BaseModel):
    """Response from ``POST /ai/analyze-image`` — structured OCR + vision pipeline."""

    ocr: OcrExtractResponse
    object_detection: ObjectDetectionResult = Field(default_factory=ObjectDetectionResult)
    caption: str = ""
    distinctive_features: str = Field(
        default="",
        description="Bullet-list distinctive features for report form (Extract from Image)",
    )
    feature_points: list[str] = Field(
        default_factory=list,
        description="Structured feature bullets (without • prefix)",
    )
    extracted_attributes: list[ExtractedAttribute] = Field(
        default_factory=list,
        description="Unified OCR + object (+ future) attributes for reporting UI",
    )
    ocr_text: str = ""
    # Regression risk: Express itemEmbedding.js falls back to client vector only if embed-item fails — this field becoming None is safe.
    embedding_vector: list[float] | None = Field(
        default=None,
        description="Preview matching fingerprint when generated at analyze time; null when skipped.",
    )
    embedding_dimension: int = Field(
        default=0,
        ge=0,
        description="Length of embedding_vector (expected 512 for matching pipeline)",
    )
    embedding_available: bool = False
    vision_status: str = Field(
        default="empty",
        description="ok | ocr_fallback | rate_limited | unavailable | empty | skipped",
    )
    vision_message: str = Field(
        default="",
        description="User-facing hint when vision is degraded (quota, fallback, etc.)",
    )
    processing_time_ms: float = Field(default=0.0, ge=0.0)
    models: AnalyzeModelsInfo = Field(default_factory=AnalyzeModelsInfo)
