from __future__ import annotations

from typing import Any

import pytest

from app.layers.semantic_cache import SemanticCache
from app.pipeline.gateway import extract_chat_text, extract_embed_text, request_hash
from app.services.qdrant_store import CacheCandidate


class FakeStore:
    def __init__(self, candidates: list[CacheCandidate] | None = None) -> None:
        self.candidates = candidates or []
        self.upserts: list[dict[str, Any]] = []
        self.last_limit: int | None = None
        self.last_threshold: float | None = None

    async def search_candidates(
        self,
        endpoint: str,
        vector: list[float],
        threshold: float,
        limit: int = 1,
    ) -> list[CacheCandidate]:
        self.last_limit = limit
        self.last_threshold = threshold
        return [item for item in self.candidates if item.score >= threshold][:limit]

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


class FakeReranker:
    def __init__(self, ranked: list[tuple[int, float]] | None = None, error: Exception | None = None) -> None:
        self.ranked = ranked or []
        self.error = error
        self.calls = 0
        self.last_query = ""
        self.last_documents: list[str] = []

    async def rerank(self, query: str, documents: list[str]) -> list[tuple[int, float]]:
        self.calls += 1
        self.last_query = query
        self.last_documents = documents
        if self.error is not None:
            raise self.error
        return self.ranked


def _hit(score: float, text: str = "What is the capital of France?", response: dict[str, Any] | None = None) -> CacheCandidate:
    return CacheCandidate(text=text, response=response or {"id": "cached"}, score=score)


@pytest.mark.asyncio
async def test_lookup_hit_above_threshold() -> None:
    store = FakeStore(candidates=[_hit(0.97)])
    cache = SemanticCache(store=store, embedder=FakeEmbedder(), threshold=0.92)
    result = await cache.lookup("chat", [0.1, 0.2], "What is the capital of France?")
    assert result.response == {"id": "cached"}
    assert result.via == "cosine"


@pytest.mark.asyncio
async def test_lookup_miss_below_retrieve_floor() -> None:
    store = FakeStore(candidates=[_hit(0.4)])
    cache = SemanticCache(store=store, embedder=FakeEmbedder(), threshold=0.92, retrieve_threshold=0.8)
    result = await cache.lookup("chat", [0.1, 0.2], "What is the capital of France?")
    assert result.response is None
    assert result.score == 0.4
    assert result.via == "miss"


@pytest.mark.asyncio
async def test_high_confidence_hit_skips_rerank() -> None:
    reranker = FakeReranker(ranked=[(0, 0.99)])
    store = FakeStore(candidates=[_hit(0.97)])
    cache = SemanticCache(
        store=store,
        embedder=FakeEmbedder(),
        threshold=0.92,
        reranker=reranker,
    )
    result = await cache.lookup("chat", [0.1, 0.2], "What's the capital city of France?")
    assert result.response == {"id": "cached"}
    assert result.via == "cosine"
    assert reranker.calls == 0


@pytest.mark.asyncio
async def test_gray_zone_rerank_accepts_paraphrase() -> None:
    reranker = FakeReranker(ranked=[(0, 0.88)])
    store = FakeStore(candidates=[_hit(0.86, text="What is the capital of France?")])
    cache = SemanticCache(
        store=store,
        embedder=FakeEmbedder(),
        threshold=0.92,
        retrieve_threshold=0.8,
        reranker=reranker,
        rerank_threshold=0.65,
    )
    result = await cache.lookup("chat", [0.1, 0.2], "Which city is France's capital?")
    assert result.response == {"id": "cached"}
    assert result.via == "rerank"
    assert reranker.calls == 1
    assert reranker.last_query == "which city is france's capital"


@pytest.mark.asyncio
async def test_gray_zone_rerank_rejects_different_question() -> None:
    reranker = FakeReranker(ranked=[(0, 0.21)])
    store = FakeStore(candidates=[_hit(0.84, text="What is the capital of France?")])
    cache = SemanticCache(
        store=store,
        embedder=FakeEmbedder(),
        threshold=0.92,
        retrieve_threshold=0.8,
        reranker=reranker,
        rerank_threshold=0.65,
    )
    result = await cache.lookup("chat", [0.1, 0.2], "What is the capital of Canada?")
    assert result.response is None
    assert reranker.calls == 1


@pytest.mark.asyncio
async def test_gray_zone_without_reranker_is_a_miss() -> None:
    store = FakeStore(candidates=[_hit(0.86)])
    cache = SemanticCache(store=store, embedder=FakeEmbedder(), threshold=0.92, retrieve_threshold=0.8)
    result = await cache.lookup("chat", [0.1, 0.2], "Which city is France's capital?")
    assert result.response is None


@pytest.mark.asyncio
async def test_rerank_failure_falls_back_to_strong_cosine() -> None:
    reranker = FakeReranker(error=RuntimeError("upstream down"))
    store = FakeStore(candidates=[_hit(0.86)])
    cache = SemanticCache(
        store=store,
        embedder=FakeEmbedder(),
        threshold=0.92,
        retrieve_threshold=0.8,
        reranker=reranker,
    )
    result = await cache.lookup("chat", [0.1, 0.2], "Which city is France's capital?")
    assert result.response == {"id": "cached"}
    assert result.via == "cosine-fallback"


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
    assert extract_embed_text({"texts": ["a", "b"]}) == "a b"


def test_request_hash_is_stable_for_key_order() -> None:
    left = request_hash("chat", {"b": 1, "a": 2})
    right = request_hash("chat", {"a": 2, "b": 1})
    assert left == right
    assert left != request_hash("embed", {"a": 2, "b": 1})
