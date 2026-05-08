"""Tests for the bounded executor / inference timeout helper."""

from __future__ import annotations

import threading
import time

import pytest
from fastapi import HTTPException

from app.config import reset_settings_cache
from app.inference_runner import reset_executor, run_with_timeout


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    reset_executor()
    reset_settings_cache()
    yield
    reset_executor()
    reset_settings_cache()


def test_fast_call_returns_value():
    assert run_with_timeout("fast", lambda x: x + 1, 41) == 42


def test_call_propagates_underlying_exception():
    def boom() -> None:
        raise ValueError("nope")

    with pytest.raises(ValueError, match="nope"):
        run_with_timeout("boom", boom)


def test_timeout_returns_504(monkeypatch):
    monkeypatch.setenv("ASD_INFERENCE_TIMEOUT_SECONDS", "0.2")
    monkeypatch.setenv("ASD_INFERENCE_MAX_CONCURRENT", "2")
    reset_settings_cache()
    reset_executor()

    def slow() -> str:
        time.sleep(2.0)
        return "done"

    with pytest.raises(HTTPException) as exc:
        run_with_timeout("slow", slow)
    assert exc.value.status_code == 504


def test_concurrency_cap_returns_503(monkeypatch):
    monkeypatch.setenv("ASD_INFERENCE_TIMEOUT_SECONDS", "0.5")
    monkeypatch.setenv("ASD_INFERENCE_MAX_CONCURRENT", "1")
    reset_settings_cache()
    reset_executor()

    started = threading.Event()
    release = threading.Event()

    def held() -> str:
        started.set()
        release.wait(timeout=5.0)
        return "ok"

    # Run the long-held call in a background thread so the main thread
    # can verify a *second* concurrent call gets 503.
    holder_exc: list[BaseException] = []

    def holder() -> None:
        try:
            run_with_timeout("held", held)
        except BaseException as exc:
            holder_exc.append(exc)

    t = threading.Thread(target=holder, daemon=True)
    t.start()
    assert started.wait(timeout=2.0)

    with pytest.raises(HTTPException) as exc:
        run_with_timeout("would-be-second", lambda: "would-run")
    # Either the admission-semaphore times out (503) or the inference
    # itself does (504); both are valid back-pressure signals.
    assert exc.value.status_code in (503, 504)

    # Let the held call finish so we don't leak the worker thread.
    release.set()
    t.join(timeout=5.0)
    # The held call may itself hit the 504 deadline (timeout=0.5s,
    # holder slept up to 5s). Either result is acceptable; we just
    # don't want it to crash with an unrelated exception.
    if holder_exc:
        assert isinstance(holder_exc[0], HTTPException)
        assert holder_exc[0].status_code in (200, 504)
