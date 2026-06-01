"""
Structured distinctive-feature bullets for lost-and-found reports.

Model-agnostic — uses ``analyze_context`` for OCR and object_v1 (and future models).
"""

from __future__ import annotations

import re
from typing import Any

from utils.analyze_context import (
    build_analyze_context,
    build_object_fallback_bullets,
    build_ocr_fallback_bullets,
)

REPORT_FEATURES_INSTRUCTION = """You extract distinctive feature bullets for Hawalay, a lost-and-found reporting platform.

Output 4–8 short bullet points that help someone identify and search for this item. Each bullet must be ONE line starting with "• " (bullet character + space).

Focus on concrete, visible traits for ANY lost item type:
- Colors and materials
- Brand names, logos, or visible text
- Physical parts (chip, screen, keyboard, zippers, slots, buttons)
- Shape or design cues
- Condition marks only if clearly visible
- Names or numbers ONLY when supported by extraction context

Do NOT write generic filler ("item in photo", "lost object") or duplicate bullets.
Use the image as primary evidence. Weave extraction hints naturally.

Output ONLY the bullet list — no title, no JSON, no preamble."""

MAX_FEATURE_BULLETS = 10


def compose_features_prompt(*, context: str = "") -> str:
    parts = [REPORT_FEATURES_INSTRUCTION]
    if context.strip():
        parts.append("\n\nContext from automated extraction:\n")
        parts.append(context.strip())
    parts.append("\n\nWrite the distinctive feature bullets now:")
    return "\n".join(parts)


def parse_feature_bullets(text: str) -> list[str]:
    if not text or not str(text).strip():
        return []

    bullets: list[str] = []
    seen: set[str] = set()

    for line in str(text).splitlines():
        cleaned = line.strip()
        if not cleaned:
            continue
        cleaned = re.sub(r"^[-*•]\s*", "", cleaned)
        cleaned = re.sub(r"^\d+[.)]\s*", "", cleaned).strip()
        if not cleaned or len(cleaned) < 4:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        bullets.append(cleaned)
        if len(bullets) >= MAX_FEATURE_BULLETS:
            break

    return bullets


def format_feature_bullets(bullets: list[str]) -> str:
    return "\n".join(f"• {b}" for b in bullets if b.strip())


def build_structured_features_fallback(
    *,
    ocr_payload: dict[str, Any] | None,
    detected_objects: list[dict[str, Any]] | None = None,
) -> list[str]:
    """Rule-based bullets when Gemini is unavailable (any extractor output)."""
    bullets = build_ocr_fallback_bullets(ocr_payload)
    seen = {b.lower() for b in bullets}
    for item in build_object_fallback_bullets(detected_objects):
        if item.lower() not in seen:
            bullets.append(item)
            seen.add(item.lower())
        if len(bullets) >= MAX_FEATURE_BULLETS:
            break
    return bullets[:MAX_FEATURE_BULLETS]


def resolve_feature_points(
    *,
    gemini_text: str,
    ocr_payload: dict[str, Any] | None,
    detected_objects: list[dict[str, Any]] | None,
) -> list[str]:
    bullets = parse_feature_bullets(gemini_text)
    if len(bullets) >= 3:
        return bullets

    fallback = build_structured_features_fallback(
        ocr_payload=ocr_payload,
        detected_objects=detected_objects,
    )
    seen = {b.lower() for b in bullets}
    for item in fallback:
        if item.lower() not in seen:
            bullets.append(item)
            seen.add(item.lower())
        if len(bullets) >= MAX_FEATURE_BULLETS:
            break
    return bullets


def build_features_context(
    *,
    category: str = "",
    location: str = "",
    title: str = "",
    user_description: str = "",
    ocr_payload: dict[str, Any] | None = None,
    detected_object_names: list[str] | None = None,
    detected_objects: list[dict[str, Any]] | None = None,
) -> str:
    return build_analyze_context(
        category=category,
        location=location,
        title=title,
        user_description=user_description,
        ocr_payload=ocr_payload,
        detected_object_names=detected_object_names,
        detected_objects=detected_objects,
    )
