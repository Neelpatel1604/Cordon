from __future__ import annotations

import asyncio

import pytest

from app.errors import RateLimitError
from app.layers.rate_limit import RateLimiter, TokenBucket


@pytest.mark.asyncio
async def test_allows_up_to_capacity() -> None:
    limiter = RateLimiter(capacity=3, refill_per_sec=0)
    await limiter.consume("demo")
    await limiter.consume("demo")
    await limiter.consume("demo")
    with pytest.raises(RateLimitError) as exc:
        await limiter.consume("demo")
    assert exc.value.status_code == 429
    assert "Retry-After" in exc.value.headers


@pytest.mark.asyncio
async def test_concurrent_last_token() -> None:
    limiter = RateLimiter(capacity=1, refill_per_sec=0)

    async def attempt() -> bool:
        try:
            await limiter.consume("shared")
            return True
        except RateLimitError:
            return False

    results = await asyncio.gather(*[attempt() for _ in range(25)])
    assert sum(results) == 1


@pytest.mark.asyncio
async def test_buckets_are_isolated_per_key() -> None:
    limiter = RateLimiter(capacity=1, refill_per_sec=0)
    await limiter.consume("alpha")
    await limiter.consume("beta")
    with pytest.raises(RateLimitError):
        await limiter.consume("alpha")


@pytest.mark.asyncio
async def test_refill_restores_tokens() -> None:
    bucket = TokenBucket(capacity=1, refill_per_sec=100)
    allowed, _ = await bucket.try_consume()
    assert allowed is True
    bucket.last_refill -= 1
    allowed, retry_after = await bucket.try_consume()
    assert allowed is True
    assert retry_after == 0.0
