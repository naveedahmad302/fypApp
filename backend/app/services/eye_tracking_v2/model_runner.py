"""Loader + inference wrapper for the trained eye-tracking model.

Looks for the trained artefact (and optional scaler / feature-name file)
under ``backend/app/models/eye_model_v1`` (configurable via
``PipelineConfig.model_root``).

Supported artefacts
-------------------
* ``model.{joblib,pkl}``    — sklearn estimator (required when present)
* ``scaler.{joblib,pkl}``   — sklearn ``StandardScaler``-style preprocessor
                              (optional; applied before ``predict_proba``)
* ``feature_names.json``    — list of strings; if present the loader
                              cross-checks against ``FEATURE_ORDER``
* ``metadata.json``         — free-form dict; merged into the inference
                              result as the ``model_metadata`` field

Why ``joblib`` first
--------------------
sklearn's official guidance is to prefer joblib over pickle for
serialised estimators because it handles large numpy arrays more
efficiently. We try ``.joblib`` first and fall back to ``.pkl``.
"""

from __future__ import annotations

import json
import logging
import pickle
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import numpy as np

from .config import (
    FEATURE_NAMES_CANDIDATES,
    FEATURE_ORDER,
    METADATA_CANDIDATES,
    MODEL_CANDIDATES,
    SCALER_CANDIDATES,
)
from .keras_mlp import KerasMlpEstimator, load_weights
from .validation import (
    FeatureValidationError,
    validate_feature_matrix,
)

logger = logging.getLogger("eye_tracking_v2.model_runner")


class ModelArtefactMissing(FileNotFoundError):
    """Raised when no model file is found under MODEL_ROOT."""


@dataclass
class LoadedModel:
    """A bundle of model + scaler + metadata, ready for inference."""

    estimator: Any
    scaler: Optional[Any] = None
    feature_names: Optional[tuple[str, ...]] = None
    metadata: dict[str, Any] = field(default_factory=dict)
    artefact_path: Optional[Path] = None
    scaler_path: Optional[Path] = None


# ---------------------------------------------------------------------------
# Disk loading
# ---------------------------------------------------------------------------
def _first_existing(root: Path, candidates: tuple[str, ...]) -> Optional[Path]:
    for name in candidates:
        candidate = root / name
        if candidate.is_file():
            return candidate
    return None


def _load_serialised(path: Path) -> Any:
    """Load a joblib, pickle, or numpy weights file.

    * ``.npz`` → wrapped as a :class:`KerasMlpEstimator` (pure-NumPy
      forward pass for the trained Keras MLP).
    * ``.joblib`` / ``.pkl`` → tries joblib first, falls back to pickle.
    """
    suffix = path.suffix.lower()
    if suffix == ".npz":
        return KerasMlpEstimator(load_weights(path))
    try:
        import joblib  # type: ignore[import-not-found]

        return joblib.load(path)
    except Exception as exc:  # pragma: no cover - joblib edge cases
        logger.debug("joblib.load failed for %s: %s; trying pickle", path, exc)
        with path.open("rb") as fh:
            return pickle.load(fh)


def load_model(model_root: Path) -> LoadedModel:
    """Load the trained model + companion artefacts from ``model_root``."""
    if not model_root.is_dir():
        raise ModelArtefactMissing(
            f"Model directory not found: {model_root}"
        )

    model_path = _first_existing(model_root, MODEL_CANDIDATES)
    if model_path is None:
        raise ModelArtefactMissing(
            f"No model artefact found under {model_root}. "
            f"Expected one of: {', '.join(MODEL_CANDIDATES)}"
        )
    estimator = _load_serialised(model_path)
    logger.info("Loaded eye-tracking estimator from %s", model_path)

    scaler = None
    scaler_path = _first_existing(model_root, SCALER_CANDIDATES)
    if scaler_path is not None:
        scaler = _load_serialised(scaler_path)
        logger.info("Loaded scaler from %s", scaler_path)

    feature_names: Optional[tuple[str, ...]] = None
    fnames_path = _first_existing(model_root, FEATURE_NAMES_CANDIDATES)
    if fnames_path is not None:
        with fnames_path.open() as fh:
            raw = json.load(fh)
        if isinstance(raw, list):
            feature_names = tuple(str(x) for x in raw)
        elif isinstance(raw, dict) and "features" in raw:
            feature_names = tuple(str(x) for x in raw["features"])
        if feature_names is not None and tuple(feature_names) != FEATURE_ORDER:
            logger.warning(
                "feature_names.json disagrees with adapter ordering; "
                "the adapter is the source of truth — verify training "
                "and adapter use the same column order before relying "
                "on results."
            )

    metadata: dict[str, Any] = {}
    metadata_path = _first_existing(model_root, METADATA_CANDIDATES)
    if metadata_path is not None:
        with metadata_path.open() as fh:
            metadata = dict(json.load(fh))

    return LoadedModel(
        estimator=estimator,
        scaler=scaler,
        feature_names=feature_names,
        metadata=metadata,
        artefact_path=model_path,
        scaler_path=scaler_path,
    )


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------
@dataclass
class InferenceResult:
    """Output of running the trained model on a batch of frame vectors."""

    asd_probability: float           # 0..1
    confidence: float                # 0..1, derived from sample count + variance
    frame_predictions: np.ndarray    # shape (N,), per-frame probability
    n_frames_used: int
    feature_summary: dict[str, list[float]] = field(default_factory=dict)
    model_metadata: dict[str, Any] = field(default_factory=dict)


