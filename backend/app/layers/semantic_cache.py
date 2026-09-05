from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Protocol

from app.services.qdrant_store import CacheCandidate, QdrantStore

logger = logging.getLogger(__name__)


class Embedder(Protocol):
    async def embed_query(self, text: str) -> list[float]: ...


class Reranker(Protocol):
    async def rerank(self, query: str, documents: list[str]) -> list[tuple[int, float]]: ...


@dataclass(frozen=True)
class CacheLookup:
    response: dict[str, Any] | None = None
    score: float | None = None
    matched_text: str | None = None
    via: str | None = None

    def headers(self, accept_threshold: float, retrieve_threshold: float) -> dict[str, str]:
        extra: dict[str, str] = {
            "X-Cordon-Cache-Need": f"{accept_threshold:.2f}",
            "X-Cordon-Cache-Gray": f"{retrieve_threshold:.2f}",
        }
        if self.score is not None:
            extra["X-Cordon-Cache-Score"] = f"{self.score:.3f}"
        if self.matched_text:
            extra["X-Cordon-Cache-Match"] = self.matched_text[:160]
        if self.via:
            extra["X-Cordon-Cache-Via"] = self.via
        return extra


def normalize_cache_text(text: str) -> str:
    collapsed = " ".join(text.lower().split())
    return collapsed.strip(" ?!.,;:\"'")


class SemanticCache:
    def __init__(
        self,
        store: QdrantStore,
        embedder: Embedder,
        threshold: float,
        retrieve_threshold: float | None = None,
        reranker: Reranker | None = None,
        rerank_threshold: float = 0.45,
        rerank_candidates: int = 5,
    ) -> None:
        self.store = store
        self.embedder = embedder
        self.threshold = threshold
        self.retrieve_threshold = retrieve_threshold if retrieve_threshold is not None else min(threshold, 0.7)
        self.reranker = reranker
        self.rerank_threshold = rerank_threshold
        self.rerank_candidates = rerank_candidates

    async def embed_query(self, text: str) -> list[float]:
        return await self.embedder.embed_query(normalize_cache_text(text))

    async def lookup(
        self,
        endpoint: str,
        vector: list[float],
        query: str = "",
    ) -> CacheLookup:
        neighbors = await self.store.search_candidates(
            endpoint,
            vector,
            0.0,
            limit=max(self.rerank_candidates, 1),
        )
        if not neighbors:
            return CacheLookup(via="empty")

        top = neighbors[0]
        eligible = [item for item in neighbors if item.score >= self.retrieve_threshold]
        if not eligible:
            return CacheLookup(score=top.score, matched_text=top.text, via="miss")

        best = eligible[0]
        if best.score >= self.threshold:
            return CacheLookup(best.response, best.score, best.text, "cosine")

        reranked = await self._rerank_gray_zone(query, eligible)
        if reranked.response is not None:
            return reranked

        return CacheLookup(score=top.score, matched_text=top.text, via="miss")

    async def _rerank_gray_zone(
        self,
        query: str,
        candidates: list[CacheCandidate],
    ) -> CacheLookup:
        top = candidates[0]
        if self.reranker is None or not query.strip():
            return CacheLookup(score=top.score, matched_text=top.text, via="miss")

        documents: list[str] = []
        mapped: list[CacheCandidate] = []
        for candidate in candidates:
            if candidate.text.strip():
                documents.append(candidate.text)
                mapped.append(candidate)
        if not documents:
            return CacheLookup(score=top.score, matched_text=top.text, via="miss")

        try:
            ranked = await self.reranker.rerank(normalize_cache_text(query), documents)
        except Exception:
            logger.warning("Cache rerank failed; using cosine fallback", exc_info=True)
            if top.score >= max(self.retrieve_threshold, 0.75):
                return CacheLookup(top.response, top.score, top.text, "cosine-fallback")
            return CacheLookup(score=top.score, matched_text=top.text, via="miss")

        if not ranked:
            return CacheLookup(score=top.score, matched_text=top.text, via="miss")
        index, score = ranked[0]
        if score < self.rerank_threshold or index < 0 or index >= len(mapped):
            return CacheLookup(score=top.score, matched_text=top.text, via="miss")
        chosen = mapped[index]
        return CacheLookup(chosen.response, score, chosen.text, "rerank")

    async def remember(
        self,
        endpoint: str,
        vector: list[float],
        text: str,
        response: dict[str, Any],
    ) -> None:
        await self.store.upsert(endpoint, vector, normalize_cache_text(text), response)
