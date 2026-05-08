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
    MEDIAPIPE_STATS_CANDIDATES,
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
class MediaPipeStats:
    """Per-feature mean/std of the MediaPipe-derived feature distribution.

    Used by ``preprocess_matrix(mode="domain_adapt")`` to map MediaPipe
    inputs into the trained-eye-tracker scale before applying the
    saved StandardScaler. Built once via
    ``backend/scripts/build_mediapipe_stats.py`` and persisted as an
    .npz alongside the model weights.
    """

    mean: np.ndarray  # shape (14,)
    std: np.ndarray   # shape (14,), strictly positive
    n: int = 0
    artefact_path: Optional[Path] = None


@dataclass
class LoadedModel:
    """A bundle of model + scaler + metadata, ready for inference."""

    estimator: Any
    scaler: Optional[Any] = None
    feature_names: Optional[tuple[str, ...]] = None
    metadata: dict[str, Any] = field(default_factory=dict)
    artefact_path: Optional[Path] = None
    scaler_path: Optional[Path] = None
    mediapipe_stats: Optional[MediaPipeStats] = None


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

    mp_stats: Optional[MediaPipeStats] = None
    mp_stats_path = _first_existing(model_root, MEDIAPIPE_STATS_CANDIDATES)
    if mp_stats_path is not None:
        mp_stats = _load_mediapipe_stats(mp_stats_path)
        logger.info("Loaded MediaPipe stats from %s", mp_stats_path)

    return LoadedModel(
        estimator=estimator,
        scaler=scaler,
        feature_names=feature_names,
        metadata=metadata,
        artefact_path=model_path,
        scaler_path=scaler_path,
        mediapipe_stats=mp_stats,
    )


