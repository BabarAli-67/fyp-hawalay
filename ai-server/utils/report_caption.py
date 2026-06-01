"""
Lost-and-found report descriptions via Gemini Vision.

Detailed, human, picture-in-your-mind prose — not short labels or OCR dumps.
"""

from __future__ import annotations

import re
from typing import Any

from utils.analyze_context import (
    DOCUMENT_TYPE_HINTS,
    FIELD_LABEL_OVERRIDES,
    build_analyze_context,
    is_full_card_number,
    iter_ocr_fields,
)

FIELD_HINT_LABELS = FIELD_LABEL_OVERRIDES

# Target: rich enough to imagine the object; still sounds like a person wrote it.
MIN_CAPTION_WORDS = 12
MIN_CAPTION_CHARS = 45

REPORT_CAPTION_INSTRUCTION = """You help people write lost-and-found item descriptions for Hawalay.

Look carefully at the photo. Write so a stranger can PICTURE the item in their mind.

LENGTH & STYLE:
- 2–4 natural sentences, about 50–120 words (do not stop at one short line)
- Conversational English — like explaining the item to a friend at a help desk
- NOT robotic, NOT a bullet list, NOT copied field labels from background notes

INCLUDE every detail you can honestly see (skip only if not visible):
- What it is (keys, laptop, wallet, phone, bag, ID card, watch, etc.)
- Colors and materials (black, brown leather, silver metal, transparent cover…)
- Brand or logo if visible (Dell, Samsung, Meezan Bank, Nike…)
- Condition in plain words (good condition, scratched, cracked screen, worn corners, clean, old, damaged…)
- Notable parts (EMV chip, keyboard, card slots, keychain, charger, straps, chains…)
- Accessories attached (teddy on keychain, case, lanyard, stickers…)
- Owner name on cards/IDs only when clearly shown — woven into a full sentence

GOOD examples (depth + human voice):
- "Three keys on a keychain, including one black key and two metallic keys, with a small brown teddy accessory on the ring."
- "Silver Dell laptop in used condition with visible scratches near the edges and a black keyboard."
- "Brown leather wallet with multiple card slots and slightly worn corners."
- "Black Samsung smartphone with a cracked screen and a transparent back cover."
- "Green national ID card belonging to Muhammad Ali with personal details visible; edges look slightly worn."
- "Blue Meezan Bank debit card belonging to Ahmad Raza, chip on the front, overall good condition."

BAD examples (too short, generic, or machine-like):
- "Keys found"
- "Wallet found"
- "Black wallet"
- "Muhammad Ali"
- "Cardholder name detected: Ahmad Raza"
- "Item in image"

RULES:
- Photo is primary evidence; background notes are hints only — never paste them verbatim
- Do NOT use "detected", "extracted", "visible", "OCR", or semicolon-separated field lists
- Do NOT invent brands, damage, or accessories you cannot see
- Output ONLY the description — no title, no quotes, no preamble"""

REPORT_CAPTION_RETRY_SUFFIX = """
Your last answer was too short, too generic, too robotic, or missing obvious visual detail.
Rewrite with 2–4 fuller sentences: colors, material, brand (if seen), condition, and any accessories or unique marks — so the reader can imagine the object clearly."""

REPORT_CAPTION_DETAIL_RETRY_SUFFIX = """
Still not enough detail. Describe the object as if helping someone search a busy lost-and-found room: type, color, brand, wear/damage, and anything attached or distinctive — in natural full sentences."""

CAPTION_CONTEXT_PREAMBLE = """Background notes (use to inform your writing — do NOT copy labels or bullet formatting into your answer):"""


def build_caption_context_from_analyze(
    *,
    category: str = "",
    location: str = "",
    title: str = "",
    user_description: str = "",
    ocr_payload: dict[str, Any] | None = None,
    detected_object_names: list[str] | None = None,
    detected_objects: list[dict[str, Any]] | None = None,
) -> str:
    parts: list[str] = []

    manual = user_description.strip()
    if manual:
        parts.append(
            "Reporter's own draft (match their casual tone, but include MORE visual detail from the photo "
            "than this draft if the image shows more):\n"
            f'"{manual}"'
        )

    internal = build_analyze_context(
        category=category,
        location=location,
        title=title,
        user_description="",
        ocr_payload=ocr_payload,
        detected_object_names=detected_object_names,
        detected_objects=detected_objects,
    )
    if internal:
        parts.append(f"{CAPTION_CONTEXT_PREAMBLE}\n{internal}")

    if detected_object_names:
        names = ", ".join(n.replace("_", " ") for n in detected_object_names if n)
        parts.append(
            f"Likely object type from detector: {names}. "
            "Describe that object richly (not just the label)."
        )

    return "\n\n".join(parts).strip()


def compose_caption_prompt(
    *,
    context: str = "",
    retry: bool = False,
    detail_retry: bool = False,
) -> str:
    parts = [REPORT_CAPTION_INSTRUCTION]
    if context.strip():
        parts.append("\n\n")
        parts.append(context.strip())
    if detail_retry:
        parts.append(REPORT_CAPTION_DETAIL_RETRY_SUFFIX)
    elif retry:
        parts.append(REPORT_CAPTION_RETRY_SUFFIX)
    parts.append("\n\nWrite the lost-and-found description now:")
    return "\n".join(parts)


