from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from app.deps import pipeline_dep
from app.pipeline.gateway import GatewayPipeline, extract_chat_text
from app.schemas.chat import ChatRequest

router = APIRouter(tags=["chat"])


@router.post("/chat")
async def chat(
    request: Request,
    pipeline: GatewayPipeline = Depends(pipeline_dep),
) -> JSONResponse:
    raw_body = await request.body()
    try:
        body = json.loads(raw_body)
        ChatRequest.model_validate(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    result, decision, extra_headers = await pipeline.handle(
        method=request.method,
        path=request.url.path,
        raw_body=raw_body,
        headers=dict(request.headers),
        endpoint="chat",
        body=body,
        cache_text=extract_chat_text(body),
    )
    return JSONResponse(
        content=result,
        headers={"X-Cordon-Decision": decision, **extra_headers},
    )
