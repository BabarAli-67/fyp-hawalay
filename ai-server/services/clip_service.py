"""Embedding generation via Google Gemini.

File named clip_service for backward compatibility.
Produces 512-d vectors (truncated from Gemini 3072-d).
"""

from __future__ import annotations

import asyncio
import logging
from io import BytesIO
from typing import Any

import numpy as np
from google.genai import Client, types
from PIL import Image

from config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_EMBEDDING_MODEL = "gemini-embedding-2"
GEMINI_NATIVE_EMBEDDING_DIM = 3072
# MongoDB / Express matching pipeline expects 512 floats (legacy API dimension name).
MATCHING_EMBEDDING_DIM = 512
CLIP_EMBEDDING_DIM = MATCHING_EMBEDDING_DIM
STRIDE_SAMPLE_STEP = 6  # 3072 / 6 = 512 fallback when API returns full-d vectors


def l2_normalize(vec: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(vec)
    if norm == 0:
        return vec
    return vec / norm


def _zero_embedding() -> tuple[list[float], bool]:
    return [0.0] * MATCHING_EMBEDDING_DIM, False


def _embed_content_config() -> types.EmbedContentConfig:
    """Request learned 512-d reduction from Gemini (MRL) instead of local truncation."""
    return types.EmbedContentConfig(output_dimensionality=MATCHING_EMBEDDING_DIM)


def _extract_embedding_values(response: Any) -> list[float] | None:
    if not response or not getattr(response, "embeddings", None):
        return None
    embedding = response.embeddings[0]
    values = getattr(embedding, "values", None)
    if values is None:
        return None
    return [float(v) for v in values]


def _to_matching_vector(values: list[float]) -> list[float]:
    """
    Gemini native: 3072-d. Stored: 512-d via API ``output_dimensionality`` (preferred).

    Fallback when the API returns a longer vector: stride-sample ``full[::6][:512]``
    instead of head truncation. Re-embed with a new approach requires a batch job
    on existing items.
    """
    arr = np.asarray(values, dtype=np.float32).flatten()
    if arr.size == 0:
        return [0.0] * MATCHING_EMBEDDING_DIM

    if arr.size > MATCHING_EMBEDDING_DIM:
        logger.warning(
            "Gemini embedding length %d > %d; using stride fallback [::%d][:512]",
            arr.size,
            MATCHING_EMBEDDING_DIM,
            STRIDE_SAMPLE_STEP,
        )
        arr = arr[::STRIDE_SAMPLE_STEP][:MATCHING_EMBEDDING_DIM]
    elif arr.size < MATCHING_EMBEDDING_DIM:
        out = np.zeros(MATCHING_EMBEDDING_DIM, dtype=np.float32)
        out[: int(arr.size)] = arr
        arr = out

    arr = l2_normalize(arr)
    if arr.size != MATCHING_EMBEDDING_DIM:
        logger.warning("Embedding coercion produced dim %d (expected %d)", arr.size, MATCHING_EMBEDDING_DIM)
    return arr.astype(np.float32).tolist()


def fuse_vectors(
    img_vec: np.ndarray | None,
    text_vec: np.ndarray | None,
) -> np.ndarray | None:
    img = None if img_vec is None else np.asarray(img_vec, dtype=np.float32).reshape(-1)
    text = None if text_vec is None else np.asarray(text_vec, dtype=np.float32).reshape(-1)

    has_img = img is not None and img.size > 0 and np.linalg.norm(img) > 0
    has_text = text is not None and text.size > 0 and np.linalg.norm(text) > 0

    if has_img and has_text:
        return l2_normalize(0.5 * img + 0.5 * text)
    if has_text:
        return text
    if has_img:
        return img
    return None


def get_text_embedding(
    text: str,
    gemini_api_key: str = "",
    *,
    clip_url: str | None = None,
    embedding_model: str | None = None,
    client: Client | None = None,
) -> tuple[list[float], bool]:
    """
    Embed text with Gemini. Never raises; returns zero vector on failure.

    ``clip_url`` is ignored (kept for backward compatibility).
    """
    del gemini_api_key, clip_url

    if not text or not str(text).strip():
        logger.warning("Gemini text embedding: empty text; using zero vector")
        return _zero_embedding()

    if client is None:
        logger.warning("Gemini text embedding: GEMINI_API_KEY not configured; using zero vector")
        return _zero_embedding()

    settings = get_settings()
    model = (embedding_model or settings.gemini_embedding_model or DEFAULT_EMBEDDING_MODEL).strip()
    if model.startswith("models/"):
        model = model.removeprefix("models/")

    try:
        response = client.models.embed_content(
            model=model,
            contents=str(text).strip(),
            config=_embed_content_config(),
        )
        values = _extract_embedding_values(response)
        if not values:
            logger.warning("Gemini text embedding: empty response from %s", model)
            return _zero_embedding()
        return _to_matching_vector(values), True
    except Exception as exc:
        logger.warning("Gemini text embedding failed (%s): %s", model, exc)
        return _zero_embedding()


def get_image_embedding(
    image_bytes: bytes,
    gemini_api_key: str = "",
    *,
    clip_url: str | None = None,
    embedding_model: str | None = None,
    client: Client | None = None,
) -> tuple[list[float], bool]:
    """
    Embed image with Gemini. Never raises; returns zero vector on failure.

    ``clip_url`` is ignored (kept for backward compatibility).
    """
    del gemini_api_key, clip_url

    if not image_bytes:
        logger.warning("Gemini image embedding: empty image bytes; using zero vector")
        return _zero_embedding()

    if client is None:
        logger.warning("Gemini image embedding: GEMINI_API_KEY not configured; using zero vector")
        return _zero_embedding()

    settings = get_settings()
    model = (embedding_model or settings.gemini_embedding_model or DEFAULT_EMBEDDING_MODEL).strip()
    if model.startswith("models/"):
        model = model.removeprefix("models/")

    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        response = client.models.embed_content(
            model=model,
            contents=image,
            config=_embed_content_config(),
        )
        values = _extract_embedding_values(response)
        if not values:
            logger.warning("Gemini image embedding: empty response from %s", model)
            return _zero_embedding()
        return _to_matching_vector(values), True
    except Exception as exc:
        logger.warning("Gemini image embedding failed (%s): %s", model, exc)
        return _zero_embedding()


class ClipService:
    """Embeddings via Gemini (module id ``clip`` kept for API compatibility)."""

    MODULE = "clip"

    def __init__(
        self,
        *,
        model_id: str | None = None,
        gemini_api_key: str = "",
        client: Client | None = None,
    ) -> None:
        self._model_id = (
            model_id or get_settings().gemini_embedding_model or DEFAULT_EMBEDDING_MODEL
        ).strip()
        self._gemini_api_key = gemini_api_key
        self._client = client

    @property
    def clip_url(self) -> str:
        """Legacy alias — not used with Gemini."""
        return f"gemini://{self._model_id}"

    @property
    def status(self) -> dict[str, Any]:
        configured = bool(get_settings().gemini_api_key.strip() or self._gemini_api_key.strip())
        return {
            "ready": configured,
            "module": self.MODULE,
            "provider": "google_gemini",
            "message": (
                "Gemini embedding API configured"
                if configured
                else "GEMINI_API_KEY not set; embeddings unavailable"
            ),
            "model_id": self._model_id,
            "embedding_dim": MATCHING_EMBEDDING_DIM,
            "gemini_configured": configured,
            "native_embedding_dim": GEMINI_NATIVE_EMBEDDING_DIM,
            "reduction_method": "api_output_dimensionality",
            "inference_url": "https://generativelanguage.googleapis.com",
        }

    async def embed_text(self, text: str) -> dict[str, Any]:
        vector, ok = await asyncio.to_thread(
            get_text_embedding,
            text,
            embedding_model=self._model_id,
            client=self._client,
        )
        return self._embedding_payload(vector, input_type="text", embedding_ok=ok)

    async def embed_image(self, image_bytes: bytes) -> dict[str, Any]:
        vector, ok = await asyncio.to_thread(
            get_image_embedding,
            image_bytes,
            embedding_model=self._model_id,
            client=self._client,
        )
        return self._embedding_payload(vector, input_type="image", embedding_ok=ok)

    def _embedding_payload(
        self,
        vector: list[float],
        *,
        input_type: str,
        embedding_ok: bool,
    ) -> dict[str, Any]:
        return {
            "status": "success" if embedding_ok else "degraded",
            "module": self.MODULE,
            "model_id": self._model_id,
            "input_type": input_type,
            "dimensions": len(vector),
            "embedding_vector": vector,
            "embedding_ok": embedding_ok,
        }
