from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.health import router as health_router
from app.api.v1 import router as v1_router
from app.config import get_settings
from app.errors import CordonError
from app.layers.auth import AuthLayer, NonceStore
from app.layers.coalescer import Coalescer
from app.layers.rate_limit import RateLimiter
from app.layers.semantic_cache import SemanticCache
from app.pipeline.gateway import GatewayPipeline
from app.services.cohere_client import CohereService
from app.services.metrics import MetricsService
from app.services.qdrant_store import QdrantStore


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    qdrant = QdrantStore(settings)
    await _wait_for_qdrant(qdrant)
    cohere = CohereService(settings)
    metrics = MetricsService(
        log_size=settings.metrics_log_size,
        latency_window=settings.metrics_latency_window,
    )
    pipeline = GatewayPipeline(
        auth=AuthLayer(
            api_keys=settings.api_key_map,
            window_seconds=settings.auth_window_seconds,
            nonce_store=NonceStore(ttl_seconds=settings.auth_window_seconds),
        ),
        rate_limiter=RateLimiter(
            capacity=settings.rate_limit_capacity,
            refill_per_sec=settings.rate_limit_refill_per_sec,
        ),
        cache=SemanticCache(
            store=qdrant,
            embedder=cohere,
            threshold=settings.cache_similarity_threshold,
            retrieve_threshold=settings.cache_retrieve_threshold,
            reranker=cohere,
            rerank_threshold=settings.cache_rerank_threshold,
            rerank_candidates=settings.cache_rerank_candidates,
        ),
        coalescer=Coalescer(),
        cohere=cohere,
        metrics=metrics,
    )
    app.state.settings = settings
    app.state.qdrant = qdrant
    app.state.cohere = cohere
    app.state.metrics = metrics
    app.state.pipeline = pipeline
    try:
        yield
    finally:
        await cohere.close()
        await qdrant.close()


app = FastAPI(
    title="Cordon",
    description="A gateway that makes serving Cohere's API cheaper, safer, and more resilient.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-Cordon-Decision",
        "X-Cordon-Cache-Score",
        "X-Cordon-Cache-Match",
        "X-Cordon-Cache-Via",
        "X-Cordon-Cache-Need",
        "X-Cordon-Cache-Gray",
        "Retry-After",
    ],
)

app.include_router(health_router)
app.include_router(v1_router)


async def _wait_for_qdrant(qdrant: QdrantStore, attempts: int = 30, delay: float = 0.5) -> None:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            await qdrant.ensure_collection()
            return
        except Exception as exc:
            last_error = exc
            await asyncio.sleep(delay)
    raise RuntimeError(f"Qdrant is not reachable at startup: {last_error}") from last_error


@app.exception_handler(CordonError)
async def cordon_error_handler(_request: Request, exc: CordonError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.code, "message": exc.message},
        headers=exc.headers,
    )
