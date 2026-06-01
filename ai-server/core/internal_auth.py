"""Service-to-service authentication (Express → FastAPI)."""

from __future__ import annotations

from fastapi import Header, HTTPException

from config import get_settings


def verify_internal_secret(
    x_internal_secret: str | None = Header(default=None, alias="X-Internal-Secret"),
) -> None:
    """
    Require matching INTERNAL_SECRET when configured.

    Skips verification when the server has no secret set (local dev only).
    """
    settings = get_settings()
    expected = (settings.internal_secret or "").strip()
    if not expected:
        return

    provided = (x_internal_secret or "").strip()
    if provided != expected:
        raise HTTPException(status_code=401, detail="Invalid internal secret")
