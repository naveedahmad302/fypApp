"""Firebase ID-token verification for FastAPI.

Every protected route declares ``current_user_id: str = Depends(require_auth_uid)``.
The dependency:

1. Pulls the bearer token out of the ``Authorization`` header.
2. Verifies the signature, audience, expiry and issuer using
   ``firebase_admin.auth.verify_id_token``.
3. Returns the verified UID — the **only** trusted source of identity in
   the request lifecycle. Routes never read ``user_id`` from the
   request body.

In test mode (``ASD_AUTH_TEST_MODE=true``) the dependency uses an
in-memory registry instead of contacting Google. Production code paths
are unchanged.
"""

from __future__ import annotations

import logging
import threading
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_settings


logger = logging.getLogger(__name__)

# We initialise firebase-admin lazily so the module can be imported in
# environments without the SDK installed (e.g. unit tests that stub
# everything out via auth_test_mode).
_firebase_lock = threading.Lock()
_firebase_initialised = False
_firebase_unavailable_reason: Optional[str] = None

# Test-mode token registry: ``register_test_token("token", "uid")``.
_TEST_TOKENS: dict[str, str] = {}


# ---------------------------------------------------------------------------
# Public test helpers
# ---------------------------------------------------------------------------


def register_test_token(token: str, uid: str) -> None:
    """Register a token → uid mapping for ``auth_test_mode``."""
    _TEST_TOKENS[token] = uid


def clear_test_tokens() -> None:
    _TEST_TOKENS.clear()


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------


def _ensure_firebase_initialised() -> None:
    """Initialise firebase-admin once, on first auth call."""
    global _firebase_initialised, _firebase_unavailable_reason
    if _firebase_initialised:
        return
    with _firebase_lock:
        if _firebase_initialised:
            return
        try:
            import firebase_admin  # type: ignore[import-not-found]
            from firebase_admin import credentials  # type: ignore[import-not-found]
        except ImportError as exc:
            _firebase_unavailable_reason = (
                "firebase-admin is not installed. Add it to backend dependencies."
            )
            logger.error("%s (%s)", _firebase_unavailable_reason, exc)
            _firebase_initialised = True
            return

        settings = get_settings()
        try:
            if firebase_admin._apps:  # already initialised by another import path
                _firebase_initialised = True
                return
            cred = None
            if settings.firebase_credentials_path:
                cred = credentials.Certificate(settings.firebase_credentials_path)
            # Else: rely on GOOGLE_APPLICATION_CREDENTIALS / metadata server.
            firebase_admin.initialize_app(cred)
            _firebase_initialised = True
            logger.info("firebase-admin initialised (project=%s)", settings.firebase_project_id or "<auto>")
        except Exception as exc:  # pragma: no cover - depends on local env
            _firebase_unavailable_reason = f"firebase-admin init failed: {exc}"
            logger.error(_firebase_unavailable_reason)
            _firebase_initialised = True


def _verify_with_firebase(token: str) -> str:
    """Validate ``token`` and return the verified UID."""
    _ensure_firebase_initialised()
    if _firebase_unavailable_reason:
        # Fail closed in production; in development this will surface as a
        # 503 so misconfiguration is impossible to ignore.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is not configured on the server.",
        )

    from firebase_admin import auth as fb_auth  # type: ignore[import-not-found]

    try:
        decoded = fb_auth.verify_id_token(token, check_revoked=False)
    except fb_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired. Please sign in again.",
            headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
        )
    except fb_auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token was revoked. Please sign in again.",
            headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
        )
    except fb_auth.InvalidIdTokenError as exc:
        # Don't leak which validation step failed.
        logger.warning("Invalid Firebase ID token: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
        )
    except Exception as exc:  # pragma: no cover - generic safety net
        logger.exception("Unexpected error verifying ID token: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not verify authentication token.",
        )

    settings = get_settings()
    if settings.firebase_project_id and decoded.get("aud") != settings.firebase_project_id:
        logger.warning(
            "Token audience mismatch: aud=%s expected=%s",
            decoded.get("aud"),
            settings.firebase_project_id,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token was issued for a different project.",
        )

    uid = decoded.get("uid") or decoded.get("user_id")
    if not uid or not isinstance(uid, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing required uid claim.",
        )
    return uid


# Single shared scheme so OpenAPI shows the lock icon on every secured route.
_bearer_scheme = HTTPBearer(auto_error=False, bearerFormat="JWT")


def require_auth_uid(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> str:
    """Dependency that returns the verified Firebase UID for the request."""
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if creds.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization scheme must be Bearer.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = creds.credentials
    settings = get_settings()
    if settings.auth_test_mode:
        uid = _TEST_TOKENS.get(token)
        if not uid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unknown test token.",
            )
    else:
        uid = _verify_with_firebase(token)

    # Stash on request.state so middleware (e.g. structured logging) can
    # include the UID without re-running verification.
    request.state.user_id = uid
    return uid


def optional_auth_uid(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> Optional[str]:
    """Variant for endpoints that are valid both with and without auth."""
    if creds is None or not creds.credentials:
        return None
    return require_auth_uid(request=request, creds=creds)
