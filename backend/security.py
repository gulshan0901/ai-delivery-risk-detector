import hmac
import os
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import Header, HTTPException, Request, status


_REQUESTS: dict[str, deque[float]] = defaultdict(deque)
_LOCK = Lock()


def require_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    expected = os.getenv("APP_API_KEY")
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API access is not configured.",
        )
    if not x_api_key or not hmac.compare_digest(x_api_key, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid API access key is required.",
            headers={"WWW-Authenticate": "ApiKey"},
        )


def enforce_rate_limit(request: Request, limit: int, window_seconds: int = 60) -> None:
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    client = forwarded or (request.client.host if request.client else "unknown")
    token = request.headers.get("x-api-key", "anonymous")
    bucket_key = f"{client}:{token[:12]}:{request.url.path}"
    now = time.monotonic()

    with _LOCK:
        bucket = _REQUESTS[bucket_key]
        while bucket and bucket[0] <= now - window_seconds:
            bucket.popleft()
        if len(bucket) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Try again shortly.",
                headers={"Retry-After": str(window_seconds)},
            )
        bucket.append(now)
