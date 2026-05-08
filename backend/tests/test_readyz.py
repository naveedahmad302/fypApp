"""Tests for the /readyz dependency-check probe.

Liveness (/healthz) is a static OK and already covered by smoke tests;
readiness has dependency checks so it gets its own coverage.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("ASD_AUTH_TEST_MODE", "true")
os.environ.setdefault("ASD_FIREBASE_PROJECT_ID", "test-project")

from app.config import reset_settings_cache  # noqa: E402


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("ASD_AUTH_TEST_MODE", "true")
    monkeypatch.setenv("ASD_FIREBASE_PROJECT_ID", "test-project")
    monkeypatch.setenv("ASD_DATABASE_PATH", str(tmp_path / "test.db"))
    reset_settings_cache()

    # Reload main so settings + logging are re-evaluated against the
    # fresh env.
    import importlib

    import app.database
    import app.main

    importlib.reload(app.database)
    importlib.reload(app.main)

    with TestClient(app.main.app) as c:
        yield c

    reset_settings_cache()


def test_healthz_returns_ok(client):
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_readyz_returns_ready_in_test_mode(client):
    res = client.get("/readyz")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ready"
    assert body["checks"]["sqlite"] == "ok"
    # Firebase Admin is skipped under test-mode auth.
    assert body["checks"]["firebase_admin"].startswith("skipped")


def test_readyz_returns_503_when_sqlite_broken(client, monkeypatch):
    """Simulate a corrupted/unreachable SQLite store."""
    import app.main as main_module

    def boom():
        raise RuntimeError("disk full")

    monkeypatch.setattr(main_module, "get_db_health", boom)

    res = client.get("/readyz")
    assert res.status_code == 503
    body = res.json()
    assert body["status"] == "not_ready"
    assert "error" in body["checks"]["sqlite"]


def test_readyz_includes_request_id_header(client):
    """Even healthy /readyz responses get the X-Request-ID correlation header."""
    res = client.get("/readyz")
    assert res.headers.get("X-Request-ID")
