from __future__ import annotations

from typing import Any

import pytest

from app.layers.semantic_cache import SemanticCache
from app.pipeline.gateway import extract_chat_text, extract_embed_text, request_hash


class FakeStore:
    def __init__(self, hit: dict[str, Any] | None = None, score: float = 1.0) -> None:
        self.hit = hit
        self.score = score
        self.upserts: list[dict[str, Any]] = []

    async def search(self, endpoint: str, vector: list[float], threshold: float) -> dict[str, Any] | None:
        if self.hit is not None and self.score >= threshold:
            return self.hit
        return None

    async def upsert(
        self,
        endpoint: str,
        vector: list[float],
        text: str,
        response: dict[str, Any],
    ) -> None:
        self.upserts.append(
            {
                "endpoint": endpoint,
                "vector": vector,
                "text": text,
                "response": response,
            }
        )


class FakeEmbedder:
    def __init__(self, vector: list[float] | None = None) -> None:
        self.vector = vector or [0.1, 0.2, 0.3]
        self.calls = 0

    async def embed_query(self, text: str) -> list[float]:
        self.calls += 1
        return self.vector


@pytest.mark.asyncio
async def test_lookup_hit_above_threshold() -> None:
    store = FakeStore(hit={"id": "cached"}, score=0.97)
    cache = SemanticCache(store=store, embedder=FakeEmbedder(), threshold=0.92)
    result = await cache.lookup("chat", [0.1, 0.2])
    assert result == {"id": "cached"}


@pytest.mark.asyncio
async def test_lookup_miss_below_threshold() -> None:
    store = FakeStore(hit={"id": "cached"}, score=0.4)
    cache = SemanticCache(store=store, embedder=FakeEmbedder(), threshold=0.92)
    result = await cache.lookup("chat", [0.1, 0.2])
    assert result is None


@pytest.mark.asyncio
async def test_remember_writes_store() -> None:
    store = FakeStore()
    cache = SemanticCache(store=store, embedder=FakeEmbedder(), threshold=0.92)
    await cache.remember("chat", [1.0], "hello", {"ok": True})
    assert store.upserts[0]["response"] == {"ok": True}
    assert store.upserts[0]["text"] == "hello"


def test_extract_chat_text_uses_last_user_message() -> None:
    text = extract_chat_text(
        {
            "messages": [
                {"role": "system", "content": "be brief"},
                {"role": "user", "content": "first"},
                {"role": "assistant", "content": "ok"},
                {"role": "user", "content": [{"type": "text", "text": "second"}]},
            ]
        }
    )
    assert text == "second"


def test_extract_embed_text_joins_inputs() -> None:
    assert extract_embed_text({"texts": ["a", "b"]}) == "a\nb"


def test_request_hash_is_stable_for_key_order() -> None:
    left = request_hash("chat", {"b": 1, "a": 2})
    right = request_hash("chat", {"a": 2, "b": 1})
    assert left == right
    assert left != request_hash("embed", {"a": 2, "b": 1})
