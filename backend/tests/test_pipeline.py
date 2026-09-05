from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app.clients.signer import sign_request
from app.errors import AuthError, RateLimitError
from app.layers.auth import AuthLayer, NonceStore
from app.layers.coalescer import Coalescer
from app.layers.rate_limit import RateLimiter
from app.layers.semantic_cache import SemanticCache
from app.pipeline.gateway import GatewayPipeline
from app.services.metrics import MetricsService
from app.services.qdrant_store import CacheCandidate


class FakeStore:
    def __init__(self) -> None:
        self.item: dict[str, Any] | None = None

    async def search_candidates(
        self,
        endpoint: str,
        vector: list[float],
        threshold: float,
        limit: int = 1,
    ) -> list[CacheCandidate]:
        if self.item is None:
            return []
        return [CacheCandidate(text="", response=self.item, score=1.0)]

    async def upsert(self, endpoint: str, vector: list[float], text: str, response: dict[str, Any]) -> None:
        self.item = response


class FakeEmbedder:
    async def embed_query(self, text: str) -> list[float]:
        return [0.1, 0.2, 0.3]


class FakeCohere:
    def __init__(self) -> None:
        self.chat_calls = 0

    async def chat(self, body: dict[str, Any]) -> dict[str, Any]:
        self.chat_calls += 1
        return {"message": {"content": [{"text": body["messages"][0]["content"]}]}}

    async def embed(self, body: dict[str, Any]) -> dict[str, Any]:
        return {"embeddings": {"float": [[0.1]]}}

    async def embed_query(self, text: str) -> list[float]:
        return [0.1, 0.2, 0.3]


def _pipeline(cohere: FakeCohere | None = None, capacity: float = 30) -> tuple[GatewayPipeline, FakeCohere]:
    client = cohere or FakeCohere()
    store = FakeStore()
    pipeline = GatewayPipeline(
        auth=AuthLayer(
            api_keys={"demo-key": "demo-secret"},
            window_seconds=60,
            nonce_store=NonceStore(ttl_seconds=60),
        ),
        rate_limiter=RateLimiter(capacity=capacity, refill_per_sec=0),
        cache=SemanticCache(store=store, embedder=FakeEmbedder(), threshold=0.92),
        coalescer=Coalescer(),
        cohere=client,
        metrics=MetricsService(),
    )
    return pipeline, client


def _signed(body: bytes, nonce: str) -> dict[str, str]:
    return sign_request(
        "POST",
        "/v1/chat",
        body,
        "demo-key",
        "demo-secret",
        timestamp="1000000",
        nonce=nonce,
    )


@pytest.mark.asyncio
async def test_origin_then_cache_hit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.layers.auth.time.time", lambda: 1_000_000)
    pipeline, client = _pipeline()
    body = {"messages": [{"role": "user", "content": "hello"}]}
    raw = b'{"messages":[{"role":"user","content":"hello"}]}'

    first, decision, _headers = await pipeline.handle(
        method="POST",
        path="/v1/chat",
        raw_body=raw,
        headers=_signed(raw, "n1"),
        endpoint="chat",
        body=body,
        cache_text="hello",
    )
    second, cached, cache_headers = await pipeline.handle(
        method="POST",
        path="/v1/chat",
        raw_body=raw,
        headers=_signed(raw, "n2"),
        endpoint="chat",
        body=body,
        cache_text="hello",
    )
    assert decision == "origin"
    assert cached == "cache"
    assert first == second
    assert client.chat_calls == 1


@pytest.mark.asyncio
async def test_auth_failure_never_calls_cohere(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.layers.auth.time.time", lambda: 1_000_000)
    pipeline, client = _pipeline()
    raw = b"{}"
    with pytest.raises(AuthError):
        await pipeline.handle(
            method="POST",
            path="/v1/chat",
            raw_body=raw,
            headers={"X-Api-Key": "demo-key"},
            endpoint="chat",
            body={},
            cache_text="x",
        )
    assert client.chat_calls == 0
    assert pipeline.metrics.snapshot().auth_rejected == 1


@pytest.mark.asyncio
async def test_rate_limit_never_calls_cohere(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.layers.auth.time.time", lambda: 1_000_000)
    pipeline, client = _pipeline(capacity=1)
    raw = b'{"messages":[{"role":"user","content":"hello"}]}'
    body = {"messages": [{"role": "user", "content": "hello"}]}
    await pipeline.handle(
        method="POST",
        path="/v1/chat",
        raw_body=raw,
        headers=_signed(raw, "n1"),
        endpoint="chat",
        body=body,
        cache_text="hello",
    )
    with pytest.raises(RateLimitError):
        await pipeline.handle(
            method="POST",
            path="/v1/chat",
            raw_body=raw,
            headers=_signed(raw, "n2"),
            endpoint="chat",
            body=body,
            cache_text="hello",
        )
    assert client.chat_calls == 1
    assert pipeline.metrics.snapshot().rate_limited == 1


@pytest.mark.asyncio
async def test_coalesces_identical_inflight_requests(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.layers.auth.time.time", lambda: 1_000_000)

    class SlowCohere(FakeCohere):
        async def chat(self, body: dict[str, Any]) -> dict[str, Any]:
            await asyncio.sleep(0.05)
            return await super().chat(body)

    pipeline, client = _pipeline(SlowCohere())
    raw = b'{"messages":[{"role":"user","content":"hello"}]}'
    body = {"messages": [{"role": "user", "content": "hello"}]}

    results = await asyncio.gather(
        *[
            pipeline.handle(
                method="POST",
                path="/v1/chat",
                raw_body=raw,
                headers=_signed(raw, f"n{index}"),
                endpoint="chat",
                body=body,
                cache_text="hello",
            )
            for index in range(5)
        ]
    )
    decisions = [decision for _, decision, _headers in results]
    assert client.chat_calls == 1
    assert decisions.count("origin") == 1
    assert decisions.count("coalesced") == 4
    assert pipeline.metrics.snapshot().coalesced == 4


@pytest.mark.asyncio
async def test_coalesce_runs_before_cache_on_warm_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.layers.auth.time.time", lambda: 1_000_000)
    pipeline, client = _pipeline()
    body = {"messages": [{"role": "user", "content": "hello"}]}
    raw = b'{"messages":[{"role":"user","content":"hello"}]}'

    await pipeline.handle(
        method="POST",
        path="/v1/chat",
        raw_body=raw,
        headers=_signed(raw, "warm"),
        endpoint="chat",
        body=body,
        cache_text="hello",
    )
    assert client.chat_calls == 1

    class SlowEmbed(FakeEmbedder):
        async def embed_query(self, text: str) -> list[float]:
            await asyncio.sleep(0.05)
            return [0.1, 0.2, 0.3]

    pipeline.cache.embedder = SlowEmbed()

    results = await asyncio.gather(
        *[
            pipeline.handle(
                method="POST",
                path="/v1/chat",
                raw_body=raw,
                headers=_signed(raw, f"burst-{index}"),
                endpoint="chat",
                body=body,
                cache_text="hello",
            )
            for index in range(4)
        ]
    )
    decisions = [decision for _, decision, _headers in results]
    assert client.chat_calls == 1
    assert decisions.count("coalesced") >= 3
    assert "cache" in decisions or "coalesced" in decisions
