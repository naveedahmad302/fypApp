"""End-to-end security tests for PR-A.

Covers:
* Anonymous requests are rejected with 401.
* Bearer-token auth is required.
* Cross-user data access is prevented.
* Payload-size caps are enforced.
* /healthz remains public.
* Error envelope is stable and never leaks tracebacks in production.
"""

from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------


def test_healthz_is_public(client: TestClient):
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_security_headers_present(client: TestClient):
    res = client.get("/healthz")
    # X-Content-Type-Options, X-Frame-Options etc. are always attached.
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert "Content-Security-Policy" in res.headers


def test_root_has_request_id(client: TestClient):
    res = client.get("/")
    assert "x-request-id" in res.headers


# ---------------------------------------------------------------------------
# Authentication on protected endpoints
# ---------------------------------------------------------------------------


PROTECTED_ENDPOINTS = [
    ("GET", "/api/assessment/report", None),
    ("GET", "/api/assessment/history", None),
    ("GET", "/api/assessment/questions", None),
    ("POST", "/api/assessment/eye-tracking", {"frames_base64": ["abc"]}),
    ("POST", "/api/assessment/speech", {"audio_base64": "abc", "audio_format": "wav"}),
    ("POST", "/api/assessment/mcq", {"answers": [{"question_id": 1, "selected_option": 0}]}),
    ("POST", "/api/assessment/report/generate", {"mcq_assessment_id": "x"}),
]


@pytest.mark.parametrize("method,path,body", PROTECTED_ENDPOINTS)
def test_anonymous_is_rejected(client: TestClient, method, path, body):
    res = client.request(method, path, json=body)
    assert res.status_code == 401, f"{method} {path} expected 401, got {res.status_code}"
    payload = res.json()
    assert payload["error"]["code"] == "unauthorized"
    # Ensure no traceback / internal detail leaks.
    assert "Traceback" not in payload["error"]["message"]


@pytest.mark.parametrize("method,path,body", PROTECTED_ENDPOINTS)
def test_invalid_token_is_rejected(client: TestClient, method, path, body):
    res = client.request(method, path, headers={"Authorization": "Bearer bogus"}, json=body)
    assert res.status_code == 401, f"{method} {path} expected 401, got {res.status_code}"


@pytest.mark.parametrize("method,path,body", PROTECTED_ENDPOINTS)
def test_wrong_scheme_is_rejected(client: TestClient, method, path, body):
    # `Bearer` is required; Basic / token / etc. must all fail.
    res = client.request(method, path, headers={"Authorization": "Basic abc"}, json=body)
    assert res.status_code in (401, 403)


def test_authed_history_returns_empty_for_new_user(authed_client):
    client, _ = authed_client
    res = client.get("/api/assessment/history")
    assert res.status_code == 200
    assert res.json()["total_count"] == 0


def test_authed_questions_returns_question_bank(authed_client):
    client, _ = authed_client
    res = client.get("/api/assessment/questions")
    assert res.status_code == 200
    body = res.json()
    assert body["total_count"] >= 1
    assert "questions" in body


# ---------------------------------------------------------------------------
# Cross-user isolation
# ---------------------------------------------------------------------------


def test_legacy_history_path_returns_empty_for_other_user(authed_client, other_user_token):
    client, my_uid = authed_client
    # Alice queries Bob's history via the legacy path — should return empty
    # rather than leaking whether bob exists.
    res = client.get("/api/assessment/history/user-test-bob")
    assert res.status_code == 200
    body = res.json()
    assert body["user_id"] == my_uid
    assert body["total_count"] == 0


def test_legacy_report_path_for_other_user_returns_404(authed_client, other_user_token):
    client, _ = authed_client
    res = client.get("/api/assessment/report/user-test-bob")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"


# ---------------------------------------------------------------------------
# Payload caps
# ---------------------------------------------------------------------------


def test_oversized_eye_tracking_frame_count_is_rejected(authed_client):
    client, _ = authed_client
    payload = {"frames_base64": ["tiny"] * 10_000}
    res = client.post("/api/assessment/eye-tracking", json=payload)
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "payload_too_large"


def test_unsupported_audio_format_is_rejected(authed_client):
    client, _ = authed_client
    payload = {"audio_base64": "AAAA", "audio_format": "wma"}
    res = client.post("/api/assessment/speech", json=payload)
    assert res.status_code == 415
    assert res.json()["error"]["code"] == "unsupported_media_type"


def test_oversized_request_body_is_rejected(authed_client):
    client, _ = authed_client
    # Forge an outsized Content-Length to trip the middleware before
    # FastAPI even reads the body. We send a small body on purpose.
    big_cl = str(2 * 10**9)
    res = client.post(
        "/api/assessment/speech",
        headers={"Content-Length": big_cl},
        json={"audio_base64": "x", "audio_format": "wav"},
    )
    assert res.status_code == 413


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------


def test_cors_preflight_allows_known_origin(client: TestClient):
    res = client.options(
        "/api/assessment/history",
        headers={
            "Origin": "http://localhost:8081",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization",
        },
    )
    # 200 on the preflight + ACAO header reflecting the allowed origin.
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == "http://localhost:8081"


def test_cors_blocks_unknown_origin(client: TestClient):
    res = client.options(
        "/api/assessment/history",
        headers={
            "Origin": "http://evil.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    # FastAPI's CORS middleware omits the header when the origin is not allowed.
    assert "access-control-allow-origin" not in res.headers


# ---------------------------------------------------------------------------
# Production hardening
# ---------------------------------------------------------------------------


def test_production_rejects_wildcard_cors(monkeypatch):
    """Settings should refuse a wildcard origin when env=production."""
    from app import config

    monkeypatch.setenv("ASD_ENV", "production")
    monkeypatch.setenv("ASD_CORS_ALLOWED_ORIGINS", "*")
    config.reset_settings_cache()
    importlib.reload(config)

    with pytest.raises(Exception):
        config.Settings()