def _safe_predict_proba(estimator: Any, X: np.ndarray) -> np.ndarray:
    """Return per-row probability of the positive (ASD) class.

    Falls back gracefully when the estimator only exposes ``decision_function``
    or ``predict``.
    """
    if hasattr(estimator, "predict_proba"):
        proba = estimator.predict_proba(X)
        proba = np.asarray(proba, dtype=np.float64)
        if proba.ndim == 2 and proba.shape[1] >= 2:
            # Assume the *highest* index is the ASD / positive class. If
            # the trained model used the reverse convention, flip via
            # metadata.json -> {"positive_class_index": 0}.
            return proba[:, -1]
        return proba.flatten()
    if hasattr(estimator, "decision_function"):
        scores = np.asarray(estimator.decision_function(X), dtype=np.float64)
        # Squash to [0, 1] with a sigmoid for a probability-like score.
        return 1.0 / (1.0 + np.exp(-scores))
    if hasattr(estimator, "predict"):
        preds = np.asarray(estimator.predict(X), dtype=np.float64)
        return preds.clip(0.0, 1.0)
    raise RuntimeError(
        f"Estimator {type(estimator).__name__} exposes neither "
        "predict_proba, decision_function, nor predict."
    )


def preprocess_matrix(
    model: LoadedModel,
    feature_matrix: np.ndarray,
    mode: str = "trained_scaler",
) -> np.ndarray:
    """Bring an (N, 14) raw feature matrix into the model's input space.

    Modes
    -----
    ``"trained_scaler"``
        Apply the saved StandardScaler if one was loaded, else pass
        through. Use when inputs match the training distribution.
    ``"online_standardize"``
        Standardise each column to zero-mean, unit-std using the batch's
        own statistics. Use when inputs are MediaPipe approximations
        whose absolute scale differs from the training distribution.
        With a single sample (std == 0) we fall back to the trained
        scaler if present, else zero-fill.
    ``"none"``
        Pass through unchanged (debug only).
    """
    if mode == "none":
        return feature_matrix
    if mode == "online_standardize":
        if feature_matrix.shape[0] >= 2:
            mean = feature_matrix.mean(axis=0, keepdims=True)
            std = feature_matrix.std(axis=0, keepdims=True)
            std = np.where(std < 1e-9, 1.0, std)
            return (feature_matrix - mean) / std
        # Single sample → cannot compute meaningful batch stats.
        if model.scaler is not None:
            return _apply_scaler(model.scaler, feature_matrix)
        return np.zeros_like(feature_matrix)
    # default: trained_scaler
    if model.scaler is not None:
        return _apply_scaler(model.scaler, feature_matrix)
    return feature_matrix


def _apply_scaler(scaler: Any, X: np.ndarray) -> np.ndarray:
    try:
        out = np.asarray(scaler.transform(X), dtype=np.float64)
    except Exception as exc:
        raise FeatureValidationError(f"Scaler.transform failed: {exc}") from exc
    if not np.isfinite(out).all():
        raise FeatureValidationError(
            "Scaler produced non-finite values — check the scaler matches "
            "the training pipeline."
        )
    return out


def run_inference(
    model: LoadedModel,
    feature_matrix: np.ndarray,
    preprocessing_mode: str = "trained_scaler",
) -> InferenceResult:
    """Run the trained model on an (N, 14) feature matrix and aggregate."""
    cleaned = validate_feature_matrix(
        feature_matrix, feature_names=model.feature_names
    )

    X = preprocess_matrix(model, cleaned, mode=preprocessing_mode)

    probs = _safe_predict_proba(model.estimator, X)
    probs = np.clip(np.asarray(probs, dtype=np.float64), 0.0, 1.0)

    # Apply optional class-index override from metadata.
    pos_idx = model.metadata.get("positive_class_index")
    if pos_idx == 0:
        probs = 1.0 - probs

    asd_probability = float(probs.mean())
    # Confidence: shrink toward 0 when we have very few frames or when
    # per-frame predictions disagree wildly (high std).
    n_frames = int(probs.size)
    sample_factor = min(1.0, n_frames / 30.0)
    agreement_factor = float(1.0 - min(0.5, probs.std()) * 2.0)
    confidence = max(0.0, min(1.0, 0.6 * sample_factor + 0.4 * agreement_factor))

    from .validation import summarise

    return InferenceResult(
        asd_probability=asd_probability,
        confidence=confidence,
        frame_predictions=probs,
        n_frames_used=n_frames,
        feature_summary=summarise(cleaned),
        model_metadata=dict(model.metadata),
    )