def _caption_matches_single_extracted_value(caption: str, ocr_payload: dict[str, Any] | None) -> bool:
    text = caption.strip().lower()
    if not text:
        return True
    for row in iter_ocr_fields(ocr_payload):
        value = (row.get("value") or "").strip().lower()
        if not value:
            continue
        if text == value or (len(text.split()) <= 5 and (text == value or text in value or value in text)):
            return True
    return False


def is_generic_report_caption(caption: str) -> bool:
    """One-liners like 'Keys found' or 'Black wallet' with no real detail."""
    text = (caption or "").strip()
    lower = text.lower().rstrip(".")
    words = lower.split()

    if len(words) <= 3:
        return True

    generic_exact = {
        "keys found",
        "key found",
        "wallet found",
        "phone found",
        "mobile found",
        "laptop found",
        "bag found",
        "watch found",
        "card found",
        "item found",
        "object found",
        "found item",
        "lost item",
        "keys lost",
        "wallet lost",
    }
    if lower in generic_exact:
        return True

    if len(words) <= 5 and lower.endswith((" found", " lost")):
        return True

    # "Black wallet" / "Silver laptop" — only type + one adjective, no condition/features
    if len(words) <= 4 and not any(
        token in lower
        for token in (
            "with",
            "and",
            "belonging",
            "condition",
            "scratch",
            "worn",
            "crack",
            "chip",
            "slot",
            "chain",
            "keyboard",
            "screen",
            "leather",
            "metal",
            "brand",
        )
    ):
        return True

    return False


def is_robotic_report_caption(caption: str) -> bool:
    text = (caption or "").strip().lower()
    if not text:
        return True

    robotic_markers = (
        "detected",
        "extracted",
        " automated",
        "ocr",
        "cardholder name",
        "expiry date",
        "partially visible",
        "branding visible",
        "identified in image",
        "name printed on",
        "text extraction",
        "object detector",
    )
    if any(marker in text for marker in robotic_markers):
        return True

    if re.search(r"\b\w+\s*:\s*\w+", caption) and ";" in caption:
        return True

    if caption.count(":") >= 2:
        return True

    return False


def is_weak_report_caption(caption: str, ocr_payload: dict[str, Any] | None = None) -> bool:
    text = (caption or "").strip()
    words = text.split()

    if len(text) < MIN_CAPTION_CHARS or len(words) < MIN_CAPTION_WORDS:
        return True

    if is_robotic_report_caption(text):
        return True

    if is_generic_report_caption(text):
        return True

    if _caption_matches_single_extracted_value(text, ocr_payload):
        return True

    listing_nouns = (
        "card",
        "id",
        "identity",
        "laptop",
        "computer",
        "phone",
        "mobile",
        "smartphone",
        "wallet",
        "bag",
        "backpack",
        "watch",
        "keys",
        "key",
        "keychain",
        "document",
        "bank",
        "debit",
        "credit",
        "chip",
        "screen",
        "leather",
        "metal",
        "plastic",
        "glasses",
        "bottle",
        "book",
        "umbrella",
        "headphone",
        "charger",
        "teddy",
        "samsung",
        "dell",
        "found",
        "lost",
    )
    lower = text.lower()
    if len(words) <= 8 and not any(noun in lower for noun in listing_nouns):
        return True

    return False


def build_ocr_fallback_caption(ocr_payload: dict[str, Any] | None) -> str:
    """
    Human-style description when Gemini vision is unavailable (quota/outage).

    Uses OCR fields only — natural sentences, not raw label dumps.
    """
    if not ocr_payload:
        return ""

    rows = iter_ocr_fields(ocr_payload)
    if not rows:
        return ""

    by_key = {row["key"]: row["value"] for row in rows if row.get("value")}
    doc_type = str(ocr_payload.get("document_type") or "unknown").strip().lower()

    brand = by_key.get("card_brand")
    holder = by_key.get("cardholder_name")
    expiry = by_key.get("expiry_date")
    has_number = bool(by_key.get("card_number"))

    if doc_type in ("credit_card", "cnic") or brand or holder:
        bank = brand or "Bank"
        kind = "national ID card" if doc_type == "cnic" else "debit card"
        parts = [f"{bank} {kind}".replace("  ", " ").strip()]
        if holder:
            parts.append(f"belonging to {holder}")
        if has_number:
            card_num = by_key.get("card_number")
            if is_full_card_number(card_num):
                parts.append("with the full card number visible")
            else:
                parts.append("with card number partially visible")
        if expiry:
            parts.append(f"expiry {expiry}")
        parts.append("overall condition looks acceptable from the photo")
        return " ".join(parts).strip() + "."

    labels = [row["label"] for row in rows[:4]]
    values = [row["value"] for row in rows[:4]]
    if labels:
        summary = ", ".join(f"{lab.lower()}: {val}" for lab, val in zip(labels, values))
        return f"Document or card in the image with {summary}."
    return ""


def normalize_caption_output(caption: str) -> str:
    text = (caption or "").strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in '"\'':
        text = text[1:-1].strip()
    if text.lower().startswith("description:"):
        text = text.split(":", 1)[-1].strip()
    return text
