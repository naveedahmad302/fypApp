"""End-to-end tests for token-expiry / revocation / invalid-token paths.

PR-A introduced Firebase ID-token verification on every protected
endpoint via :func:`app.auth.require_auth_uid`. The success path and
the bare 401-when-anonymous case were already covered by
``test_security.py``; this module pins the behaviour for the three
*specific* failure modes Firebase reports:

* ``ExpiredIdTokenError``  — token's ``exp`` claim is in the past.
* ``RevokedIdTokenError``  — admin SDK called ``revokeRefreshTokens``
  for the user, or the user disabled their account.
* ``InvalidIdTokenError``  — bad signature / wrong audience / malformed.

We exercise the production code path (``ASD_AUTH_TEST_MODE=false``) by
monkey-patching ``firebase_admin.auth.verify_id_token`` and bypassing
``_ensure_firebase_initialised`` so no real network call is needed.

The point of these tests is to catch regressions if the
``except`` ladder in ``app.auth._verify_with_firebase`` is reordered or
if a contributor "simplifies" away the explicit error mapping.
"""

from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def fb_client(monkeypatch):
    """A test client wired to the real Firebase code path (mocked SDK).

    We disable test-mode auth, neutralise the Firebase init check (no
    service account is available in CI), and let individual tests
    monkey-patch ``verify_id_token`` to simulate each error class.
    """
    monkeypatch.setenv("ASD_AUTH_TEST_MODE", "false")
    monkeypatch.setenv("ASD_FIREBASE_PROJECT_ID", "demo-fypapp-test")
    monkeypatch.setenv("ASD_FIREBASE_CREDENTIALS_PATH", "")

    import app.config as config_module
    import app.auth as auth_module

    config_module.reset_settings_cache()
    importlib.reload(auth_module)

    # Pretend Firebase Admin is initialised so the auth path doesn't
    # short-circuit to 503 (the production behaviour we already cover
    # in test_security.py).
    monkeypatch.setattr(
        auth_module, "_ensure_firebase_initialised", lambda: None
    )
    monkeypatch.setattr(auth_module, "_firebase_unavailable_reason", None)

    from app.main import app

    yield TestClient(app)
    config_module.reset_settings_cache()


def _install_verify_stub(monkeypatch, behavior):
    """Replace fb_auth.verify_id_token with a controlled stub.

    ``behavior`` is one of:

    * a ``str`` — name of an exception attribute on the fake fb_auth
      module (``"ExpiredIdTokenError"``, ``"RevokedIdTokenError"``,
      ``"InvalidIdTokenError"``); ``verify_id_token`` will raise an
      instance of that class. The class identity matches what the auth
      module's ``except`` clauses look up because the same fake module
      provides both.
    * an ``Exception`` *type* (e.g. ``RuntimeError``) — raised verbatim;
      used to confirm the generic safety-net branch.
    * a ``dict`` — returned as the decoded token (success path).
    """
    import sys
    import types

    fake_fb = types.ModuleType("firebase_admin")
    fake_fb_auth = types.ModuleType("firebase_admin.auth")

    class ExpiredIdTokenError(Exception):
        pass

    class RevokedIdTokenError(Exception):
        pass

    class InvalidIdTokenError(Exception):
        pass

    fake_fb_auth.ExpiredIdTokenError = ExpiredIdTokenError
    fake_fb_auth.RevokedIdTokenError = RevokedIdTokenError
    fake_fb_auth.InvalidIdTokenError = InvalidIdTokenError

    def verify_id_token(_token, check_revoked=False):
        if isinstance(behavior, str):
            raise getattr(fake_fb_auth, behavior)("simulated")
        if isinstance(behavior, type) and issubclass(behavior, BaseException):
            raise behavior("simulated")
        return behavior  # success path — return the decoded dict

    fake_fb_auth.verify_id_token = verify_id_token
    fake_fb.auth = fake_fb_auth

    monkeypatch.setitem(sys.modules, "firebase_admin", fake_fb)
    monkeypatch.setitem(sys.modules, "firebase_admin.auth", fake_fb_auth)
    return fake_fb_auth


# ---------------------------------------------------------------------------
# Token rejection paths
# ---------------------------------------------------------------------------


