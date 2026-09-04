from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import metrics_dep
from app.schemas.common import MetricsResponse
from app.services.metrics import MetricsService

router = APIRouter(tags=["metrics"])


@router.get("/metrics", response_model=MetricsResponse)
async def metrics(service: MetricsService = Depends(metrics_dep)) -> MetricsResponse:
    return service.snapshot()
