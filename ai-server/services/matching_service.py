"""
Semantic matching — MongoDB hard filters + meaning-based vector similarity.

Each item stores one fingerprint built at submit from final text (description, features,
brand, colors, caption, OCR, AI bullets) and optional photo — not keyword matching.

Manual-only and AI-assisted reports can match when they describe the same object in
different words (e.g. "black wallet brown strip" vs "brown and black leather wallet").

Flow: Express saves item → POST /ai/match → filter candidates → similarity score → top matches.

Candidates must pass the same-category, geo-radius, date, report-type, and active-status
rules before cosine similarity is calculated. Final ranking blends semantic similarity
with geospatial proximity so nearer pins outrank distant ones inside the radius.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np
from bson import ObjectId
from bson.errors import InvalidId

logger = logging.getLogger(__name__)

DEFAULT_CATEGORY_BONUS = 0.10
# How strongly map distance affects the displayed match percentage.
# 0.25 means identical location can lift a score by up to ~25 points vs the radius edge.
DEFAULT_LOCATION_WEIGHT = 0.25

MATCH_CANDIDATE_PROJECTION = {
    "_id": 1,
    "embeddingVector": 1,
    "title": 1,
    "category": 1,
    "userCategory": 1,
    "aiCategory": 1,
    "effectiveCategory": 1,
    "categoryMismatch": 1,
    "aiMetadata": 1,
    "detectedObjects": 1,
    "locationName": 1,
    "reportType": 1,
    "ownerId": 1,
    "imageFileId": 1,
    "distanceMeters": 1,
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


def _resolve_user_category(doc: dict[str, Any]) -> str | None:
    user = doc.get("userCategory")
    if user:
        return str(user)
    category = doc.get("category")
    return str(category) if category else None


def _resolve_ai_category(doc: dict[str, Any]) -> str | None:
    ai_cat = doc.get("aiCategory")
    if ai_cat:
        return str(ai_cat)
    meta = doc.get("aiMetadata") or {}
    suggested = meta.get("suggestedCategory")
    return str(suggested) if suggested else None


def _resolve_effective_category(doc: dict[str, Any]) -> str | None:
    """User-selected category wins; AI only when user category is absent."""
    user = doc.get("userCategory")
    if user:
        return str(user)
    effective = doc.get("effectiveCategory")
    if effective:
        return str(effective)
    ai_cat = _resolve_ai_category(doc)
    if ai_cat:
        return ai_cat
    category = doc.get("category")
    return str(category) if category else None


def _same_category_query(category: str) -> dict[str, Any]:
    """
    Match the persisted effective category, with fallbacks for legacy items that
    predate ``effectiveCategory`` / ``userCategory``.
    """
    return {
        "$or": [
            {"effectiveCategory": category},
            {
                "effectiveCategory": {"$exists": False},
                "userCategory": category,
            },
            {
                "effectiveCategory": {"$exists": False},
                "userCategory": {"$exists": False},
                "category": category,
            },
            # Mongoose may persist optional legacy fields as null.
            {
                "effectiveCategory": None,
                "userCategory": category,
            },
            {
                "effectiveCategory": None,
                "userCategory": None,
                "category": category,
            },
        ]
    }


def _category_match_bonus(
    source: dict[str, Any],
    candidate: dict[str, Any],
    *,
    bonus: float,
) -> tuple[float, bool]:
    """Return (bonus_score, had_mismatch) for logging."""
    bonus_score = 0.0
    src_user = _resolve_user_category(source)
    src_ai = _resolve_ai_category(source)
    cand_user = _resolve_user_category(candidate)
    cand_ai = _resolve_ai_category(candidate)

    if src_user and cand_user and src_user == cand_user:
        bonus_score += bonus
    if src_ai and cand_ai and src_ai == cand_ai:
        bonus_score += bonus

    src_effective = _resolve_effective_category(source)
    cand_effective = _resolve_effective_category(candidate)
    had_mismatch = bool(
        src_effective and cand_effective and src_effective != cand_effective
    )
    return bonus_score, had_mismatch


def _proximity_factor(distance_meters: float, match_radius_meters: float) -> float:
    """
    1.0 = same pin, 0.0 = at the outer $geoNear radius edge.

    Uses a squared falloff so mid-range pins drop faster than near-identical ones.
    """
    radius = max(float(match_radius_meters), 1.0)
    normalized = min(max(float(distance_meters), 0.0) / radius, 1.0)
    return float(max(0.0, 1.0 - (normalized ** 2)))


def _combine_match_score(
    base_score: float,
    *,
    distance_meters: float,
    match_radius_meters: float,
    location_weight: float,
    category_bonus: float = 0.0,
) -> tuple[float, float, float]:
    """
    Blend semantic cosine with geospatial proximity.

    Returns ``(final_score, proximity, location_contribution)``.
    """
    weight = min(max(float(location_weight), 0.0), 0.5)
    proximity = _proximity_factor(distance_meters, match_radius_meters)
    content_weight = 1.0 - weight
    location_contribution = weight * proximity
    blended = (content_weight * float(base_score)) + location_contribution
    final_score = round(min(max(blended + float(category_bonus), 0.0), 1.0), 4)
    return final_score, round(proximity, 4), round(location_contribution, 4)


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
        category_bonus: float = DEFAULT_CATEGORY_BONUS,
        location_weight: float = DEFAULT_LOCATION_WEIGHT,
    ) -> None:
        self._db = db
        self._items = db["items"]
        self._similarity_threshold = similarity_threshold
        self._match_radius_meters = match_radius_meters
        self._date_window_days = date_window_days
        self._match_limit = match_limit
        self._max_candidates = max_candidates
        self._category_bonus = category_bonus
        self._location_weight = location_weight
        logger.info(
            f"Matching config: max_candidates={self._max_candidates}, "
            f"threshold={self._similarity_threshold}, limit={self._match_limit}, "
            f"category_bonus={self._category_bonus}, "
            f"location_weight={self._location_weight}"
        )

    @property
    def status(self) -> dict[str, Any]:
        return {
            "ready": self._db is not None,
            "module": "matching",
            "message": "MongoDB $geoNear hard filters + embedding cosine + proximity score",
            "config": {
                "similarity_threshold": self._similarity_threshold,
                "match_radius_meters": self._match_radius_meters,
                "date_window_days": self._date_window_days,
                "match_limit": self._match_limit,
                "max_candidates": self._max_candidates,
                "category_bonus": self._category_bonus,
                "location_weight": self._location_weight,
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
          - same effective category
          - $geoNear radius around source location
          - date window
          - must have embedding vector

        Score: cosine similarity must clear the threshold first. Final displayed
        score then blends cosine with $geoNear proximity (closer pins score higher)
        and an optional same-category ranking bonus.
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

        source_effective = _resolve_effective_category(source)
        if not source_effective:
            logger.info("[matching] item=%s has no category — cannot hard-filter", item_id)
            return {
                "status": "no_category",
                "message": "Source item has no category",
                "item_id": item_id,
                "matches": [],
            }

        mongo_query: dict[str, Any] = {
            "_id": {"$ne": source_oid},
            "reportType": opposite_type,
            "status": "active",
            "isDeleted": {"$ne": True},
            "embeddingVector": {"$exists": True, "$type": "array", "$ne": []},
            **_same_category_query(source_effective),
            **date_filter,
        }

        source_user = _resolve_user_category(source)
        source_ai = _resolve_ai_category(source)
        logger.info(
            "[matching] item=%s categories user=%s ai=%s effective=%s (hard filter)",
            item_id,
            source_user,
            source_ai,
            source_effective,
        )

        owner_id = source.get("ownerId")
        if owner_id is not None:
            mongo_query["ownerId"] = {"$ne": owner_id}

        coords = (source.get("location") or {}).get("coordinates")
        if not isinstance(coords, list) or len(coords) != 2:
            logger.info("[matching] item=%s has no valid location — cannot run $geoNear", item_id)
            return {
                "status": "no_location",
                "message": "Source item has no valid location",
                "item_id": item_id,
                "matches": [],
            }

        lng, lat = float(coords[0]), float(coords[1])
        pipeline = [
            {
                "$geoNear": {
                    "near": {
                        "type": "Point",
                        "coordinates": [lng, lat],
                    },
                    "distanceField": "distanceMeters",
                    "maxDistance": self._match_radius_meters,
                    "spherical": True,
                    # Item has both location and secondaryLocation 2dsphere
                    # indexes; select the primary report location explicitly.
                    "key": "location",
                    "query": mongo_query,
                }
            },
            {"$project": MATCH_CANDIDATE_PROJECTION},
            {"$limit": self._max_candidates},
        ]
        cursor = self._items.aggregate(pipeline)
        candidates = await cursor.to_list(length=self._max_candidates)
        logger.info(
            "[matching] item=%s opposite=%s category=%s radius_m=%.0f "
            "candidates_after_hard_filters=%d",
            item_id,
            opposite_type,
            source_effective,
            self._match_radius_meters,
            len(candidates),
        )

        scored: list[dict[str, Any]] = []
        for doc in candidates:
            candidate_vec = doc.get("embeddingVector")
            if not candidate_vec:
                continue
            base_score = _cosine_similarity(query_vector, candidate_vec)
            if base_score < self._similarity_threshold:
                continue

            distance_meters = float(doc.get("distanceMeters") or 0.0)
            cat_bonus, cat_mismatch = _category_match_bonus(
                source,
                doc,
                bonus=self._category_bonus,
            )
            final_score, proximity, location_contribution = _combine_match_score(
                base_score,
                distance_meters=distance_meters,
                match_radius_meters=self._match_radius_meters,
                location_weight=self._location_weight,
                category_bonus=cat_bonus,
            )

            logger.info(
                "[matching] candidate=%s base=%.4f distance_m=%.1f proximity=%.3f "
                "location_contrib=%.3f cat_bonus=%.2f final=%.4f mismatch=%s",
                doc["_id"],
                base_score,
                distance_meters,
                proximity,
                location_contribution,
                cat_bonus,
                final_score,
                cat_mismatch,
            )

            scored.append(
                {
                    "item_id": str(doc["_id"]),
                    "score": final_score,
                    "similarity_score": round(base_score, 4),
                    "category_bonus": round(cat_bonus, 4),
                    "location_proximity": proximity,
                    "location_contribution": location_contribution,
                    "category_mismatch": cat_mismatch,
                    "title": doc.get("title"),
                    "category": doc.get("category"),
                    "effective_category": _resolve_effective_category(doc),
                    "reportType": doc.get("reportType"),
                    "owner_id": str(doc["ownerId"]) if doc.get("ownerId") else None,
                    "location_name": doc.get("locationName"),
                    "distance_meters": round(distance_meters, 1),
                    "description": doc.get("description"),
                    "caption": doc.get("caption"),
                    "has_image": bool(doc.get("imageFileId")),
                }
            )

        # Prefer higher blended score; break ties with nearer pins.
        scored.sort(
            key=lambda m: (m["score"], -float(m.get("distance_meters") or 0.0)),
            reverse=True,
        )
        top = scored[:result_limit]

        return {
            "status": "success",
            "module": "matching",
            "item_id": item_id,
            "source_report_type": source.get("reportType"),
            "source_effective_category": source_effective,
            "candidate_count": len(candidates),
            "match_count": len(top),
            "matches": top,
            "limit": result_limit,
        }
