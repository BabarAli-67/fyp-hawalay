"""Schemas for generic object detection (future 21-class model)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class DetectedObjectItem(BaseModel):
    """Single detection from an object detector."""

    class_name: str
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    bbox: list[int] = Field(default_factory=list, description="[x1, y1, x2, y2] pixel coords")


class ObjectDetectionResult(BaseModel):
    """Object detection block in analyze-image responses."""

    model: str = ""
    version: str = ""
    status: str = Field(
        default="skipped",
        description="success | skipped | unavailable | error",
    )
    ready: bool = False
    message: str | None = None
    detected_objects: list[DetectedObjectItem] = Field(default_factory=list)
    processing_time_ms: float = Field(default=0.0, ge=0.0)
