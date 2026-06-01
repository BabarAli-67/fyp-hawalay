"""
Semantic matching — MongoDB hard filters + meaning-based vector similarity.

Each item stores one fingerprint built at submit from final text (description, features,
brand, colors, caption, OCR, AI bullets) and optional photo — not keyword matching.

Manual-only and AI-assisted reports can match when they describe the same object in
different words (e.g. "black wallet brown strip" vs "brown and black leather wallet").

Flow: Express saves item → POST /ai/match → filter candidates → similarity score → top matches.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np
from bson import ObjectId
from bson.errors import InvalidId

logger = logging.getLogger(__name__)

EARTH_RADIUS_METERS = 6_378_100.0

MATCH_CANDIDATE_PROJECTION = {
    "_id": 1,
    "embeddingVector": 1,
    "title": 1,
    "category": 1,
    "locationName": 1,
    "reportType": 1,
    "ownerId": 1,
    "imageFileId": 1,
}


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    va = np.asarray(a, dtype=np.float32).flatten()
    vb = np.asarray(b, dtype=np.float32).flatten()
    if va.size == 0 or vb.size == 0 or va.shape != vb.shape:
        return 0.0
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)


def _parse_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError) as exc:
        raise ValueError(f"Invalid item_id: {value}") from exc


def _normalize_date(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return None


class MatchingService:
    def __init__(
        self,
        db: Any,
        *,
        similarity_threshold: float = 0.70,
        match_radius_meters: float = 10000.0,
        date_window_days: int = 7,
        match_limit: int = 5,
        max_candidates: int = 100,
    ) -> None:
        self._db = db
        self._items = db["items"]
        self._similarity_threshold = similarity_threshold
        self._match_radius_meters = match_radius_meters
        self._date_window_days = date_window_days
        self._match_limit = match_limit
        self._max_candidates = max_candidates
        logger.info(
            f"Matching config: max_candidates={self._max_candidates}, "
            f"threshold={self._similarity_threshold}, limit={self._match_limit}"
        )

    @property
    def status(self) -> dict[str, Any]:
        return {
            "ready": self._db is not None,
            "module": "matching",
            "message": "MongoDB hard filters + embedding cosine similarity",
            "config": {
                "similarity_threshold": self._similarity_threshold,
                "match_radius_meters": self._match_radius_meters,
                "date_window_days": self._date_window_days,
                "match_limit": self._match_limit,
                "max_candidates": self._max_candidates,
            },
        }

    async def find_matches(
        self,
        *,
        item_id: str | None = None,
        embedding_vector: list[float] | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        """
        Find top candidate matches for a source item.

        Hard filters (from MongoDB):
          - opposite reportType (lost ↔ found)
          - active, not deleted
          - same category (when source has category)
          - geo radius around source location
          - date window
          - must have embedding vector

        Soft score: cosine similarity >= threshold.
        """
        result_limit = min(limit if limit is not None else self._match_limit, self._match_limit)

        if not item_id:
            return {
                "status": "error",
                "message": "item_id is required",
                "item_id": None,
                "matches": [],
            }

        source_oid = _parse_object_id(item_id)
        source = await self._items.find_one({"_id": source_oid, "isDeleted": {"$ne": True}})
        if not source:
            return {
                "status": "not_found",
                "message": "Source item not found",
                "item_id": item_id,
                "matches": [],
            }

        query_vector = embedding_vector or source.get("embeddingVector")
        if not query_vector or not isinstance(query_vector, list):
            logger.info("[matching] item %s has no embedding — skipping vector search", item_id)
            return {
                "status": "no_embedding",
                "message": "Source item has no embedding vector",
                "item_id": item_id,
                "matches": [],
            }

        opposite_type = "found" if source.get("reportType") == "lost" else "lost"
        source_date = _normalize_date(source.get("date")) or _normalize_date(source.get("createdAt"))
        date_filter: dict[str, Any] = {}
        if source_date:
            window = timedelta(days=self._date_window_days)
            date_filter = {
                "date": {
                    "$gte": source_date - window,
                    "$lte": source_date + window,
                }
            }

        mongo_query: dict[str, Any] = {
            "_id": {"$ne": source_oid},
            "reportType": opposite_type,
            "status": "active",
            "isDeleted": {"$ne": True},
            "embeddingVector": {"$exists": True, "$type": "array", "$ne": []},
            **date_filter,
        }

        category = source.get("category")
        if category:
            mongo_query["category"] = category
            logger.info(f"Matching with category filter: {category}")

        owner_id = source.get("ownerId")
        if owner_id is not None:
            mongo_query["ownerId"] = {"$ne": owner_id}

        coords = (source.get("location") or {}).get("coordinates")
        if isinstance(coords, list) and len(coords) == 2:
            lng, lat = float(coords[0]), float(coords[1])
            radius_radians = self._match_radius_meters / EARTH_RADIUS_METERS
            mongo_query["location"] = {
                "$geoWithin": {
                    "$centerSphere": [[lng, lat], radius_radians],
                }
            }

        cursor = self._items.find(mongo_query, MATCH_CANDIDATE_PROJECTION)

        candidates = await cursor.to_list(length=self._max_candidates)
        logger.info(
            "[matching] item=%s opposite=%s candidates_after_hard_filters=%d",
            item_id,
            opposite_type,
            len(candidates),
        )

        scored: list[dict[str, Any]] = []
        for doc in candidates:
            candidate_vec = doc.get("embeddingVector")
            if not candidate_vec:
                continue
            score = _cosine_similarity(query_vector, candidate_vec)
            if score < self._similarity_threshold:
                continue
            scored.append(
                {
                    "item_id": str(doc["_id"]),
                    "score": round(score, 4),
                    "title": doc.get("title"),
                    "category": doc.get("category"),
                    "reportType": doc.get("reportType"),
                    "owner_id": str(doc["ownerId"]) if doc.get("ownerId") else None,
                    "location_name": doc.get("locationName"),
                    "description": doc.get("description"),
                    "caption": doc.get("caption"),
                    "has_image": bool(doc.get("imageFileId")),
                }
            )

        scored.sort(key=lambda m: m["score"], reverse=True)
        top = scored[:result_limit]

        return {
            "status": "success",
            "module": "matching",
            "item_id": item_id,
            "source_report_type": source.get("reportType"),
            "candidate_count": len(candidates),
            "match_count": len(top),
            "matches": top,
            "limit": result_limit,
        }
