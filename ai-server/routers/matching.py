from typing import Any

from fastapi import APIRouter, Depends

from core.internal_auth import verify_internal_secret
from dependencies import MatchingServiceDep
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/matching", tags=["matching"])


class MatchRequest(BaseModel):
    item_id: str | None = None
    embedding_vector: list[float] | None = None
    limit: int = Field(default=5, ge=1, le=50)


@router.get("/status")
async def matching_status(matching_service: MatchingServiceDep) -> dict:
    return matching_service.status


@router.post(
    "/search",
    dependencies=[Depends(verify_internal_secret)],
)
async def search_matches(body: MatchRequest, matching_service: MatchingServiceDep) -> dict[str, Any]:
    """Alias of ``POST /ai/match`` for modular router layout."""
    return await matching_service.find_matches(
        item_id=body.item_id,
        embedding_vector=body.embedding_vector,
        limit=body.limit,
    )
