from __future__ import annotations

from typing import Any, Protocol

from app.services.qdrant_store import QdrantStore


class Embedder(Protocol):
    async def embed_query(self, text: str) -> list[float]: ...


class SemanticCache:
    def __init__(
        self,
        store: QdrantStore,
        embedder: Embedder,
        threshold: float,
    ) -> None:
        self.store = store
        self.embedder = embedder
        self.threshold = threshold

    async def embed_query(self, text: str) -> list[float]:
        return await self.embedder.embed_query(text)

    async def lookup(self, endpoint: str, vector: list[float]) -> dict[str, Any] | None:
        return await self.store.search(endpoint, vector, self.threshold)

    async def remember(
        self,
        endpoint: str,
        vector: list[float],
        text: str,
        response: dict[str, Any],
    ) -> None:
        await self.store.upsert(endpoint, vector, text, response)
