from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import qdrant_dep
from app.schemas.common import HealthResponse
from app.services.qdrant_store import QdrantStore

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(qdrant: QdrantStore = Depends(qdrant_dep)) -> HealthResponse:
    qdrant_ok = await qdrant.ping()
    return HealthResponse(status="ok" if qdrant_ok else "degraded", qdrant=qdrant_ok)
