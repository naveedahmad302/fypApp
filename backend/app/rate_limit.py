"""Per-UID, in-process rate limiter.

The limiter is intentionally simple — a sliding-window counter held in
memory, keyed by the verified Firebase UID. It exists to:

* prevent a single signed-in client from spamming heavy ML endpoints
  (eye-tracking / speech / report-generation),
* surface that abuse with a clean 429 + ``Retry-After`` header instead
  of letting the server fall over,
* avoid pulling Redis into the dependency graph for the single-instance
  deployment we currently target.

For multi-process / multi-instance deployments the same dependency
factory pattern works against a Redis backend; that swap is out of
scope for this PR but the public API (``rate_limited_user_id``) won't
change. Document the multi-instance limitation here so a future
operator doesn't accidentally rely on the in-process limiter to police
a horizontally-scaled fleet.

Usage::

    @router.post("/heavy")
    def heavy(uid: str = Depends(rate_limited_user_id("heavy"))):
        ...

The factory returns the same UID that ``require_auth_uid`` would, so
adding rate limiting is a strictly additive change to existing routes.
"""

from __future__ import annotations

import logging
import threading
import time
from collections import deque
from typing import Callable, Deque

from fastapi import Depends, HTTPException, Request, status

from .auth import require_auth_uid
from .config import get_settings

logger = logging.getLogger(__name__)


# Sliding-window counters per (uid, scope, window_size_seconds).
_LOCK = threading.Lock()
_BUCKETS: dict[tuple[str, str, int], Deque[float]] = {}

_SECONDS_PER_MINUTE = 60
_SECONDS_PER_HOUR = 3600


def _evict_old(bucket: Deque[float], cutoff: float) -> None:
    while bucket and bucket[0] < cutoff:
        bucket.popleft()


def _check_window(
    uid: str,
    scope: str,
    window_seconds: int,
    limit: int,
    now: float,
) -> tuple[bool, float]:
    """Return ``(allowed, retry_after_seconds)``.

    ``retry_after_seconds`` is the wall-clock duration the caller must
    wait before the oldest entry exits the window. Always >0 when not
    allowed; 0 when allowed.
    """
    if limit <= 0:
        # Disabled / misconfigured — refuse rather than allowing unbounded.
        return False, float(window_seconds)

    key = (uid, scope, window_seconds)
    with _LOCK:
        bucket = _BUCKETS.setdefault(key, deque())
        cutoff = now - window_seconds
        _evict_old(bucket, cutoff)
        if len(bucket) >= limit:
            retry_after = max(1.0, bucket[0] + window_seconds - now)
            return False, retry_after
        bucket.append(now)
    return True, 0.0


def reset_state() -> None:
    """Test helper — drop all in-memory counters."""
    with _LOCK:
        _BUCKETS.clear()


def rate_limited_user_id(scope: str) -> Callable[..., str]:
    """Build a FastAPI dependency that enforces a rate limit by UID.

    ``scope`` selects which budget applies — currently ``"heavy"`` and
    ``"light"``. Unknown scopes default to the ``light`` budget so a
    typo can't accidentally remove the limit entirely.
    """

    def dependency(
        request: Request,
        uid: str = Depends(require_auth_uid),
    ) -> str:
        settings = get_settings()
        if not settings.rate_limit_enabled:
            return uid

        if scope == "heavy":
            per_minute = settings.rate_limit_heavy_per_minute
            per_hour = settings.rate_limit_heavy_per_hour
        else:
            # Default to light-budget for any unrecognised scope.
            per_minute = settings.rate_limit_light_per_minute
            per_hour = settings.rate_limit_light_per_hour

        now = time.time()

        for window_seconds, limit in (
            (_SECONDS_PER_MINUTE, per_minute),
            (_SECONDS_PER_HOUR, per_hour),
        ):
            allowed, retry_after = _check_window(uid, scope, window_seconds, limit, now)
            if not allowed:
                logger.warning(
                    "Rate limit hit: uid=%s scope=%s window=%ss limit=%s retry=%.1fs",
                    uid,
                    scope,
                    window_seconds,
                    limit,
                    retry_after,
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests, please slow down.",
                    headers={"Retry-After": str(int(retry_after))},
                )

        # Tag the request so downstream handlers (e.g. inference runner)
        # can reuse the verified UID without re-importing the auth dep.
        request.state.user_id = uid
        return uid

    # Hint FastAPI's dependency cache: each scope is a distinct callable
    # so per-route deps don't collide.
    dependency.__name__ = f"rate_limited_user_id__{scope}"
    return dependency
