"""Structured logging for production observability.

Two formats are supported, switched by ``ASD_LOG_FORMAT``:

* ``json`` (default in production) — one JSON object per line so log
  aggregators (Cloud Logging, Datadog, ELK, Loki, etc.) can index every
  field without grok regexes.
* ``text`` (default in development) — the previous human-readable form,
  useful when tailing logs locally.

In both modes every record is enriched with:

* ``env`` — ``development`` / ``staging`` / ``production`` so a single
  log stream can route alerts per environment.
* ``service`` / ``version`` — fixed identifiers for cross-service
  correlation.
* ``request_id`` — per-request correlation ID from
  :class:`app.middleware.ErrorEnvelopeMiddleware`. Allows a user-facing
  500 to be traced back to the exact server log line.
* ``user_id`` — verified Firebase UID once the auth dependency has run.
  Lets us answer "show me everything user X did this week" without
  joining the access log against a separate audit table.

A redaction filter strips known sensitive payload fields and aggressively
truncates anything that even *looks* like a base64 blob, so log lines
never leak the audio / frame data being submitted for inference.
"""

from __future__ import annotations

import contextvars
import json
import logging
import sys
import time
from typing import Any

from .config import get_settings


# ---------------------------------------------------------------------------
# Per-request context (UID, request ID, route).
# Stored in contextvars so concurrent requests don't trample each other —
# Starlette runs each request in its own asyncio task, which is also each
# its own contextvar copy.
# ---------------------------------------------------------------------------

_request_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "asd_request_id", default=None
)
_user_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "asd_user_id", default=None
)
_route_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "asd_route", default=None
)


def bind_request_id(request_id: str | None) -> contextvars.Token:
    return _request_id_var.set(request_id)


def bind_user_id(user_id: str | None) -> contextvars.Token:
    return _user_id_var.set(user_id)


def bind_route(route: str | None) -> contextvars.Token:
    return _route_var.set(route)


def reset_request_id(token: contextvars.Token) -> None:
    _request_id_var.reset(token)


def reset_user_id(token: contextvars.Token) -> None:
    _user_id_var.reset(token)


def reset_route(token: contextvars.Token) -> None:
    _route_var.reset(token)


# ---------------------------------------------------------------------------
# Redaction
# ---------------------------------------------------------------------------

# Field names whose values must never appear in logs. Match is
# case-insensitive against the dotted access path (e.g. "payload.token").
_SENSITIVE_KEYS = frozenset(
    [
        "password",
        "passcode",
        "pin",
        "secret",
        "token",
        "id_token",
        "access_token",
        "refresh_token",
        "authorization",
        "api_key",
        "apikey",
        "client_id",
        "client_secret",
        "private_key",
        "service_account",
        "audio_base64",
        "frames_base64",
        "frame_base64",
        "image_base64",
        "raw_audio",
        "raw_frame",
    ]
)

# Anything longer than this is presumed to be a payload (audio / frame /
# embedded credential) and is truncated.
_MAX_VALUE_CHARS = 200

# Anything that decodes as ascii base64 of length >= this is also flagged
# as a payload regardless of its key. Cheap heuristic: long values that
# are mostly the base64 alphabet.
_BASE64_HEURISTIC_MIN = 256


def _looks_like_base64(value: str) -> bool:
    if len(value) < _BASE64_HEURISTIC_MIN:
        return False
    base64_alphabet = set(
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n"
    )
    sample = value[:_BASE64_HEURISTIC_MIN]
    matches = sum(1 for ch in sample if ch in base64_alphabet)
    return matches / len(sample) >= 0.95


