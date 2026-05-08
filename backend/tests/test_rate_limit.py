"""Tests for the per-UID rate limiter dependency."""

from __future__ import annotations

import os
import time

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

# Ensure the auth dep accepts in-memory tokens before the limiter loads
# settings (see conftest.py for the standard fixtures).
os.environ.setdefault("ASD_AUTH_TEST_MODE", "true")

from app.config import reset_settings_cache  # noqa: E402
from app.rate_limit import rate_limited_user_id, reset_state  # noqa: E402


@pytest.fixture
def heavy_app(monkeypatch):
    """Build a tiny FastAPI app gated on the heavy budget.

    Uses tight limits so the test runs in milliseconds without ever
    sleeping for a real minute.
    """
    monkeypatch.setenv("ASD_RATE_LIMIT_HEAVY_PER_MINUTE", "3")
    monkeypatch.setenv("ASD_RATE_LIMIT_HEAVY_PER_HOUR", "5")
    monkeypatch.setenv("ASD_RATE_LIMIT_LIGHT_PER_MINUTE", "60")
    monkeypatch.setenv("ASD_RATE_LIMIT_LIGHT_PER_HOUR", "600")
    monkeypatch.setenv("ASD_RATE_LIMIT_ENABLED", "true")
    reset_settings_cache()
    reset_state()

    app = FastAPI()

    @app.get("/heavy")
    def heavy(uid: str = Depends(rate_limited_user_id("heavy"))) -> dict:
        return {"uid": uid}

    @app.get("/light")
    def light(uid: str = Depends(rate_limited_user_id("light"))) -> dict:
        return {"uid": uid}

    yield app
    reset_state()
    reset_settings_cache()


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _register(token: str, uid: str) -> None:
    """Mint an in-memory token in the auth-test-mode registry."""
    from app.auth import _TEST_TOKENS  # type: ignore[attr-defined]

    _TEST_TOKENS[token] = uid


def test_heavy_limit_enforced_per_user(heavy_app):
    _register("alice-tok", "alice")
    client = TestClient(heavy_app)

    for _ in range(3):
        resp = client.get("/heavy", headers=_bearer("alice-tok"))
        assert resp.status_code == 200, resp.text

    blocked = client.get("/heavy", headers=_bearer("alice-tok"))
    assert blocked.status_code == 429
    assert blocked.headers.get("Retry-After")


def test_heavy_limit_is_per_uid_not_global(heavy_app):
    _register("alice-tok", "alice")
    _register("bob-tok", "bob")
    client = TestClient(heavy_app)

    for _ in range(3):
        assert client.get("/heavy", headers=_bearer("alice-tok")).status_code == 200
    # Alice exhausted — Bob still has full budget.
    for _ in range(3):
        assert client.get("/heavy", headers=_bearer("bob-tok")).status_code == 200


def test_light_limit_does_not_share_budget_with_heavy(heavy_app):
    """Heavy and light scopes have independent counters."""
    _register("alice-tok", "alice")
    client = TestClient(heavy_app)

    for _ in range(3):
        assert client.get("/heavy", headers=_bearer("alice-tok")).status_code == 200
    assert client.get("/heavy", headers=_bearer("alice-tok")).status_code == 429
    # Light endpoint untouched.
    assert client.get("/light", headers=_bearer("alice-tok")).status_code == 200


def test_anonymous_request_is_rejected_before_rate_limiter(heavy_app):
    """The auth dep runs first; no token == 401, not 429."""
    client = TestClient(heavy_app)
    resp = client.get("/heavy")
    assert resp.status_code == 401


def test_disabled_limiter_passes_all_requests(monkeypatch, heavy_app):
    monkeypatch.setenv("ASD_RATE_LIMIT_ENABLED", "false")
    reset_settings_cache()
    reset_state()

    _register("alice-tok", "alice")
    client = TestClient(heavy_app)
    # 10 requests against a 3/minute limit — all succeed because the
    # master switch is off.
    for _ in range(10):
        assert client.get("/heavy", headers=_bearer("alice-tok")).status_code == 200


def test_window_eviction_releases_oldest_entries():
    """Synthetic test of the window logic without real sleeps."""
    from app.rate_limit import _check_window  # type: ignore[attr-defined]

    reset_state()
    now = time.time()

    # Fill the bucket within a 60s window.
    for _ in range(3):
        allowed, _ = _check_window("u1", "heavy", 60, 3, now)
        assert allowed
    blocked, retry = _check_window("u1", "heavy", 60, 3, now)
    assert not blocked
    assert retry > 0

    # Pretend 61 seconds have passed; oldest entries fall out.
    later = now + 61
    allowed, _ = _check_window("u1", "heavy", 60, 3, later)
    assert allowed
