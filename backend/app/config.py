"""Centralised, environment-driven configuration.

All security-sensitive runtime values live here so that:

* nothing is hardcoded in the source tree,
* dev / staging / production deployments can be swapped purely by
  changing environment variables,
* tests can override settings via ``Settings(**overrides)`` without
  touching real env vars.

We deliberately use ``pydantic_settings`` instead of plain ``os.getenv``
so each value is **typed and validated at startup**. A misconfigured
environment fails fast with a clear error rather than silently degrading
security guarantees later.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


Environment = Literal["development", "staging", "production"]


class Settings(BaseSettings):
    """Strongly-typed application settings.

    Values are sourced (in order):

    1. Environment variables (uppercase, e.g. ``ASD_ENV``).
    2. A ``.env`` file at the repo root or backend root, if present.
    3. The defaults declared below — **safe-by-default for development**;
       anything more permissive than that requires an explicit env var.
    """

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_prefix="ASD_",
        case_sensitive=False,
        extra="ignore",
        # Treat list-typed env vars as plain strings; the
        # ``_split_origins`` validator below splits commas itself. Without
        # this, pydantic-settings tries to JSON-parse the value and
        # ``foo,bar`` raises a SettingsError.
        env_parse_none_str="null",
        env_ignore_empty=True,
    )

    # --- Runtime mode -----------------------------------------------------
    env: Environment = Field(
        "development",
        description="Deployment mode. Controls error verbosity and CORS strictness.",
    )

    # --- Authentication ---------------------------------------------------
    # Path to a Firebase Admin service-account JSON. If empty the SDK falls
    # back to GOOGLE_APPLICATION_CREDENTIALS or, in tests, to a stub
    # verifier that accepts pre-registered tokens.
    firebase_credentials_path: str = Field(
        "",
        description="Absolute path to firebase-admin service account JSON.",
    )
    # If true, the auth dependency uses an in-memory token store instead of
    # contacting Google. Only ever flipped on by the test suite.
    auth_test_mode: bool = Field(
        False,
        description="Test-only: skip real Firebase verification.",
    )
    # Secondary safety net: project ID the verified token must match.
    firebase_project_id: str = Field(
        "",
        description="Expected Firebase project ID. Verified tokens must match.",
    )

    # --- HTTP layer -------------------------------------------------------
    # Stored as ``str | list[str]`` to keep pydantic-settings from trying
    # to JSON-parse the value off the env. ``_split_origins`` normalises
    # it into a clean list at validation time.
    cors_allowed_origins: list[str] | str = Field(
        default_factory=lambda: [
            "http://localhost:8081",   # Metro bundler default
            "http://localhost:19006",  # Expo web default
            "http://10.0.2.2:8081",    # Android emulator host loopback
        ],
        description="Allow-list of CORS origins. Wildcards are rejected in production.",
    )
    # Hard ceiling on request body size to mitigate DoS via huge uploads.
    # Default 25 MB covers a 30-second 16 kHz mono WAV plus base64 overhead.
    max_request_body_bytes: int = Field(
        25 * 1024 * 1024,
        description="Maximum allowed Content-Length on any request.",
    )
    # Per-endpoint payload caps applied at the schema layer. Tightened down
    # to the minimum that current legitimate flows need.
    max_audio_base64_chars: int = Field(
        20 * 1024 * 1024,
        description="Max length of base64 audio submitted to /speech.",
    )
    max_image_base64_chars: int = Field(
        2 * 1024 * 1024,
        description="Max length of a single base64 frame submitted to /eye-tracking.",
    )
    max_eye_tracking_frames: int = Field(
        300,
        description="Max number of frames per /eye-tracking request.",
    )
    max_mcq_answers: int = Field(
        200,
        description="Max number of answers per /mcq request (defensive ceiling).",
    )

    # --- Logging ----------------------------------------------------------
    log_level: str = Field("INFO", description="Root log level.")
    log_redact_payloads: bool = Field(
        True,
        description="If true, never log raw request bodies.",
    )
    log_format: str = Field(
        "auto",
        description=(
            "Log output format: 'json' (one structured object per line, "
            "preferred for log aggregators), 'text' (human-readable), or "
            "'auto' which picks json in production and text otherwise."
        ),
    )

    # ---------------------------------------------------------------------
    # Validators
    # ---------------------------------------------------------------------

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def _split_origins(cls, value):
        """Allow a comma-separated string in addition to a JSON list."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("cors_allowed_origins")
    @classmethod
    def _reject_wildcard_in_prod(cls, value, info):
        env = (info.data or {}).get("env")
        if env == "production" and "*" in value:
            raise ValueError(
                "CORS wildcard ('*') is forbidden when ASD_ENV=production. "
                "List explicit origins instead."
            )
        return value

    # ---------------------------------------------------------------------
    # Convenience properties
    # ---------------------------------------------------------------------

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def expose_internal_errors(self) -> bool:
        """Whether to leak exception messages to the client."""
        return self.env != "production"

    @property
    def resolved_log_format(self) -> str:
        """Resolve ``log_format=auto`` to a concrete format."""
        choice = (self.log_format or "auto").lower()
        if choice == "auto":
            return "json" if self.is_production else "text"
        if choice not in ("json", "text"):
            return "json" if self.is_production else "text"
        return choice


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Singleton accessor. Cached so importers can call freely."""
    return Settings()


def reset_settings_cache() -> None:
    """Test helper — drop the cached Settings instance."""
    get_settings.cache_clear()


# Some downstream modules import the constant directly. We keep this lazy
# so importing ``app.config`` does not crash if env validation fails until
# the value is actually used.
def __getattr__(name: str):  # pragma: no cover - simple proxy
    if name == "settings":
        return get_settings()
    raise AttributeError(name)


# Expose ``ASD_DATABASE_PATH`` for downstream modules without forcing them
# to import Settings — this matches the existing pattern in database.py.
def database_path_default() -> str:
    return (
        "/data/app.db"
        if os.path.isdir("/data")
        else os.path.join(os.path.dirname(__file__), "..", "data", "app.db")
    )
