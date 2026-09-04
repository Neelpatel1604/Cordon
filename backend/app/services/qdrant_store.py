from __future__ import annotations

import time
import uuid
from typing import Any

from qdrant_client import AsyncQdrantClient
from qdrant_client.http.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PayloadSchemaType,
    PointIdsList,
    PointStruct,
    Range,
    VectorParams,
)

from app.config import Settings


class QdrantStore:
    def __init__(self, settings: Settings, client: AsyncQdrantClient | None = None) -> None:
        self.settings = settings
        self.collection = settings.qdrant_collection
        self.client = client or AsyncQdrantClient(url=settings.qdrant_url)

    async def close(self) -> None:
        close = getattr(self.client, "close", None)
        if close is None:
            return
        result = close()
        if hasattr(result, "__await__"):
            await result

    async def ping(self) -> bool:
        try:
            await self.client.get_collections()
            return True
        except Exception:
            return False

    async def ensure_collection(self) -> None:
        exists = await self.client.collection_exists(self.collection)
        if not exists:
            await self.client.create_collection(
                collection_name=self.collection,
                vectors_config=VectorParams(
                    size=self.settings.cache_vector_size,
                    distance=Distance.COSINE,
                ),
            )
        for field_name, schema in (
            ("endpoint", PayloadSchemaType.KEYWORD),
            ("expires_at", PayloadSchemaType.FLOAT),
            ("created_at", PayloadSchemaType.FLOAT),
        ):
            try:
                await self.client.create_payload_index(
                    collection_name=self.collection,
                    field_name=field_name,
                    field_schema=schema,
                )
            except Exception:
                # Index may already exist after a restart.
                continue

    async def search(
        self,
        endpoint: str,
        vector: list[float],
        threshold: float,
    ) -> dict[str, Any] | None:
        now = time.time()
        query_filter = Filter(
            must=[
                FieldCondition(key="endpoint", match=MatchValue(value=endpoint)),
                FieldCondition(key="expires_at", range=Range(gt=now)),
            ]
        )
        result = await self.client.query_points(
            collection_name=self.collection,
            query=vector,
            query_filter=query_filter,
            limit=1,
            with_payload=True,
            score_threshold=threshold,
        )
        hits = result.points
        if not hits:
            return None
        top = hits[0]
        payload = top.payload or {}
        response = payload.get("response")
        if not isinstance(response, dict):
            return None
        return response

    async def upsert(
        self,
        endpoint: str,
        vector: list[float],
        text: str,
        response: dict[str, Any],
    ) -> None:
        now = time.time()
        point_id = str(uuid.uuid4())
        await self.client.upsert(
            collection_name=self.collection,
            points=[
                PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={
                        "endpoint": endpoint,
                        "text": text,
                        "response": response,
                        "created_at": now,
                        "expires_at": now + self.settings.cache_ttl_seconds,
                    },
                )
            ],
        )
        await self._evict_if_needed()

    async def _evict_if_needed(self) -> None:
        count_result = await self.client.count(collection_name=self.collection, exact=True)
        total = int(count_result.count)
        overflow = total - self.settings.cache_max_entries
        if overflow <= 0:
            return
        records, _ = await self.client.scroll(
            collection_name=self.collection,
            limit=min(total, self.settings.cache_max_entries + overflow),
            with_payload=["created_at"],
            with_vectors=False,
        )
        oldest = sorted(records, key=lambda record: (record.payload or {}).get("created_at", 0.0))
        to_delete = [record.id for record in oldest[:overflow]]
        if to_delete:
            await self.client.delete(
                collection_name=self.collection,
                points_selector=PointIdsList(points=to_delete),
            )
