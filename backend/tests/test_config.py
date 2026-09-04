from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.config import Settings


def test_parses_key_pairs() -> None:
    settings = Settings(cordon_api_keys="demo-key:demo-secret,other:s3cret")
    assert settings.api_key_map == {"demo-key": "demo-secret", "other": "s3cret"}


def test_rejects_empty_keys() -> None:
    with pytest.raises(ValidationError):
        Settings(cordon_api_keys="   ")
