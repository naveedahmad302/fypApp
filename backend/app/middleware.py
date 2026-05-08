"""HTTP middleware: payload-size cap, security headers, error envelope.

Each middleware here is small, single-purpose and order-sensitive — the
order is set in :mod:`app.main`. Keeping them isolated makes them easy to
reuse and unit-test.
"""

from __future__ import annotations

import logging
import uuid
from typing import Awaitable, Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .config import get_settings


logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Request body size cap
# ---------------------------------------------------------------------------


class MaxBodySizeMiddleware(BaseHTTPMiddleware):
    """Reject any request whose Content-Length exceeds the configured cap.

    We intentionally rely on the declared Content-Length header rather
    than streaming the full body — checking after the fact would already
    have allowed an attacker to consume server memory. Requests without a
    Content-Length header (chunked uploads) are rejected outright on
    write endpoints.
    """

    def __init__(self, app, max_bytes: int) -> None:
        super().__init__(app)
        self.max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        if request.method in ("POST", "PUT", "PATCH"):
            cl_header = request.headers.get("content-length")
            if cl_header is None:
                # Chunked / unknown length — reject defensively.
                return JSONResponse(
                    status_code=411,
                    content={
                        "error": {
                            "code": "length_required",
                            "message": "Content-Length header is required.",
                        }
                    },
                )
            try:
                content_length = int(cl_header)
            except ValueError:
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": {
                            "code": "bad_request",
                            "message": "Invalid Content-Length header.",
                        }
                    },
                )
            if content_length > self.max_bytes:
                return JSONResponse(
                    status_code=413,
                    content={
                        "error": {
                            "code": "payload_too_large",
                            "message": (
                                f"Request body exceeds the {self.max_bytes} byte limit."
                            ),
                        }
                    },
                )
        return await call_next(request)


# ---------------------------------------------------------------------------
# Security headers
# ---------------------------------------------------------------------------


_DEFAULT_SECURITY_HEADERS = {
    # Content-Type sniffing protection.
    "X-Content-Type-Options": "nosniff",
    # Disallow rendering inside frames (clickjacking).
    "X-Frame-Options": "DENY",
    # Don't leak internal URLs via Referer.
    "Referrer-Policy": "no-referrer",
    # Lock down powerful APIs by default.
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    # CSP for the (small) JSON API surface — no inline scripts allowed.
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach a hardened set of HTTP security headers to every response."""

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        response: Response = await call_next(request)
        for header, value in _DEFAULT_SECURITY_HEADERS.items():
            response.headers.setdefault(header, value)
        # HSTS only makes sense over HTTPS — set it conditionally.
        if request.url.scheme == "https" or get_settings().is_production:
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=63072000; includeSubDomains",
            )
        return response


# ---------------------------------------------------------------------------
# Sanitised error envelope
# ---------------------------------------------------------------------------


class ErrorEnvelopeMiddleware(BaseHTTPMiddleware):
    """Catch unhandled exceptions and return a stable JSON shape.

    In production we never expose the underlying ``str(exc)`` because
    Python tracebacks tend to leak file paths, dependency versions and
    sometimes credentials. We return a request-scoped correlation ID
    instead so operators can match a user-facing 500 to a server log
    line.
    """

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        from .logging_config import (
            bind_request_id,
            bind_route,
            bind_user_id,
            reset_request_id,
            reset_route,
            reset_user_id,
        )

        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        # Bind correlation id + route on the contextvars so every log
        # line emitted while handling this request includes them.
        rid_token = bind_request_id(request_id)
        route_token = bind_route(f"{request.method} {request.url.path}")
        # Reset user_id at request start; auth dep will set it once the
        # token is verified.
        uid_token = bind_user_id(None)
        try:
            try:
                response = await call_next(request)
            except Exception as exc:  # pragma: no cover - exercised by tests
                settings = get_settings()
                logger.exception(
                    "Unhandled error in request %s: %s", request_id, exc
                )
                payload = {
                    "error": {
                        "code": "internal_error",
                        "message": "Internal server error.",
                        "request_id": request_id,
                    }
                }
                if settings.expose_internal_errors:
                    payload["error"]["debug"] = str(exc)
                return JSONResponse(status_code=500, content=payload)

            response.headers.setdefault("X-Request-ID", request_id)
            return response
        finally:
            reset_user_id(uid_token)
            reset_route(route_token)
            reset_request_id(rid_token)


# ---------------------------------------------------------------------------
# Helper: standard error responses for HTTPExceptions
# ---------------------------------------------------------------------------


def http_exception_handler(request: Request, exc) -> JSONResponse:
    """Wrap FastAPI's HTTPException output in our standard envelope."""
    code = exc.status_code
    detail = exc.detail
    # Prefer a short slug for known statuses; fall back to "http_error".
    slug = {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        413: "payload_too_large",
        415: "unsupported_media_type",
        422: "validation_error",
        429: "rate_limited",
        500: "internal_error",
        503: "service_unavailable",
    }.get(code, "http_error")

    request_id = getattr(request.state, "request_id", None)
    payload: dict[str, object] = {
        "error": {
            "code": slug,
            "message": detail if isinstance(detail, str) else "Request failed.",
        }
    }
    if request_id:
        payload["error"]["request_id"] = request_id  # type: ignore[index]

    headers = getattr(exc, "headers", None) or None
    return JSONResponse(status_code=code, content=payload, headers=headers)


def validation_exception_handler(request: Request, exc) -> JSONResponse:
    """Replace FastAPI's verbose 422 with a compact, sanitised envelope."""
    settings = get_settings()
    request_id = getattr(request.state, "request_id", None)
    payload: dict[str, object] = {
        "error": {
            "code": "validation_error",
            "message": "Request validation failed.",
        }
    }
    if request_id:
        payload["error"]["request_id"] = request_id  # type: ignore[index]
    if settings.expose_internal_errors and hasattr(exc, "errors"):
        # Strip the input value (may contain raw payload) — keep only loc/msg/type.
        payload["error"]["details"] = [  # type: ignore[index]
            {"loc": list(err.get("loc", [])), "msg": err.get("msg"), "type": err.get("type")}
            for err in exc.errors()
        ]
    return JSONResponse(status_code=422, content=payload)


# ---------------------------------------------------------------------------
# Convenience
# ---------------------------------------------------------------------------


__all__ = [
    "MaxBodySizeMiddleware",
    "SecurityHeadersMiddleware",
    "ErrorEnvelopeMiddleware",
    "http_exception_handler",
    "validation_exception_handler",
]


# Type alias used internally.
Dispatch = Callable[[Request], Awaitable[Response]]
