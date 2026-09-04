from __future__ import annotations

import hashlib
import json
import time
from typing import Any, Literal

from app.errors import AuthError, RateLimitError
from app.layers.auth import AuthLayer
from app.layers.coalescer import Coalescer
from app.layers.rate_limit import RateLimiter
from app.layers.semantic_cache import SemanticCache
from app.services.cohere_client import CohereService
from app.services.metrics import MetricsService

Decision = Literal["cache", "coalesced", "origin"]


def request_hash(endpoint: str, body: dict[str, Any]) -> str:
    canonical = json.dumps(
        {"endpoint": endpoint, "body": body},
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def extract_chat_text(body: dict[str, Any]) -> str:
    messages = body.get("messages") or []
    for message in reversed(messages):
        if not isinstance(message, dict):
            continue
        if message.get("role") != "user":
            continue
        content = message.get("content")
        text = _content_to_text(content)
        if text:
            return text
    return json.dumps(body, sort_keys=True, default=str)


def extract_embed_text(body: dict[str, Any]) -> str:
    texts = body.get("texts") or []
    return "\n".join(str(item) for item in texts)


def _content_to_text(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return " ".join(part.strip() for part in parts if part.strip())
    return ""


class GatewayPipeline:
    def __init__(
        self,
        auth: AuthLayer,
        rate_limiter: RateLimiter,
        cache: SemanticCache,
        coalescer: Coalescer,
        cohere: CohereService,
        metrics: MetricsService,
    ) -> None:
        self.auth = auth
        self.rate_limiter = rate_limiter
        self.cache = cache
        self.coalescer = coalescer
        self.cohere = cohere
        self.metrics = metrics

    async def handle(
        self,
        *,
        method: str,
        path: str,
        raw_body: bytes,
        headers: dict[str, str],
        endpoint: Literal["chat", "embed"],
        body: dict[str, Any],
        cache_text: str,
    ) -> tuple[dict[str, Any], Decision]:
        started = time.perf_counter()
        decision = "origin"
        try:
            key_id = self.auth.verify(
                method=method,
                path=path,
                body=raw_body,
                api_key=_header(headers, "x-api-key"),
                timestamp=_header(headers, "x-timestamp"),
                nonce=_header(headers, "x-nonce"),
                signature=_header(headers, "x-signature"),
            )
            await self.rate_limiter.consume(key_id)

            vector: list[float] | None = None
            try:
                vector = await self.cache.embed_query(cache_text)
                cached = await self.cache.lookup(endpoint, vector)
            except Exception:
                cached = None
                vector = None

            if cached is not None:
                self.metrics.increment("cache_hits")
                decision = "cache"
                return cached, decision

            self.metrics.increment("cache_misses")
            key = request_hash(endpoint, body)

            async def call_origin() -> dict[str, Any]:
                self.metrics.increment("cohere_calls")
                if endpoint == "chat":
                    result = await self.cohere.chat(body)
                else:
                    result = await self.cohere.embed(body)
                if vector is not None:
                    try:
                        await self.cache.remember(endpoint, vector, cache_text, result)
                    except Exception:
                        pass
                return result

            result, was_coalesced = await self.coalescer.join_or_run(key, call_origin)
            if was_coalesced:
                self.metrics.increment("coalesced")
                decision = "coalesced"
            else:
                decision = "origin"
            return result, decision
        except AuthError:
            self.metrics.increment("auth_rejected")
            decision = "auth_rejected"
            raise
        except RateLimitError:
            self.metrics.increment("rate_limited")
            decision = "rate_limited"
            raise
        finally:
            latency_ms = (time.perf_counter() - started) * 1000
            self.metrics.record(endpoint, decision, latency_ms)


def _header(headers: dict[str, str], name: str) -> str | None:
    lower = name.lower()
    for key, value in headers.items():
        if key.lower() == lower:
            return value
    return None
