"""Retry helpers for Google Gemini transient failures (429 / 5xx)."""

from __future__ import annotations

import logging
import re
import time
from typing import Any

logger = logging.getLogger(__name__)

TRANSIENT_HTTP_STATUSES = frozenset({429, 500, 502, 503, 504})


def is_rate_limit_error(exc: BaseException) -> bool:
    message = str(exc).lower()
    return (
        "429" in message
        or "resource_exhausted" in message
        or "quota exceeded" in message
        or "too many requests" in message
    )


def extract_http_status(exc: BaseException) -> int | None:
    for attr in ("status_code", "code"):
        value = getattr(exc, attr, None)
        if isinstance(value, int):
            return value
    match = re.search(r"\b(429|500|502|503|504)\b", str(exc))
    if match:
        return int(match.group(1))
    return None


def is_transient_error(exc: BaseException) -> bool:
    """True for rate limits and retryable server/gateway errors."""
    if is_rate_limit_error(exc):
        return True
    status = extract_http_status(exc)
    if status in TRANSIENT_HTTP_STATUSES:
        return True
    message = str(exc).lower()
    return any(
        token in message
        for token in (
            "503",
            "502",
            "500",
            "504",
            "unavailable",
            "internal error",
            "bad gateway",
            "gateway timeout",
            "service unavailable",
        )
    )


def retry_delay_seconds(exc: BaseException, default: float = 20.0) -> float:
    match = re.search(r"retry in (\d+(?:\.\d+)?)\s*s", str(exc), re.IGNORECASE)
    if match:
        return min(float(match.group(1)) + 1.0, 60.0)
    return default


def exponential_backoff_seconds(attempt_index: int, exc: BaseException | None = None) -> float:
    """
    Backoff before the next HTTP attempt.

    ``attempt_index`` is 0-based (0 → wait ~2s, 1 → ~4s, 2 → ~8s, capped at 30s).
    Rate-limit responses honour Retry-After style hints when present.
    """
    if exc is not None and is_rate_limit_error(exc):
        return retry_delay_seconds(exc)
    return min(2.0 ** (attempt_index + 1), 30.0)


def extract_response_text(response: Any) -> str:
    """
    Extract the full model text from a Gemini generateContent response.

    Uses ``response.text`` when available; otherwise concatenates all text parts
    from candidates (avoids silently dropping multi-part responses).
    """
    if response is None:
        return ""

    direct = getattr(response, "text", None)
    if direct is not None:
        text = str(direct).strip()
        if text:
            return text

    chunks: list[str] = []
    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        if content is None:
            continue
        for part in getattr(content, "parts", None) or []:
            part_text = getattr(part, "text", None)
            if part_text:
                chunks.append(str(part_text))
    return "\n".join(chunks).strip()


def log_response_metadata(response: Any, *, operation: str) -> None:
    """Log finish reasons and safety metadata when the SDK exposes them."""
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        logger.info("[gemini] response metadata operation=%s candidates=0", operation)
        return

    for index, candidate in enumerate(candidates):
        finish = getattr(candidate, "finish_reason", None)
        safety = getattr(candidate, "safety_ratings", None)
        logger.info(
            "[gemini] response metadata operation=%s candidate=%d finish_reason=%s safety=%s",
            operation,
            index,
            finish,
            safety,
        )


def generate_content_with_retry(
    client: Any,
    *,
    model: str,
    contents: Any,
    config: Any | None = None,
    max_attempts: int = 3,
    operation: str = "generate_content",
) -> Any:
    """Call Gemini generate_content with retries on 429 and 5xx errors."""
    last_exc: BaseException | None = None
    for attempt in range(max_attempts):
        attempt_no = attempt + 1
        logger.info(
            "[gemini] >>> HTTP generateContent start operation=%s model=%s attempt=%d/%d",
            operation,
            model,
            attempt_no,
            max_attempts,
        )
        try:
            if config is not None:
                response = client.models.generate_content(
                    model=model, contents=contents, config=config
                )
            else:
                response = client.models.generate_content(model=model, contents=contents)

            raw_text = extract_response_text(response)
            logger.info(
                "[gemini] <<< HTTP generateContent success operation=%s model=%s "
                "attempt=%d/%d response_chars=%d response_words=%d",
                operation,
                model,
                attempt_no,
                max_attempts,
                len(raw_text),
                len(raw_text.split()),
            )
            log_response_metadata(response, operation=operation)
            if raw_text:
                logger.debug(
                    "[gemini] raw response operation=%s preview=%r",
                    operation,
                    raw_text[:500],
                )
            return response
        except Exception as exc:
            last_exc = exc
            transient = is_transient_error(exc)
            logger.error(
                "[gemini] <<< HTTP generateContent FAILED operation=%s model=%s "
                "attempt=%d/%d error_type=%s http_status=%s transient=%s message=%s",
                operation,
                model,
                attempt_no,
                max_attempts,
                type(exc).__name__,
                extract_http_status(exc),
                transient,
                str(exc)[:500],
                exc_info=True,
            )
            if transient and attempt < max_attempts - 1:
                delay = exponential_backoff_seconds(attempt, exc)
                logger.warning(
                    "[gemini] transient error on %s — waiting %.1fs before retry (%d/%d)",
                    model,
                    delay,
                    attempt_no,
                    max_attempts,
                )
                time.sleep(delay)
                continue
            raise
    if last_exc:
        raise last_exc
    raise RuntimeError("generate_content_with_retry failed without exception")
