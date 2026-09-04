from __future__ import annotations


class CordonError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.headers = headers or {}


class AuthError(CordonError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(401, code, message)


class RateLimitError(CordonError):
    def __init__(self, retry_after: float) -> None:
        wait = max(1, int(retry_after + 0.999))
        super().__init__(
            429,
            "rate_limited",
            "Rate limit exceeded",
            headers={"Retry-After": str(wait)},
        )
        self.retry_after = wait


class UpstreamError(CordonError):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(status_code, "upstream_error", message)
