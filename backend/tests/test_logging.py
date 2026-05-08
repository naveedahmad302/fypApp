"""Tests for the structured logging stack.

Covers:

* ``redact()`` blanks sensitive keys and truncates payload-shaped values.
* ``_RedactionFilter`` runs against records emitted via standard logging.
* JSON formatter produces a single parseable object per log line.
* Per-request contextvars (``request_id`` / ``user_id`` / ``route``) land
  on log lines emitted while a request is in flight, but are absent on
  log lines emitted outside a request.
"""

from __future__ import annotations

import io
import json
import logging
import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Tests must run before any module reads settings; the test stub auth is
# also required for end-to-end /readyz exercises.
os.environ.setdefault("ASD_AUTH_TEST_MODE", "true")

from app.config import reset_settings_cache  # noqa: E402
from app.logging_config import (  # noqa: E402
    bind_request_id,
    bind_route,
    bind_user_id,
    redact,
    reset_request_id,
    reset_route,
    reset_user_id,
    setup_logging,
    _JsonFormatter,
    _RedactionFilter,
)


# ---------------------------------------------------------------------------
# redact()
# ---------------------------------------------------------------------------


def test_redact_strips_known_sensitive_keys():
    payload = {
        "email": "alice@example.com",
        "password": "hunter2",
        "id_token": "eyJ-some-jwt",
        "nested": {"refresh_token": "secret"},
    }
    out = redact(payload)
    assert out["email"] == "alice@example.com"
    assert out["password"] == "<redacted>"
    assert out["id_token"] == "<redacted>"
    assert out["nested"]["refresh_token"] == "<redacted>"


def test_redact_truncates_long_payload_strings():
    blob = "x" * 5000
    out = redact({"audio_base64": blob})
    assert out["audio_base64"] == "<redacted>"


def test_redact_blanks_value_that_looks_like_base64_even_with_innocuous_key():
    # Long ascii base64-shaped value under a name that isn't on the
    # sensitive list — should still be blanked because the heuristic
    # fires on shape.
    blob = "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=" * 50
    out = redact({"opaque_field": blob})
    assert out["opaque_field"].startswith("<redacted-payload len=")


def test_redact_passes_short_strings_unchanged():
    assert redact({"note": "hello"}) == {"note": "hello"}


def test_redact_handles_lists_of_payloads():
    blob = "Z" * 4000
    out = redact({"frames": [blob, blob]})
    assert out["frames"] == ["<redacted-payload len=4000>", "<redacted-payload len=4000>"]


def test_redact_keeps_numerics_and_bools_intact():
    out = redact({"count": 42, "flag": True, "ratio": 3.14, "nullable": None})
    assert out == {"count": 42, "flag": True, "ratio": 3.14, "nullable": None}


# ---------------------------------------------------------------------------
# _RedactionFilter on real LogRecord
# ---------------------------------------------------------------------------


def test_redaction_filter_redacts_extra_context():
    record = logging.LogRecord(
        name="test", level=logging.INFO, pathname=__file__, lineno=1,
        msg="submission", args=(), exc_info=None,
    )
    record.context = {"audio_base64": "X" * 4000, "uid": "alice"}
    _RedactionFilter().filter(record)
    assert record.context["audio_base64"] == "<redacted>"
    assert record.context["uid"] == "alice"


def test_redaction_filter_handles_args_dict():
    # LogRecord auto-unwraps a length-1 tuple of Mapping into a bare
    # dict (so logger.info("%(x)s", {"x": 1}) works), so we pass a
    # 1-tuple containing the dict to match real call sites.
    record = logging.LogRecord(
        name="test", level=logging.INFO, pathname=__file__, lineno=1,
        msg="hi %(token)s", args=({"token": "secret-jwt"},), exc_info=None,
    )
    _RedactionFilter().filter(record)
    assert record.args == {"token": "<redacted>"}


# ---------------------------------------------------------------------------
# JSON formatter end-to-end
# ---------------------------------------------------------------------------


@pytest.fixture
def json_logger(monkeypatch):
    """Spin up a logger that writes one JSON record per emit to a buffer."""
    monkeypatch.setenv("ASD_ENV", "production")
    monkeypatch.setenv("ASD_LOG_FORMAT", "json")
    monkeypatch.setenv("ASD_AUTH_TEST_MODE", "true")
    monkeypatch.setenv("ASD_FIREBASE_PROJECT_ID", "test-project")
    reset_settings_cache()

    buffer = io.StringIO()
    handler = logging.StreamHandler(stream=buffer)
    handler.setFormatter(
        _JsonFormatter(env="production", service="asd-test", version="0.0.0")
    )
    handler.addFilter(_RedactionFilter())

    logger = logging.getLogger("asd-test-logger")
    logger.handlers = [handler]
    logger.setLevel(logging.INFO)
    logger.propagate = False

    yield logger, buffer

    logger.handlers = []
    reset_settings_cache()


def _last_json_line(buffer: io.StringIO) -> dict:
    line = buffer.getvalue().strip().splitlines()[-1]
    return json.loads(line)


def test_json_formatter_emits_parseable_record(json_logger):
    logger, buffer = json_logger
    logger.info("hello world")
    record = _last_json_line(buffer)
    assert record["message"] == "hello world"
    assert record["level"] == "INFO"
    assert record["env"] == "production"
    assert record["service"] == "asd-test"


def test_json_formatter_includes_bound_request_context(json_logger):
    logger, buffer = json_logger
    rid = bind_request_id("req-abc")
    uid = bind_user_id("user-xyz")
    route = bind_route("POST /api/assessment/eye-tracking")
    try:
        logger.info("submission accepted")
    finally:
        reset_route(route)
        reset_user_id(uid)
        reset_request_id(rid)

    record = _last_json_line(buffer)
    assert record["request_id"] == "req-abc"
    assert record["user_id"] == "user-xyz"
    assert record["route"] == "POST /api/assessment/eye-tracking"


def test_json_formatter_omits_request_context_when_unbound(json_logger):
    logger, buffer = json_logger
    logger.info("no context here")
    record = _last_json_line(buffer)
    assert "request_id" not in record
    assert "user_id" not in record


def test_json_formatter_redacts_payload_in_extra(json_logger):
    logger, buffer = json_logger
    logger.info("audio in", extra={"context": {"audio_base64": "Z" * 9000}})
    record = _last_json_line(buffer)
    assert record["context"]["audio_base64"] == "<redacted>"


# ---------------------------------------------------------------------------
# setup_logging() idempotency
# ---------------------------------------------------------------------------


def test_setup_logging_does_not_install_duplicate_handlers(monkeypatch):
    monkeypatch.setenv("ASD_ENV", "production")
    monkeypatch.setenv("ASD_LOG_FORMAT", "json")
    monkeypatch.setenv("ASD_AUTH_TEST_MODE", "true")
    monkeypatch.setenv("ASD_FIREBASE_PROJECT_ID", "test-project")
    reset_settings_cache()

    root = logging.getLogger()
    # Strip any existing handlers we previously installed.
    for handler in list(root.handlers):
        if getattr(handler, "_asd_handler", False):
            root.removeHandler(handler)
    setattr(root, "_asd_logging_configured", False)

    setup_logging(force=True)
    setup_logging()  # second call should be a no-op
    setup_logging()

    asd_handlers = [h for h in root.handlers if getattr(h, "_asd_handler", False)]
    assert len(asd_handlers) == 1

    # Cleanup so other tests don't see our handler.
    for handler in asd_handlers:
        root.removeHandler(handler)
    setattr(root, "_asd_logging_configured", False)
    reset_settings_cache()
