"""Retry helpers for Google Gemini rate limits (429 / quota)."""

from __future__ import annotations

import logging
import re
import time
from typing import Any

logger = logging.getLogger(__name__)


def is_rate_limit_error(exc: BaseException) -> bool:
    message = str(exc).lower()
    return (
        "429" in message
        or "resource_exhausted" in message
        or "quota exceeded" in message
        or "too many requests" in message
    )


def retry_delay_seconds(exc: BaseException, default: float = 20.0) -> float:
    match = re.search(r"retry in (\d+(?:\.\d+)?)\s*s", str(exc), re.IGNORECASE)
    if match:
        return min(float(match.group(1)) + 1.0, 60.0)
    return default


def generate_content_with_retry(
    client: Any,
    *,
    model: str,
    contents: Any,
    config: Any | None = None,
    max_attempts: int = 2,
    operation: str = "generate_content",
) -> Any:
    """Call Gemini generate_content; retry once after rate-limit delay."""
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
            text_len = len(str(getattr(response, "text", None) or ""))
            logger.info(
                "[gemini] <<< HTTP generateContent success operation=%s model=%s "
                "attempt=%d/%d response_chars=%d",
                operation,
                model,
                attempt_no,
                max_attempts,
                text_len,
            )
            return response
        except Exception as exc:
            last_exc = exc
            logger.error(
                "[gemini] <<< HTTP generateContent FAILED operation=%s model=%s "
                "attempt=%d/%d error_type=%s rate_limited=%s message=%s",
                operation,
                model,
                attempt_no,
                max_attempts,
                type(exc).__name__,
                is_rate_limit_error(exc),
                str(exc)[:500],
                exc_info=True,
            )
            if is_rate_limit_error(exc) and attempt < max_attempts - 1:
                delay = retry_delay_seconds(exc)
                logger.warning(
                    "[gemini] rate limit on %s — waiting %.0fs before retry (%d/%d)",
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
