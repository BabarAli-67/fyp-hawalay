"""Schemas for object_v1 detection + Gemini caption pipeline."""

from __future__ import annotations

from pydantic import BaseModel, Field


class DetectedFeatureItem(BaseModel):
    """Single object_v1 detection enriched with report category."""

    class_name: str
    category: str | None = Field(
        default=None,
        description="Mapped report category from category_map.json",
    )
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    bbox: list[int] = Field(default_factory=list, description="[x1, y1, x2, y2] pixel coords")
    source: str = Field(default="object_v1")


class ObjectDetectResponse(BaseModel):
    """Unified object_v1 response: Keras detections + optional Gemini caption."""

    success: bool = False
    status: str = Field(
        default="skipped",
        description="success | degraded | unavailable | error | skipped",
    )
    model: str = "object_v1"
    version: str = "object-keras-v1"
    message: str | None = None

    detected_objects: list[DetectedFeatureItem] = Field(default_factory=list)
    detected_features: list[DetectedFeatureItem] = Field(
        default_factory=list,
        description="Highest-confidence detection per class_name",
    )
    suggested_category: str | None = Field(
        default=None,
        description="Report category from highest-confidence detection",
    )

    caption: str = ""
    caption_status: str = Field(
        default="skipped",
        description="success | degraded | unavailable | error | skipped",
    )
    caption_message: str | None = None

    detection_time_ms: float = Field(default=0.0, ge=0.0)
    caption_time_ms: float = Field(default=0.0, ge=0.0)
    processing_time_ms: float = Field(default=0.0, ge=0.0)

    detector_ready: bool = False
    gemini_ready: bool = False
