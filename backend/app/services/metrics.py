from __future__ import annotations

import threading
import time
from collections import deque

from app.schemas.common import LatencyStats, MetricsResponse, RequestLogEntry


class MetricsService:
    def __init__(self, log_size: int = 200, latency_window: int = 500) -> None:
        self._lock = threading.Lock()
        self.auth_rejected = 0
        self.rate_limited = 0
        self.cache_hits = 0
        self.cache_misses = 0
        self.coalesced = 0
        self.cohere_calls = 0
        self._latencies: deque[float] = deque(maxlen=latency_window)
        self._recent: deque[RequestLogEntry] = deque(maxlen=log_size)

    def increment(self, name: str) -> None:
        with self._lock:
            current = getattr(self, name, None)
            if isinstance(current, int):
                setattr(self, name, current + 1)

    def record(
        self,
        endpoint: str,
        decision: str,
        latency_ms: float,
    ) -> None:
        entry = RequestLogEntry(
            timestamp=time.time(),
            endpoint=endpoint,
            decision=decision,
            latency_ms=round(latency_ms, 3),
        )
        with self._lock:
            self._latencies.append(latency_ms)
            self._recent.appendleft(entry)

    def snapshot(self) -> MetricsResponse:
        with self._lock:
            latencies = sorted(self._latencies)
            return MetricsResponse(
                auth_rejected=self.auth_rejected,
                rate_limited=self.rate_limited,
                cache_hits=self.cache_hits,
                cache_misses=self.cache_misses,
                coalesced=self.coalesced,
                cohere_calls=self.cohere_calls,
                latency_ms=_percentiles(latencies),
                recent=list(self._recent),
            )


def _percentiles(sorted_values: list[float]) -> LatencyStats:
    if not sorted_values:
        return LatencyStats(count=0)
    return LatencyStats(
        p50=_percentile(sorted_values, 0.50),
        p99=_percentile(sorted_values, 0.99),
        count=len(sorted_values),
    )


def _percentile(sorted_values: list[float], fraction: float) -> float:
    if not sorted_values:
        return 0.0
    index = min(len(sorted_values) - 1, max(0, int(round((len(sorted_values) - 1) * fraction))))
    return round(sorted_values[index], 3)
