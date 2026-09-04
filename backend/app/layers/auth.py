from __future__ import annotations

import hmac
import time

from app.clients.signer import canonical_string, compute_signature
from app.errors import AuthError


class NonceStore:
    """In-memory nonce set with TTL-based replay protection."""

    def __init__(self, ttl_seconds: float) -> None:
        self.ttl_seconds = ttl_seconds
        self._seen: dict[str, float] = {}

    def _purge(self, now: float) -> None:
        expired = [nonce for nonce, seen_at in self._seen.items() if now - seen_at > self.ttl_seconds]
        for nonce in expired:
            del self._seen[nonce]

    def check_and_add(self, nonce: str, now: float | None = None) -> bool:
        """Return True if the nonce is new and recorded; False if it is a replay."""
        clock = time.time() if now is None else now
        self._purge(clock)
        if nonce in self._seen:
            return False
        self._seen[nonce] = clock
        return True


class AuthLayer:
    def __init__(self, api_keys: dict[str, str], window_seconds: int, nonce_store: NonceStore) -> None:
        self.api_keys = api_keys
        self.window_seconds = window_seconds
        self.nonce_store = nonce_store

    def verify(
        self,
        *,
        method: str,
        path: str,
        body: bytes,
        api_key: str | None,
        timestamp: str | None,
        nonce: str | None,
        signature: str | None,
        now: float | None = None,
    ) -> str:
        if not api_key or not timestamp or not nonce or not signature:
            raise AuthError("missing_credentials", "Missing signing headers")

        secret = self.api_keys.get(api_key)
        if secret is None:
            raise AuthError("unknown_key", "Unknown API key")

        try:
            ts = float(timestamp)
        except ValueError as exc:
            raise AuthError("invalid_timestamp", "Timestamp must be a unix epoch value") from exc

        clock = time.time() if now is None else now
        if abs(clock - ts) > self.window_seconds:
            raise AuthError("expired_timestamp", "Request timestamp is outside the allowed window")

        expected = compute_signature(
            secret,
            canonical_string(method, path, timestamp, nonce, body),
        )
        if not hmac.compare_digest(expected, signature):
            raise AuthError("invalid_signature", "Signature does not match")

        if not self.nonce_store.check_and_add(nonce, now=clock):
            raise AuthError("replayed_nonce", "Nonce has already been used")

        return api_key
