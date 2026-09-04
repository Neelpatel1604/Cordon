from __future__ import annotations

import asyncio
import time

from app.errors import RateLimitError


class TokenBucket:
    def __init__(self, capacity: float, refill_per_sec: float) -> None:
        if capacity <= 0:
            raise ValueError("capacity must be positive")
        self.capacity = capacity
        self.refill_per_sec = max(0.0, refill_per_sec)
        self.tokens = capacity
        self.last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    def _refill(self, now: float) -> None:
        elapsed = now - self.last_refill
        if elapsed > 0 and self.refill_per_sec > 0:
            self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_per_sec)
        self.last_refill = now

    async def try_consume(self, tokens: float = 1.0) -> tuple[bool, float]:
        async with self._lock:
            now = time.monotonic()
            self._refill(now)
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True, 0.0
            needed = tokens - self.tokens
            if self.refill_per_sec <= 0:
                return False, 1.0
            return False, needed / self.refill_per_sec


class RateLimiter:
    def __init__(self, capacity: float, refill_per_sec: float) -> None:
        self.capacity = capacity
        self.refill_per_sec = refill_per_sec
        self._buckets: dict[str, TokenBucket] = {}
        self._lock = asyncio.Lock()

    async def _bucket_for(self, key_id: str) -> TokenBucket:
        bucket = self._buckets.get(key_id)
        if bucket is not None:
            return bucket
        async with self._lock:
            existing = self._buckets.get(key_id)
            if existing is not None:
                return existing
            created = TokenBucket(self.capacity, self.refill_per_sec)
            self._buckets[key_id] = created
            return created

    async def consume(self, key_id: str, tokens: float = 1.0) -> None:
        bucket = await self._bucket_for(key_id)
        allowed, retry_after = await bucket.try_consume(tokens)
        if not allowed:
            raise RateLimitError(retry_after)
