from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ErrorBody(BaseModel):
    error: str
    message: str


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    qdrant: bool


class LatencyStats(BaseModel):
    p50: float | None = None
    p99: float | None = None
    count: int = 0


class RequestLogEntry(BaseModel):
    timestamp: float
    endpoint: str
    decision: str
    latency_ms: float


class MetricsResponse(BaseModel):
    auth_rejected: int = 0
    rate_limited: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    coalesced: int = 0
    cohere_calls: int = 0
    latency_ms: LatencyStats = Field(default_factory=LatencyStats)
    recent: list[RequestLogEntry] = Field(default_factory=list)


class PipelineResult(BaseModel):
    body: dict[str, Any]
    decision: Literal["cache", "coalesced", "origin"]
