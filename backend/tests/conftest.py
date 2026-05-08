"""Shared pytest fixtures for the backend test suite.

Tests run with ``ASD_AUTH_TEST_MODE=true`` and an isolated SQLite path
so they never contact Firebase or touch the dev database.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

# These env vars must be set BEFORE importing the app module so that
# `Settings()` picks them up. Pytest collects this file before any test
# module is imported, so this runs first.
_TMP_DB = Path(tempfile.mkdtemp(prefix="asd-tests-")) / "app.db"
os.environ.setdefault("ASD_AUTH_TEST_MODE", "true")
os.environ.setdefault("ASD_ENV", "development")
os.environ.setdefault("DATABASE_PATH", str(_TMP_DB))
os.environ.setdefault(
    "ASD_CORS_ALLOWED_ORIGINS",
    "http://localhost:8081,http://localhost:19006",
)

import pytest  # noqa: E402  (env vars must be set first)
from fastapi.testclient import TestClient  # noqa: E402

from app.auth import clear_test_tokens, register_test_token  # noqa: E402
from app.config import reset_settings_cache  # noqa: E402
from app.database import init_db  # noqa: E402
from app.main import app  # noqa: E402

# Ensure schema exists for tests (lifespan only fires inside the
# TestClient context manager, but most tests use the bare client).
init_db()


@pytest.fixture(autouse=True)
def _reset_test_state():
    """Ensure a clean auth state between tests."""
    clear_test_tokens()
    reset_settings_cache()
    yield
    clear_test_tokens()


@pytest.fixture
def client() -> TestClient:
    """Plain FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def authed_client(client: TestClient) -> tuple[TestClient, str]:
    """Test client with a registered token + UID. Returns (client, uid)."""
    uid = "user-test-alice"
    register_test_token("alice-token", uid)
    client.headers.update({"Authorization": "Bearer alice-token"})
    return client, uid


@pytest.fixture
def other_user_token() -> str:
    """A second registered user, useful for cross-user isolation tests."""
    register_test_token("bob-token", "user-test-bob")
    return "bob-token"
