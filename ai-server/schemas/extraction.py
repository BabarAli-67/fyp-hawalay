"""Generic extracted attributes from any analyze pipeline model."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ExtractedAttribute(BaseModel):
    """
    One extracted signal (OCR field, object class, future attribute).

    Reporting UI and Gemini prompts consume this without knowing the source model.
    """

    source: str = Field(description="Registry model id, e.g. card_ocr_v1, object_v1")
    key: str = Field(description="Machine key, e.g. card_brand or laptop")
    label: str = Field(description="Human-readable label")
    value: str | None = Field(default=None, description="Text value when applicable")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    bbox: list[int] | None = Field(default=None, description="Optional [x1,y1,x2,y2]")
