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

# Ideal quality (early-exit when a pass meets this bar).
MIN_CAPTION_WORDS = 25
MIN_CAPTION_CHARS = 80
MIN_CAPTION_SENTENCES = 2

# Minimum bar for keeping a Gemini caption instead of OCR fallback.
MIN_USABLE_CAPTION_WORDS = 8
MIN_USABLE_CAPTION_CHARS = 40

# Trailing fragments that indicate the model stopped mid-sentence.
INCOMPLETE_TRAILING_PATTERNS: tuple[str, ...] = (
    r"\bfeaturing\s+a?\s*$",
    r"\bwith\s+a?\s*$",
    r"\bshowing\s+a?\s*$",
    r"\bcontaining\s+a?\s*$",
    r"\bincluding\s+a?\s*$",
    r"\bdisplaying\s+a?\s*$",
    r"\bhas\s+a?\s*$",
    r"\bhave\s+a?\s*$",
    r"\bis\s+a?\s*$",
    r"\bare\s+a?\s*$",
    r"\bthat\s+has\s+a?\s*$",
    r"\band\s+a?\s*$",
    r"\bor\s+a?\s*$",
    r",\s*$",
    r":\s*$",
    r";\s*$",
    r"\b(a|an|the|in|on|of|for|to|from|at|by|as)\s*$",
)

REPORT_CAPTION_INSTRUCTION = """You are a professional lost-and-found report writer for Hawalay.

Study the photo carefully and write a clear, complete description a stranger can use to recognize the item.

LENGTH & STYLE (mandatory):
- Write exactly 2–4 COMPLETE sentences, between 50 and 100 words total
- Use professional, natural English — polite and specific, not robotic
- Every sentence must be grammatically finished — NEVER stop mid-phrase
- The final sentence MUST end with a period (.)
- Do NOT use bullet points, labels, colons lists, or field names from background notes

INCLUDE every detail you can honestly see:
- Item type (wallet, phone, keys, bank card, ID card, bag, laptop, etc.)
- Colors, materials, patterns, and visible branding
- Condition (excellent, good, worn, scratched, cracked, clean, etc.)
- Distinctive parts (EMV chip, magnetic stripe, keychain, slots, screen, logo placement)
- Owner name on cards/IDs only when clearly printed — weave it into a full sentence

GOOD example (bank card — note the complete ending):
"This is a dark blue HBL World debit card from Habib Bank Limited, issued to Ayesha Khan with a gold EMV chip on the front. The card has a subtle diagonal striped pattern across the face and standard payment network branding. It appears to be in excellent condition with no visible scratches or damage on the surface."

OTHER good examples:
- "Three keys on a metal keychain, including one black key and two silver keys, with a small brown teddy bear charm attached to the ring."
- "Silver Dell laptop in used condition with light scratches along the lid edges and a black backlit keyboard."

BAD examples (never output these):
- "Dark blue bank card featuring a"  (incomplete)
- "Card found" / "Black wallet" / "Item in image"
- "Cardholder name: Ahmad Raza; Expiry: 11/28"  (field dump)

RULES:
- The photo is primary evidence; background notes are hints only
- Do NOT use words: detected, extracted, OCR, automated
- Do NOT invent details you cannot see
- Output ONLY the description paragraph — no title, no quotes, no preamble"""

REPORT_CAPTION_RETRY_SUFFIX = """
Your previous answer was too short, incomplete, or ended mid-sentence.
Rewrite as 2–4 FULL sentences (50–100 words). Describe colors, branding, condition, and distinctive features.
Finish the last sentence completely and end with a period. Do not trail off with phrases like "featuring a" or "with a"."""

REPORT_CAPTION_DETAIL_RETRY_SUFFIX = """
Your previous answer still did not meet requirements.
Write a polished lost-and-found paragraph (50–100 words, 2–4 sentences) covering item type, color, brand/logo, visible text or chip, and overall condition.
Every sentence must be complete. End the final sentence with a period."""

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


def ends_with_proper_punctuation(caption: str) -> bool:
    """True when the description ends with sentence-ending punctuation."""
    text = (caption or "").strip()
    if not text:
        return False
    return bool(re.search(r'[.!?]["\')]*\s*$', text))


def count_complete_sentences(caption: str) -> int:
    """Count sentence-like segments ending with . ! or ?"""
    text = (caption or "").strip()
    if not text:
        return 0
    chunks = re.split(r"(?<=[.!?])\s+", text)
    return sum(1 for chunk in chunks if chunk.strip())


def is_incomplete_report_caption(caption: str) -> bool:
    """Detect truncated or mid-phrase endings."""
    text = (caption or "").strip()
    if not text:
        return True

    lower = text.lower()
    for pattern in INCOMPLETE_TRAILING_PATTERNS:
        if re.search(pattern, lower, flags=re.IGNORECASE):
            return True

    if not ends_with_proper_punctuation(text):
        return True

    if count_complete_sentences(text) < MIN_CAPTION_SENTENCES:
        return True

    return False


