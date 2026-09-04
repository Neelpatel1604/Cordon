from __future__ import annotations

import hashlib
import hmac
import time
import uuid


def body_sha256(body: bytes) -> str:
    return hashlib.sha256(body).hexdigest()


def canonical_string(
    method: str,
    path: str,
    timestamp: str,
    nonce: str,
    body: bytes,
) -> str:
    return (
        f"{method.upper()}\n{path}\n{timestamp}\n{nonce}\n{body_sha256(body)}"
    )


def compute_signature(secret: str, canonical: str) -> str:
    return hmac.new(
        secret.encode("utf-8"),
        canonical.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def sign_request(
    method: str,
    path: str,
    body: bytes,
    api_key: str,
    secret: str,
    timestamp: str | None = None,
    nonce: str | None = None,
) -> dict[str, str]:
    """Return HMAC headers for a Cordon request."""
    ts = timestamp if timestamp is not None else str(int(time.time()))
    used_nonce = nonce if nonce is not None else uuid.uuid4().hex
    canonical = canonical_string(method, path, ts, used_nonce, body)
    signature = compute_signature(secret, canonical)
    return {
        "X-Api-Key": api_key,
        "X-Timestamp": ts,
        "X-Nonce": used_nonce,
        "X-Signature": signature,
    }
