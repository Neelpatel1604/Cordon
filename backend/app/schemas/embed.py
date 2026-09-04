from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class EmbedRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    model: str | None = None
    texts: list[str] = Field(min_length=1)
    input_type: str | None = None
    embedding_types: list[str] | None = None
    output_dimension: int | None = None
