from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    cohere_api_key: str = ""
    cordon_api_keys: str = "demo-key:demo-secret"

    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "cordon_cache"

    auth_window_seconds: int = 60

    rate_limit_capacity: float = 30
    rate_limit_refill_per_sec: float = 5

    cache_similarity_threshold: float = 0.92
    cache_ttl_seconds: int = 3600
    cache_max_entries: int = 1000
    cache_vector_size: int = 1024

    chat_model: str = "command-a-plus-05-2026"
    embed_model: str = "embed-v4.0"

    cordon_host: str = "0.0.0.0"
    cordon_port: int = 8000

    metrics_log_size: int = 200
    metrics_latency_window: int = 500

    api_key_map: dict[str, str] = Field(default_factory=dict)

    @field_validator("cordon_api_keys")
    @classmethod
    def keys_not_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("CORDON_API_KEYS must contain at least one key_id:secret pair")
        return value

    def model_post_init(self, __context: object) -> None:
        parsed: dict[str, str] = {}
        for pair in self.cordon_api_keys.split(","):
            pair = pair.strip()
            if not pair:
                continue
            key_id, sep, secret = pair.partition(":")
            if not sep or not key_id or not secret:
                raise ValueError(f"Invalid CORDON_API_KEYS entry: {pair!r}")
            parsed[key_id.strip()] = secret.strip()
        if not parsed:
            raise ValueError("CORDON_API_KEYS must contain at least one key_id:secret pair")
        object.__setattr__(self, "api_key_map", parsed)


@lru_cache
def get_settings() -> Settings:
    return Settings()
