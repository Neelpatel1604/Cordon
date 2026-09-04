from __future__ import annotations

import asyncio

import pytest

from app.layers.coalescer import Coalescer


@pytest.mark.asyncio
async def test_identical_inflight_requests_share_one_call() -> None:
    coalescer = Coalescer()
    calls = 0

    async def factory() -> str:
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.05)
        return "ok"

    results = await asyncio.gather(*[coalescer.join_or_run("same", factory) for _ in range(12)])
    values = [value for value, _ in results]
    coalesced = [was for _, was in results]

    assert calls == 1
    assert values == ["ok"] * 12
    assert coalesced.count(False) == 1
    assert coalesced.count(True) == 11


@pytest.mark.asyncio
async def test_distinct_keys_do_not_share() -> None:
    coalescer = Coalescer()
    calls = 0

    async def factory() -> int:
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.01)
        return calls

    first, second = await asyncio.gather(
        coalescer.join_or_run("a", factory),
        coalescer.join_or_run("b", factory),
    )
    assert calls == 2
    assert first[1] is False
    assert second[1] is False


@pytest.mark.asyncio
async def test_winner_error_is_shared() -> None:
    coalescer = Coalescer()

    async def factory() -> str:
        await asyncio.sleep(0.02)
        raise RuntimeError("boom")

    results = await asyncio.gather(
        *[coalescer.join_or_run("err", factory) for _ in range(5)],
        return_exceptions=True,
    )
    assert all(isinstance(item, RuntimeError) for item in results)

    async def recovered() -> str:
        return "recovered"

    value, coalesced = await coalescer.join_or_run("err", recovered)
    assert value == "recovered"
    assert coalesced is False


@pytest.mark.asyncio
async def test_registry_clears_after_success() -> None:
    coalescer = Coalescer()
    calls = 0

    async def factory() -> str:
        nonlocal calls
        calls += 1
        return f"call-{calls}"

    first, first_coalesced = await coalescer.join_or_run("k", factory)
    second, second_coalesced = await coalescer.join_or_run("k", factory)
    assert first == "call-1"
    assert second == "call-2"
    assert first_coalesced is False
    assert second_coalesced is False
    assert calls == 2
