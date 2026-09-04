from __future__ import annotations

from fastapi import Request

from app.config import Settings, get_settings
from app.pipeline.gateway import GatewayPipeline
from app.services.metrics import MetricsService
from app.services.qdrant_store import QdrantStore


def settings_dep() -> Settings:
    return get_settings()


def pipeline_dep(request: Request) -> GatewayPipeline:
    return request.app.state.pipeline


def metrics_dep(request: Request) -> MetricsService:
    return request.app.state.metrics


def qdrant_dep(request: Request) -> QdrantStore:
    return request.app.state.qdrant
