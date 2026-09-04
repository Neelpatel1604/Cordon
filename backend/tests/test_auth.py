from __future__ import annotations

import pytest

from app.clients.signer import sign_request
from app.errors import AuthError
from app.layers.auth import AuthLayer, NonceStore

SECRET = "demo-secret"
KEY = "demo-key"
PATH = "/v1/chat"
BODY = b'{"messages":[{"role":"user","content":"hi"}]}'


def _auth(window: int = 60) -> AuthLayer:
    return AuthLayer(
        api_keys={KEY: SECRET},
        window_seconds=window,
        nonce_store=NonceStore(ttl_seconds=window),
    )


def _headers(**overrides: str) -> dict[str, str]:
    headers = sign_request("POST", PATH, BODY, KEY, SECRET, timestamp="1000000", nonce="n-1")
    headers.update(overrides)
    return headers


def test_valid_signature() -> None:
    headers = _headers()
    key = _auth().verify(
        method="POST",
        path=PATH,
        body=BODY,
        api_key=headers["X-Api-Key"],
        timestamp=headers["X-Timestamp"],
        nonce=headers["X-Nonce"],
        signature=headers["X-Signature"],
        now=1_000_000,
    )
    assert key == KEY


def test_expired_timestamp() -> None:
    headers = _headers()
    with pytest.raises(AuthError) as exc:
        _auth(window=60).verify(
            method="POST",
            path=PATH,
            body=BODY,
            api_key=headers["X-Api-Key"],
            timestamp=headers["X-Timestamp"],
            nonce=headers["X-Nonce"],
            signature=headers["X-Signature"],
            now=1_000_000 + 120,
        )
    assert exc.value.code == "expired_timestamp"


def test_replayed_nonce() -> None:
    auth = _auth()
    headers = _headers()
    kwargs = {
        "method": "POST",
        "path": PATH,
        "body": BODY,
        "api_key": headers["X-Api-Key"],
        "timestamp": headers["X-Timestamp"],
        "nonce": headers["X-Nonce"],
        "signature": headers["X-Signature"],
        "now": 1_000_000,
    }
    auth.verify(**kwargs)
    with pytest.raises(AuthError) as exc:
        auth.verify(**kwargs)
    assert exc.value.code == "replayed_nonce"


def test_tampered_body() -> None:
    headers = _headers()
    with pytest.raises(AuthError) as exc:
        _auth().verify(
            method="POST",
            path=PATH,
            body=b'{"messages":[{"role":"user","content":"bye"}]}',
            api_key=headers["X-Api-Key"],
            timestamp=headers["X-Timestamp"],
            nonce=headers["X-Nonce"],
            signature=headers["X-Signature"],
            now=1_000_000,
        )
    assert exc.value.code == "invalid_signature"


def test_unknown_key() -> None:
    headers = _headers()
    with pytest.raises(AuthError) as exc:
        _auth().verify(
            method="POST",
            path=PATH,
            body=BODY,
            api_key="other-key",
            timestamp=headers["X-Timestamp"],
            nonce=headers["X-Nonce"],
            signature=headers["X-Signature"],
            now=1_000_000,
        )
    assert exc.value.code == "unknown_key"


def test_missing_headers() -> None:
    with pytest.raises(AuthError) as exc:
        _auth().verify(
            method="POST",
            path=PATH,
            body=BODY,
            api_key=None,
            timestamp=None,
            nonce=None,
            signature=None,
        )
    assert exc.value.code == "missing_credentials"