def _load_mediapipe_stats(path: Path) -> MediaPipeStats:
    """Load ``mediapipe_stats.npz`` and validate its shape."""
    with np.load(path, allow_pickle=True) as data:
        mean = np.asarray(data["mean"], dtype=np.float64)
        std = np.asarray(data["std"], dtype=np.float64)
        n_arr = data["n"] if "n" in data.files else np.array([0])
    if mean.shape != (len(FEATURE_ORDER),) or std.shape != (len(FEATURE_ORDER),):
        raise FeatureValidationError(
            f"mediapipe_stats.npz has wrong shape: mean={mean.shape}, "
            f"std={std.shape}; expected ({len(FEATURE_ORDER)},)"
        )
    if not np.all(std > 0):
        raise FeatureValidationError(
            "mediapipe_stats.npz contains non-positive std entries; "
            "rebuild via backend/scripts/build_mediapipe_stats.py"
        )
    return MediaPipeStats(
        mean=mean,
        std=std,
        n=int(np.asarray(n_arr).flatten()[0]),
        artefact_path=path,
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
    ``"domain_adapt"``
        Per-feature affine map from the MediaPipe-derived distribution
        to the trained-eye-tracker distribution::

            x' = (x - mp_mean) / mp_std * trained_std + trained_mean

        followed by the trained StandardScaler. The result lives in the
        same space the model saw at training time, so the trained
        decision boundary is meaningful again. Requires both
        ``mediapipe_stats.npz`` and ``scaler.pkl`` to be present;
        falls back to ``online_standardize`` otherwise.
    ``"domain_adapt_self"``
        Same as ``domain_adapt`` but ``mp_mean / mp_std`` are computed
        from **the current batch itself** instead of the global stats
        artefact. Equivalent to "calibration on the fly": every
        eye-tracking session implicitly calibrates against its own
        distribution. Designed for the 4–9 yr old screening use-case
        where an explicit calibration step is impractical, but
        per-user distribution alignment is still wanted before the
        trained decision boundary is applied. Requires ``scaler.pkl``;
        falls back to ``online_standardize`` if absent. Falls back to
        ``domain_adapt`` (global stats) when the batch is too small
        (< 2 frames) to produce meaningful per-feature std.
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
    if mode == "domain_adapt":
        return _domain_adapt(model, feature_matrix)
    if mode == "domain_adapt_self":
        return _domain_adapt_self(model, feature_matrix)
    # default: trained_scaler
    if model.scaler is not None:
        return _apply_scaler(model.scaler, feature_matrix)
    return feature_matrix


def _domain_adapt(
    model: LoadedModel, feature_matrix: np.ndarray
) -> np.ndarray:
    """Map MediaPipe inputs into the trained-distribution space.

    The transform is ``y = (x - mp_mean) / mp_std * trained_std +
    trained_mean`` then the trained StandardScaler. If either
    ``mediapipe_stats`` or ``scaler`` is absent we degrade to
    ``online_standardize`` rather than producing silently wrong
    results.
    """
    if model.mediapipe_stats is None or model.scaler is None:
        logger.warning(
            "domain_adapt requested but %s missing; falling back to "
            "online_standardize",
            "mediapipe_stats" if model.mediapipe_stats is None else "scaler",
        )
        return preprocess_matrix(
            model, feature_matrix, mode="online_standardize"
        )

    mp = model.mediapipe_stats
    trained_mean = np.asarray(model.scaler.mean_, dtype=np.float64)
    trained_std = np.asarray(model.scaler.scale_, dtype=np.float64)
    trained_std = np.where(trained_std < 1e-9, 1.0, trained_std)
    mp_std = np.where(mp.std < 1e-9, 1.0, mp.std)

    aligned = (feature_matrix - mp.mean) / mp_std * trained_std + trained_mean
    # Now ``aligned`` lives in the trained input space — apply the
    # trained scaler so the model sees exactly what it saw at training.
    return _apply_scaler(model.scaler, aligned)


def _domain_adapt_self(
    model: LoadedModel, feature_matrix: np.ndarray
) -> np.ndarray:
    """Per-session ("self") domain adaptation.

    Compute ``mp_mean / mp_std`` from the **current** batch instead of
    the global ``mediapipe_stats`` artefact, then apply the same
    affine + trained-scaler pipeline as :func:`_domain_adapt`.

    Why this exists
    ---------------
    The target audience for the ASD screening flow is 4–9 yr olds, who
    cannot follow a multi-step calibration UI. Computing the per-user
    shift+scale from the same camera capture used for prediction means
    every session is implicitly calibrated against its own input
    distribution. No extra UI step, no kid cooperation required.

    Mathematically this is "online_standardize that respects the
    trained decision boundary":

        z         = (x - x.mean(0)) / x.std(0)        # per-batch z
        aligned   = z * scaler.scale_ + scaler.mean_  # rescale to trained
        result    = scaler.transform(aligned)         # then trained scaler

    The composition recovers the trained-distribution geometry and
    leaves the model's decision boundary meaningful.

    Falls back to :func:`_domain_adapt` (global stats) when the batch
    is too small (< 2 frames) to produce a usable std. Falls back to
    ``online_standardize`` when ``scaler.pkl`` is absent.
    """
    if model.scaler is None:
        logger.warning(
            "domain_adapt_self requested but scaler missing; "
            "falling back to online_standardize"
        )
        return preprocess_matrix(
            model, feature_matrix, mode="online_standardize"
        )

    if feature_matrix.shape[0] < 2:
        logger.info(
            "domain_adapt_self: batch too small (n=%d) for self-stats; "
            "falling back to global domain_adapt",
            feature_matrix.shape[0],
        )
        return _domain_adapt(model, feature_matrix)

    mp_mean = feature_matrix.mean(axis=0)
    mp_std = feature_matrix.std(axis=0)
    # Floor the per-feature std so a near-constant column does not
    # explode the affine. 1e-3 matches MIN_CALIBRATION_STD in the
    # saved-profile path (calibration.py).
    mp_std = np.where(mp_std < 1e-3, 1.0, mp_std)

    trained_mean = np.asarray(model.scaler.mean_, dtype=np.float64)
    trained_std = np.asarray(model.scaler.scale_, dtype=np.float64)
    trained_std = np.where(trained_std < 1e-9, 1.0, trained_std)

    aligned = (feature_matrix - mp_mean) / mp_std * trained_std + trained_mean
    return _apply_scaler(model.scaler, aligned)


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
