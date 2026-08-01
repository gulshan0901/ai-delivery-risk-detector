import os
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status


_REQUESTS: dict[str, deque[float]] = defaultdict(deque)
_LOCK = Lock()


def _client_identifier(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    return forwarded or (request.client.host if request.client else "unknown")


def _check(bucket_key: str, limit: int, window_seconds: int) -> None:
    now = time.monotonic()
    with _LOCK:
        bucket = _REQUESTS[bucket_key]
        while bucket and bucket[0] <= now - window_seconds:
            bucket.popleft()
        if len(bucket) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Try again later.",
                headers={"Retry-After": str(window_seconds)},
            )
        bucket.append(now)


def enforce_rate_limits(request: Request) -> None:
    client = _client_identifier(request)
    per_minute = max(1, int(os.getenv("API_RATE_LIMIT_PER_MINUTE", "30")))
    per_hour = max(per_minute, int(os.getenv("API_RATE_LIMIT_PER_HOUR", "300")))
    _check(f"minute:{client}", per_minute, 60)
    _check(f"hour:{client}", per_hour, 3600)