def _redact_value(key: str, value: Any) -> Any:
    """Recursively redact a single value.

    Return value is JSON-friendly (str / int / float / bool / None / list
    / dict). Any unknown object is repr()'d and length-capped.
    """
    if isinstance(value, dict):
        return {k: _redact_value(str(k), v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_redact_value(key, item) for item in value]
    if isinstance(value, (bytes, bytearray)):
        return f"<bytes len={len(value)}>"
    if isinstance(value, str):
        if key.lower() in _SENSITIVE_KEYS:
            return "<redacted>"
        if _looks_like_base64(value):
            return f"<redacted-payload len={len(value)}>"
        if len(value) > _MAX_VALUE_CHARS:
            return value[:_MAX_VALUE_CHARS] + f"…<truncated len={len(value)}>"
        return value
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    text = repr(value)
    if len(text) > _MAX_VALUE_CHARS:
        text = text[:_MAX_VALUE_CHARS] + "…"
    return text


def redact(payload: Any) -> Any:
    """Public helper — redact a structure before passing it to logging.

    Always use this rather than f-stringing a request body into a log
    message. Example::

        logger.info("submission accepted", extra={"context": redact(body)})
    """
    return _redact_value("", payload)


class _RedactionFilter(logging.Filter):
    """Logging filter that redacts ``record.args`` and ``record.extra``."""

    def filter(self, record: logging.LogRecord) -> bool:
        if record.args:
            try:
                if isinstance(record.args, dict):
                    record.args = _redact_value("", record.args)
                else:
                    record.args = tuple(
                        _redact_value("", arg) for arg in record.args
                    )
            except Exception:  # pragma: no cover - never let logging crash
                pass

        # Anything attached via ``extra={...}`` lives directly on the
        # record. We can't safely walk every attribute (some are internal
        # to logging) so we redact a known allow-list.
        for attr in ("context", "payload", "body", "request", "response"):
            if hasattr(record, attr):
                try:
                    setattr(record, attr, _redact_value(attr, getattr(record, attr)))
                except Exception:  # pragma: no cover
                    pass

        return True


# ---------------------------------------------------------------------------
# Formatters
# ---------------------------------------------------------------------------


_BUILTIN_LOGRECORD_KEYS = frozenset(
    {
        "name",
        "msg",
        "args",
        "levelname",
        "levelno",
        "pathname",
        "filename",
        "module",
        "exc_info",
        "exc_text",
        "stack_info",
        "lineno",
        "funcName",
        "created",
        "msecs",
        "relativeCreated",
        "thread",
        "threadName",
        "processName",
        "process",
        "message",
        "asctime",
        "taskName",
    }
)


class _JsonFormatter(logging.Formatter):
    """Emit one JSON object per record."""

    def __init__(self, env: str, service: str, version: str) -> None:
        super().__init__()
        self._env = env
        self._service = service
        self._version = version

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003
        payload: dict[str, Any] = {
            "timestamp": time.strftime(
                "%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)
            )
            + f".{int(record.msecs):03d}Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "env": self._env,
            "service": self._service,
            "version": self._version,
        }
        request_id = _request_id_var.get()
        if request_id:
            payload["request_id"] = request_id
        user_id = _user_id_var.get()
        if user_id:
            payload["user_id"] = user_id
        route = _route_var.get()
        if route:
            payload["route"] = route

        # Forward any extra fields the caller attached via ``extra={...}``
        # (already redacted by :class:`_RedactionFilter`).
        for key, value in record.__dict__.items():
            if key in _BUILTIN_LOGRECORD_KEYS or key.startswith("_"):
                continue
            try:
                json.dumps(value)
                payload[key] = value
            except (TypeError, ValueError):
                payload[key] = repr(value)

        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str, ensure_ascii=False)


class _TextFormatter(logging.Formatter):
    """Human-readable formatter that still appends request_id / user_id."""

    def __init__(self, env: str) -> None:
        super().__init__(
            fmt="%(asctime)s %(levelname)s %(name)s: %(message)s%(_suffix)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        self._env = env

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003
        suffix_parts = [f"env={self._env}"]
        request_id = _request_id_var.get()
        if request_id:
            suffix_parts.append(f"request_id={request_id}")
        user_id = _user_id_var.get()
        if user_id:
            suffix_parts.append(f"user_id={user_id}")
        record._suffix = " [" + " ".join(suffix_parts) + "]"  # type: ignore[attr-defined]
        return super().format(record)


# ---------------------------------------------------------------------------
# Public setup
# ---------------------------------------------------------------------------


def setup_logging(*, force: bool = False) -> None:
    """Idempotently configure root logging from settings.

    Called from :mod:`app.main` on startup. Tests can pass ``force=True``
    to re-apply settings after toggling ``ASD_LOG_FORMAT``.
    """
    settings = get_settings()
    root = logging.getLogger()
    if not force and getattr(root, "_asd_logging_configured", False):
        return

    # Clear handlers we previously installed so re-runs don't multiply
    # output. Don't touch handlers we didn't add (e.g. pytest's caplog).
    for handler in list(root.handlers):
        if getattr(handler, "_asd_handler", False):
            root.removeHandler(handler)

    handler = logging.StreamHandler(stream=sys.stderr)
    handler._asd_handler = True  # type: ignore[attr-defined]

    log_format = settings.resolved_log_format
    if log_format == "json":
        formatter: logging.Formatter = _JsonFormatter(
            env=settings.env,
            service="asd-detection-api",
            version="1.1.0",
        )
    else:
        formatter = _TextFormatter(env=settings.env)

    handler.setFormatter(formatter)
    handler.addFilter(_RedactionFilter())
    root.addHandler(handler)
    root.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))

    # Quiet down noisy third-party loggers in production. Their logs are
    # still emitted at WARNING+ which is what we care about.
    if settings.is_production:
        for noisy in ("uvicorn.access", "httpx", "httpcore", "h2"):
            logging.getLogger(noisy).setLevel(logging.WARNING)

    root._asd_logging_configured = True  # type: ignore[attr-defined]
