from fastapi import APIRouter

from app.api.v1 import chat, embed, metrics

router = APIRouter(prefix="/v1")
router.include_router(chat.router)
router.include_router(embed.router)
router.include_router(metrics.router)
