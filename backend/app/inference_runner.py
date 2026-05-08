"""Bounded executor + soft-cancel timeout for long-running inference.

ML inference is CPU-bound and synchronous; running it directly inside
a FastAPI request handler ties up a worker thread for the full
duration of the call. A flood of slow requests (or one pathological
input) can therefore exhaust the request thread pool and stop the API
from accepting new connections.

This module fronts those calls with:

* a global ``ThreadPoolExecutor`` sized to ``inference_max_concurrent``
  — past that point new requests fail fast with 503 + ``Retry-After``,
* a per-call ``future.result(timeout=...)`` so the *client* always gets
  a response within ``inference_timeout_seconds`` even if the inference
  thread is still grinding,
* a Semaphore acquired at request entry so the bound is enforced
  before we even submit work to the executor (avoiding the executor's
  own unbounded queue).

Limitation acknowledged in code: Python threads cannot be hard-cancelled
from the outside. When the timeout triggers, the worker thread keeps
running until the underlying call returns; we mark the future as
cancelled-from-the-client's-perspective and let the work complete.
This is good enough as long as the dominant failure mode is "input is
within budget but unusually slow", not "input is intentionally
adversarial". Tightening to hard cancellation would require running
inference in a subprocess; out of scope for this PR but the public API
of this module won't change when we add that.
"""

from __future__ import annotations

import logging
import threading
from concurrent.futures import Future, ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from contextlib import contextmanager
from typing import Callable, Iterator, TypeVar

from fastapi import HTTPException, status

from .config import get_settings

logger = logging.getLogger(__name__)

T = TypeVar("T")


_executor_lock = threading.Lock()
_executor: ThreadPoolExecutor | None = None
_semaphore: threading.BoundedSemaphore | None = None
_executor_max_workers: int = 0


def _get_executor() -> tuple[ThreadPoolExecutor, threading.BoundedSemaphore]:
    """Lazy-initialise the global executor + admission semaphore.

    The size comes from settings at first use; on env reload (test
    fixtures) ``reset_executor`` clears the cache so settings changes
    are picked up.
    """
    global _executor, _semaphore, _executor_max_workers
    with _executor_lock:
        if _executor is None:
            max_workers = max(1, get_settings().inference_max_concurrent)
            _executor = ThreadPoolExecutor(
                max_workers=max_workers,
                thread_name_prefix="inference",
            )
            _semaphore = threading.BoundedSemaphore(max_workers)
            _executor_max_workers = max_workers
        assert _semaphore is not None
        return _executor, _semaphore


def reset_executor() -> None:
    """Test helper — release the executor so settings changes apply."""
    global _executor, _semaphore, _executor_max_workers
    with _executor_lock:
        if _executor is not None:
            _executor.shutdown(wait=False, cancel_futures=True)
        _executor = None
        _semaphore = None
        _executor_max_workers = 0


@contextmanager
def _admission(timeout_seconds: float) -> Iterator[None]:
    """Acquire one of N concurrency slots or raise 503."""
    _, semaphore = _get_executor()
    # We don't block forever — if all slots are busy past the inference
    # timeout, the client is better served by a 503 + Retry-After than
    # by a 30-second hang.
    if not semaphore.acquire(timeout=min(2.0, timeout_seconds)):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Server is processing other inference jobs, please retry.",
            headers={"Retry-After": "5"},
        )
    try:
        yield
    finally:
        semaphore.release()


def run_with_timeout(
    label: str,
    func: Callable[..., T],
    *args,
    timeout_seconds: float | None = None,
    **kwargs,
) -> T:
    """Execute ``func(*args, **kwargs)`` under the inference budget.

    * Caps wall-clock time at ``timeout_seconds`` (defaults to the
      ``inference_timeout_seconds`` setting).
    * Caps concurrency at ``inference_max_concurrent``.
    * Re-raises any exception ``func`` raised — the call site's existing
      try/except blocks keep working unchanged.
    * Raises ``HTTPException(504)`` if the deadline expires.
    """
    settings = get_settings()
    deadline = float(timeout_seconds or settings.inference_timeout_seconds)
    executor, _ = _get_executor()

    with _admission(deadline):
        future: Future[T] = executor.submit(func, *args, **kwargs)
        try:
            return future.result(timeout=deadline)
        except FuturesTimeoutError:
            # The thread keeps running in the background — see module
            # docstring. We log this so a real spike shows up in metrics.
            logger.warning(
                "Inference timeout: label=%s deadline=%.1fs", label, deadline
            )
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Inference exceeded the allowed time budget.",
            )
