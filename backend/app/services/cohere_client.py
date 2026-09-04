from __future__ import annotations

from typing import Any

import cohere

from app.config import Settings
from app.errors import UpstreamError

CHAT_KEYS = {
    "model",
    "messages",
    "tools",
    "strict_tools",
    "documents",
    "citation_options",
    "response_format",
    "safety_mode",
    "max_tokens",
    "stop_sequences",
    "temperature",
    "seed",
    "frequency_penalty",
    "presence_penalty",
    "k",
    "p",
    "logprobs",
    "tool_choice",
    "thinking",
    "priority",
}

EMBED_KEYS = {
    "model",
    "input_type",
    "texts",
    "images",
    "inputs",
    "max_tokens",
    "output_dimension",
    "embedding_types",
    "truncate",
    "priority",
}


def _pick(body: dict[str, Any], keys: set[str]) -> dict[str, Any]:
    return {key: value for key, value in body.items() if key in keys and value is not None}


def to_jsonable(obj: Any) -> Any:
    if obj is None or isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, dict):
        return {str(key): to_jsonable(value) for key, value in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_jsonable(item) for item in obj]
    if hasattr(obj, "model_dump"):
        return to_jsonable(obj.model_dump(mode="json"))
    if hasattr(obj, "dict"):
        return to_jsonable(obj.dict())
    return str(obj)


class CohereService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client = cohere.AsyncClientV2(api_key=settings.cohere_api_key)

    async def close(self) -> None:
        close = getattr(self._client, "close", None)
        if close is None:
            return
        result = close()
        if hasattr(result, "__await__"):
            await result

    async def chat(self, body: dict[str, Any]) -> dict[str, Any]:
        payload = _pick(body, CHAT_KEYS)
        payload.setdefault("model", self.settings.chat_model)
        try:
            response = await self._client.chat(**payload)
        except Exception as exc:
            raise UpstreamError(f"Cohere chat failed: {exc}") from exc
        return to_jsonable(response)

    async def embed(self, body: dict[str, Any]) -> dict[str, Any]:
        payload = _pick(body, EMBED_KEYS)
        payload.setdefault("model", self.settings.embed_model)
        payload.setdefault("input_type", "search_query")
        payload.setdefault("embedding_types", ["float"])
        payload.setdefault("output_dimension", self.settings.cache_vector_size)
        try:
            response = await self._client.embed(**payload)
        except Exception as exc:
            raise UpstreamError(f"Cohere embed failed: {exc}") from exc
        return to_jsonable(response)

    async def embed_query(self, text: str) -> list[float]:
        response = await self.embed(
            {
                "texts": [text],
                "input_type": "search_query",
                "embedding_types": ["float"],
                "output_dimension": self.settings.cache_vector_size,
            }
        )
        embeddings = _extract_float_embeddings(response)
        if not embeddings:
            raise UpstreamError("Cohere embed returned no vectors")
        return embeddings[0]


def _extract_float_embeddings(response: dict[str, Any]) -> list[list[float]]:
    embeddings = response.get("embeddings")
    if isinstance(embeddings, dict):
        floats = embeddings.get("float") or embeddings.get("float_")
        if isinstance(floats, list):
            return floats
    if isinstance(embeddings, list):
        return embeddings
    return []
