"""Unified inference contract for local and API-backed AI providers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable


@dataclass
class InferenceInput:
    """Unified input for any inference provider."""

    image_bytes: bytes | None = None
    text: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class InferenceOutput:
    """Unified output from any inference provider."""

    success: bool
    result: dict[str, Any]
    confidence: float = 0.0
    processing_time_ms: float = 0.0
    model_version: str = ""
    error: str | None = None


@runtime_checkable
class InferenceProvider(Protocol):
    """
    Structural protocol for all AI model providers.

    LOCAL models: implement predict() with asyncio.to_thread + semaphore lock
    API models: implement predict() with httpx async client + retry

    All providers must NEVER raise from predict() — return InferenceOutput(
    success=False, result={}, error="...") on failure.
    """

    name: str
    version: str

    async def predict(self, input: InferenceInput) -> InferenceOutput: ...

    def status(self) -> dict[str, Any]: ...