def explain_caption_validation(
    caption: str,
    ocr_payload: dict[str, Any] | None = None,
) -> list[str]:
    """Human-readable reasons why a caption fails ideal or usable quality checks."""
    text = (caption or "").strip()
    reasons: list[str] = []

    if not text:
        return ["empty_caption"]

    words = text.split()
    if len(text) < MIN_USABLE_CAPTION_CHARS:
        reasons.append(f"below_usable_chars:{len(text)}<{MIN_USABLE_CAPTION_CHARS}")
    if len(words) < MIN_USABLE_CAPTION_WORDS:
        reasons.append(f"below_usable_words:{len(words)}<{MIN_USABLE_CAPTION_WORDS}")
    if len(text) < MIN_CAPTION_CHARS:
        reasons.append(f"below_ideal_chars:{len(text)}<{MIN_CAPTION_CHARS}")
    if len(words) < MIN_CAPTION_WORDS:
        reasons.append(f"below_ideal_words:{len(words)}<{MIN_CAPTION_WORDS}")

    if is_incomplete_report_caption(text):
        if not ends_with_proper_punctuation(text):
            reasons.append("missing_terminal_punctuation")
        for pattern in INCOMPLETE_TRAILING_PATTERNS:
            if re.search(pattern, text.lower(), flags=re.IGNORECASE):
                reasons.append(f"incomplete_trailing:{pattern}")
                break
        if count_complete_sentences(text) < MIN_CAPTION_SENTENCES:
            reasons.append(
                f"insufficient_sentences:{count_complete_sentences(text)}<{MIN_CAPTION_SENTENCES}",
            )

    if is_robotic_report_caption(text):
        reasons.append("robotic_markers")
    if is_generic_report_caption(text):
        reasons.append("generic_phrase")
    if _caption_matches_single_extracted_value(text, ocr_payload):
        reasons.append("matches_single_ocr_value")

    return reasons


def is_unusable_caption(caption: str, ocr_payload: dict[str, Any] | None = None) -> bool:
    """
    True only when Gemini output should be discarded in favour of OCR fallback.

    Usable Gemini captions are kept even if they fail ideal length/completeness checks.
    """
    text = (caption or "").strip()
    if not text:
        return True

    words = text.split()
    if len(words) < MIN_USABLE_CAPTION_WORDS or len(text) < MIN_USABLE_CAPTION_CHARS:
        return True

    if is_robotic_report_caption(text):
        return True

    if is_generic_report_caption(text) and len(words) <= 5:
        return True

    if _caption_matches_single_extracted_value(text, ocr_payload):
        return True

    return False


def caption_quality_score(caption: str, ocr_payload: dict[str, Any] | None = None) -> tuple[int, int, int]:
    """Sort key for picking the best Gemini attempt (higher is better)."""
    text = (caption or "").strip()
    usable = 0 if is_unusable_caption(text, ocr_payload) else 1
    ideal = 0 if is_weak_report_caption(text, ocr_payload) else 1
    return (usable, ideal, len(text.split()))


def is_valid_report_caption(caption: str, ocr_payload: dict[str, Any] | None = None) -> bool:
    """True when a caption meets ideal quality (early-exit for multi-pass generation)."""
    return not is_weak_report_caption(caption, ocr_payload)


def is_weak_report_caption(caption: str, ocr_payload: dict[str, Any] | None = None) -> bool:
    text = (caption or "").strip()
    words = text.split()

    if len(text) < MIN_CAPTION_CHARS or len(words) < MIN_CAPTION_WORDS:
        return True

    if is_incomplete_report_caption(text):
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


def build_structured_fallback_caption(
    ocr_payload: dict[str, Any] | None = None,
    *,
    detected_object_names: list[str] | None = None,
    category: str = "",
) -> str:
    """
    Safe, complete description from detected attributes when Gemini output is unusable.
    """
    ocr_caption = build_ocr_fallback_caption(ocr_payload)
    if ocr_caption and is_valid_report_caption(ocr_caption, ocr_payload):
        return ocr_caption

    object_label = ""
    if detected_object_names:
        cleaned = [name.replace("_", " ").strip() for name in detected_object_names if name]
        if cleaned:
            object_label = cleaned[0]

    category_label = (category or "").strip()
    doc_type = ""
    brand = ""
    holder = ""
    if ocr_payload:
        doc_type = str(ocr_payload.get("document_type") or "").strip().lower()
        rows = iter_ocr_fields(ocr_payload)
        by_key = {row["key"]: row["value"] for row in rows if row.get("value")}
        brand = by_key.get("card_brand") or ""
        holder = by_key.get("cardholder_name") or ""

    item_kind = object_label or category_label or DOCUMENT_TYPE_HINTS.get(doc_type, "item")
    if doc_type == "credit_card":
        item_kind = f"{brand or 'bank'} debit card".strip()
    elif doc_type == "cnic":
        item_kind = "national ID card"

    sentences: list[str] = []
    lead = f"This appears to be a {item_kind} shown in the uploaded photo."
    sentences.append(lead)

    if brand and brand.lower() not in item_kind.lower():
        sentences.append(f"The visible branding reads {brand}.")
    if holder:
        sentences.append(f"The name {holder} is printed on it.")
    sentences.append("Overall condition looks acceptable based on what is visible in the image.")

    caption = " ".join(sentences).strip()
    if not ends_with_proper_punctuation(caption):
        caption += "."
    return caption


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
        lead = " ".join(parts).strip()
        if not lead.endswith("."):
            lead += "."
        return f"{lead} Overall condition looks acceptable from the photo."

    labels = [row["label"] for row in rows[:4]]
    values = [row["value"] for row in rows[:4]]
    if labels:
        summary = ", ".join(f"{lab.lower()}: {val}" for lab, val in zip(labels, values))
        return (
            f"Document or card in the image with {summary}. "
            "It appears to be in acceptable condition based on the photo."
        )
    return ""


def normalize_caption_output(caption: str) -> str:
    text = (caption or "").strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in '"\'':
        text = text[1:-1].strip()
    for prefix in ("description:", "caption:", "answer:"):
        if text.lower().startswith(prefix):
            text = text.split(":", 1)[-1].strip()
            break
    # Collapse internal whitespace while preserving sentence boundaries.
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text).strip()
    return text
