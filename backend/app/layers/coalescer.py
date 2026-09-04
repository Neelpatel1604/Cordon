from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

T = TypeVar("T")


class Coalescer:
    """Share one in-flight result across identical concurrent requests."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._inflight: dict[str, asyncio.Future] = {}

    async def join_or_run(
        self,
        key: str,
        factory: Callable[[], Awaitable[T]],
    ) -> tuple[T, bool]:
        async with self._lock:
            existing = self._inflight.get(key)
            if existing is not None:
                future = existing
                follower = True
            else:
                future = asyncio.get_running_loop().create_future()
                self._inflight[key] = future
                follower = False

        if follower:
            return await asyncio.shield(future), True

        try:
            result = await factory()
            if not future.done():
                future.set_result(result)
            return result, False
        except Exception as exc:
            if not future.done():
                future.set_exception(exc)
            raise
        finally:
            async with self._lock:
                if self._inflight.get(key) is future:
                    del self._inflight[key]
