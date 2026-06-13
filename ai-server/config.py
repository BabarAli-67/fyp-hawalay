"""Application configuration loaded from environment variables."""

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    environment: str = Field(default="development", alias="ENVIRONMENT")

    # MERN / shared platform
    node_server_url: str = Field(default="http://localhost:5000", alias="NODE_SERVER_URL")
    mongo_uri: str = Field(default="mongodb://127.0.0.1:27017/lostfound", alias="MONGO_URI")
    mongo_db_name: str = Field(default="lostfound", alias="MONGO_DB_NAME")
    internal_secret: str = Field(default="", alias="INTERNAL_SECRET")

    # Google Gemini (caption + embeddings via blip_service.py / clip_service.py module names)
    # Legacy — HF_TOKEN, BLIP_MODEL, CLIP_MODEL are not used; Gemini handles this
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    gemini_caption_model: str = Field(
        default="gemini-2.0-flash",
        validation_alias=AliasChoices("GEMINI_CAPTION_MODEL", "GEMINI_MODEL"),
    )
    gemini_embedding_model: str = Field(
        default="gemini-embedding-2",
        validation_alias=AliasChoices("GEMINI_EMBEDDING_MODEL", "GEMINI_EMBED_MODEL"),
    )
    pipeline_version: str = Field(default="analyze_v1", alias="PIPELINE_VERSION")

    # Gemini usage controls (free-tier: 1 generate + 1 embed per report ≈ 2 RPM-friendly calls)
    gemini_generate_max_attempts: int = Field(
        default=3,
        ge=1,
        le=5,
        alias="GEMINI_GENERATE_MAX_ATTEMPTS",
    )
    gemini_caption_quality_retry: bool = Field(
        default=True,
        alias="GEMINI_CAPTION_QUALITY_RETRY",
    )
    gemini_caption_max_passes: int = Field(
        default=3,
        ge=1,
        le=3,
        alias="GEMINI_CAPTION_MAX_PASSES",
    )
    gemini_caption_max_output_tokens: int = Field(
        default=512,
        ge=128,
        le=2048,
        alias="GEMINI_CAPTION_MAX_OUTPUT_TOKENS",
    )
    gemini_features_enabled: bool = Field(
        default=False,
        alias="GEMINI_FEATURES_ENABLED",
    )
    gemini_embed_image: bool = Field(
        default=False,
        alias="GEMINI_EMBED_IMAGE",
    )

    # Matching (Flow 4)
    similarity_threshold: float = Field(default=0.70, alias="SIMILARITY_THRESHOLD")
    match_radius_meters: float = Field(default=10000.0, alias="MATCH_RADIUS_METERS")
    date_window_days: int = Field(default=7, alias="DATE_WINDOW_DAYS")
    match_limit: int = Field(default=5, alias="MATCH_LIMIT")
    max_match_candidates: int = Field(default=100, alias="MAX_MATCH_CANDIDATES")
    category_bonus: float = Field(default=0.10, alias="CATEGORY_BONUS")

    # OCR — YOLO + EasyOCR
    yolo_weights_path: str | None = Field(default=None, alias="YOLO_WEIGHTS_PATH")
    yolo_confidence_threshold: float = Field(default=0.5, alias="YOLO_CONFIDENCE_THRESHOLD")
    yolo_use_gpu: bool = Field(default=False, alias="YOLO_USE_GPU")
    easyocr_langs: str = Field(default="en", alias="EASYOCR_LANGS")
    easyocr_use_gpu: bool = Field(default=False, alias="EASYOCR_USE_GPU")

    # object_v1 — 20-class Keras classifier (separate from card OCR YOLO)
    object_model_path: str | None = Field(default=None, alias="OBJECT_MODEL_PATH")
    object_class_names_path: str | None = Field(default=None, alias="OBJECT_CLASS_NAMES_PATH")
    object_category_map_path: str | None = Field(default=None, alias="OBJECT_CATEGORY_MAP_PATH")
    object_confidence_threshold: float = Field(default=0.5, alias="OBJECT_CONFIDENCE_THRESHOLD")
    object_use_gpu: bool = Field(default=False, alias="OBJECT_USE_GPU")

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def easyocr_lang_list(self) -> list[str]:
        return [lang.strip() for lang in self.easyocr_langs.split(",") if lang.strip()]

    def resolved_yolo_weights(self) -> Path | None:
        if not self.yolo_weights_path:
            return None
        path = Path(self.yolo_weights_path).expanduser().resolve()
        return path if path.is_file() else None

    def resolved_object_weights(self) -> Path | None:
        path = self.expected_object_weights_path()
        return path if path.is_file() else None

    def expected_object_weights_path(self) -> Path:
        if self.object_model_path:
            return Path(self.object_model_path).expanduser().resolve()
        return (
            Path(__file__).resolve().parent
            / "artifacts"
            / "object_v1"
            / "weights"
            / "hawaly_model_final.keras"
        )

    def expected_object_class_names_path(self) -> Path:
        if self.object_class_names_path:
            return Path(self.object_class_names_path).expanduser().resolve()
        return Path(__file__).resolve().parent / "artifacts" / "object_v1" / "class_names.json"

    def expected_object_category_map_path(self) -> Path:
        if self.object_category_map_path:
            return Path(self.object_category_map_path).expanduser().resolve()
        return Path(__file__).resolve().parent / "artifacts" / "object_v1" / "category_map.json"

    def resolved_object_class_names(self) -> Path | None:
        path = self.expected_object_class_names_path()
        return path if path.is_file() else None

    def resolved_object_category_map(self) -> Path | None:
        path = self.expected_object_category_map_path()
        return path if path.is_file() else None


@lru_cache
def get_settings() -> Settings:
    return Settings()