def test_expired_token_returns_401(fb_client, monkeypatch):
    _install_verify_stub(monkeypatch, "ExpiredIdTokenError")

    res = fb_client.post(
        "/api/assessment/mcq",
        headers={"Authorization": "Bearer expired-token"},
        json={"answers": [], "user_id": "spoof"},
    )
    assert res.status_code == 401
    body = res.json()
    assert body["error"]["code"] == "unauthorized"
    # Message must hint that re-authentication is required so the app
    # can prompt for sign-in instead of treating it as a generic 401.
    assert "expired" in body["error"]["message"].lower()
    # WWW-Authenticate header signals the right OAuth2 sub-error.
    assert 'invalid_token' in res.headers.get("www-authenticate", "")


def test_revoked_token_returns_401(fb_client, monkeypatch):
    _install_verify_stub(monkeypatch, "RevokedIdTokenError")

    res = fb_client.post(
        "/api/assessment/mcq",
        headers={"Authorization": "Bearer revoked-token"},
        json={"answers": [], "user_id": "spoof"},
    )
    assert res.status_code == 401
    body = res.json()
    assert body["error"]["code"] == "unauthorized"
    assert "revoked" in body["error"]["message"].lower()


def test_invalid_token_returns_401(fb_client, monkeypatch):
    _install_verify_stub(monkeypatch, "InvalidIdTokenError")

    res = fb_client.post(
        "/api/assessment/mcq",
        headers={"Authorization": "Bearer garbage-token"},
        json={"answers": [], "user_id": "spoof"},
    )
    assert res.status_code == 401
    body = res.json()
    assert body["error"]["code"] == "unauthorized"
    # Generic message — must not leak which validation step failed.
    assert "invalid" in body["error"]["message"].lower()
    assert "signature" not in body["error"]["message"].lower()


def test_audience_mismatch_returns_401(fb_client, monkeypatch):
    """A token signed for a different Firebase project is rejected."""
    _install_verify_stub(
        monkeypatch,
        {
            "uid": "spoof-user",
            "user_id": "spoof-user",
            "aud": "some-other-project",
        },
    )
    # The aud check is done by the auth module after verify_id_token
    # returns — no extra plumbing needed.

    res = fb_client.post(
        "/api/assessment/mcq",
        headers={"Authorization": "Bearer foreign-aud-token"},
        json={"answers": [], "user_id": "spoof-user"},
    )
    assert res.status_code == 401
    body = res.json()
    assert body["error"]["code"] == "unauthorized"
    assert "different project" in body["error"]["message"].lower()


def test_token_missing_uid_claim_returns_401(fb_client, monkeypatch):
    """A token whose decoded payload has no uid is rejected."""
    _install_verify_stub(
        monkeypatch,
        {"aud": "demo-fypapp-test"},  # no uid / user_id
    )

    res = fb_client.post(
        "/api/assessment/mcq",
        headers={"Authorization": "Bearer no-uid-token"},
        json={"answers": [], "user_id": "spoof-user"},
    )
    assert res.status_code == 401
    body = res.json()
    assert body["error"]["code"] == "unauthorized"
    assert "uid" in body["error"]["message"].lower()


def test_unhandled_verifier_exception_still_returns_401(fb_client, monkeypatch):
    """Any unexpected SDK error must NOT bubble up as a 500."""

    class WeirdSDKError(RuntimeError):
        pass

    _install_verify_stub(monkeypatch, WeirdSDKError)

    res = fb_client.post(
        "/api/assessment/mcq",
        headers={"Authorization": "Bearer chaos-token"},
        json={"answers": [], "user_id": "spoof"},
    )
    assert res.status_code == 401
    body = res.json()
    assert body["error"]["code"] == "unauthorized"
    # Internal error class name must not be reflected back.
    assert "WeirdSDKError" not in body["error"]["message"]


def test_bearer_scheme_with_empty_credential_returns_401(fb_client):
    """A literal 'Bearer ' with no value short-circuits before the SDK call."""
    res = fb_client.post(
        "/api/assessment/mcq",
        headers={"Authorization": "Bearer "},
        json={"answers": [], "user_id": "spoof"},
    )
    assert res.status_code == 401


def test_non_bearer_scheme_returns_401(fb_client):
    res = fb_client.post(
        "/api/assessment/mcq",
        headers={"Authorization": "Basic abc123"},
        json={"answers": [], "user_id": "spoof"},
    )
    assert res.status_code == 401
