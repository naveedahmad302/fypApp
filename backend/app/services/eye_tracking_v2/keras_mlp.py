"""Pure-NumPy forward pass for the trained Keras MLP.

The user's trained model (``autism_model.h5``) is a small Sequential
Keras network::

    Dense(14 → 128, ReLU)
    Dropout(0.2)        # inactive at inference
    Dense(128 → 64, ReLU)
    Dropout(0.2)        # inactive at inference
    Dense(64 → 2, Softmax)

Re-implementing that in NumPy keeps the runtime free of a TensorFlow /
Keras dependency (which would otherwise add ~500 MB to the backend
image). Weights are extracted once from the H5 file via
``backend/scripts/convert_keras_h5_to_npz.py`` and persisted as a tiny
``.npz`` file alongside the scaler.

Output convention
-----------------
``forward(X)`` returns a ``(N, 2)`` softmax matrix with column order

    [P(class 0 = "ASD"), P(class 1 = "Neurotypical")]

matching the LabelEncoder (``classes_ = ['ASD', 'Neurotypical']``) that
was fitted during training. The model_runner uses this convention via
``positive_class_index = 0`` in ``metadata.json``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import numpy as np

logger = logging.getLogger("eye_tracking_v2.keras_mlp")


@dataclass(frozen=True)
class KerasMlpWeights:
    """Three-layer dense MLP weights extracted from the .h5 source."""

    W1: np.ndarray  # shape (14, 128)
    b1: np.ndarray  # shape (128,)
    W2: np.ndarray  # shape (128, 64)
    b2: np.ndarray  # shape (64,)
    W3: np.ndarray  # shape (64, 2)
    b3: np.ndarray  # shape (2,)

    @property
    def n_features(self) -> int:
        return int(self.W1.shape[0])

    @property
    def n_classes(self) -> int:
        return int(self.W3.shape[1])


def load_weights(path: Path) -> KerasMlpWeights:
    """Load weights from an .npz file.

    Expected keys: ``W1``, ``b1``, ``W2``, ``b2``, ``W3``, ``b3``.
    """
    with np.load(path) as npz:
        try:
            weights = KerasMlpWeights(
                W1=np.asarray(npz["W1"], dtype=np.float64),
                b1=np.asarray(npz["b1"], dtype=np.float64),
                W2=np.asarray(npz["W2"], dtype=np.float64),
                b2=np.asarray(npz["b2"], dtype=np.float64),
                W3=np.asarray(npz["W3"], dtype=np.float64),
                b3=np.asarray(npz["b3"], dtype=np.float64),
            )
        except KeyError as exc:  # pragma: no cover - defensive
            raise KeyError(
                f"npz weight file {path} missing key {exc!r}; "
                "expected W1/b1, W2/b2, W3/b3"
            ) from exc

    if weights.W1.shape != (14, 128):
        raise ValueError(
            f"Unexpected W1 shape {weights.W1.shape} (expected (14, 128))"
        )
    if weights.W3.shape != (64, 2):
        raise ValueError(
            f"Unexpected W3 shape {weights.W3.shape} (expected (64, 2))"
        )
    logger.info("Loaded Keras MLP weights from %s", path)
    return weights


def _softmax(z: np.ndarray) -> np.ndarray:
    z = z - z.max(axis=1, keepdims=True)
    exp = np.exp(z)
    return exp / exp.sum(axis=1, keepdims=True)


def forward(X: np.ndarray, weights: KerasMlpWeights) -> np.ndarray:
    """Run the trained MLP on a batch of feature vectors.

    Parameters
    ----------
    X : ndarray, shape (N, 14)
        Pre-standardised feature matrix (mean 0, std 1 per column at
        training time).
    weights : KerasMlpWeights

    Returns
    -------
    ndarray, shape (N, 2)
        Softmax probabilities ``[P(ASD), P(NT)]``.
    """
    if X.ndim != 2:
        raise ValueError(f"Expected 2-D input, got shape {X.shape}")
    if X.shape[1] != weights.n_features:
        raise ValueError(
            f"Expected {weights.n_features} columns, got {X.shape[1]}"
        )

    h1 = np.maximum(0.0, X @ weights.W1 + weights.b1)
    h2 = np.maximum(0.0, h1 @ weights.W2 + weights.b2)
    logits = h2 @ weights.W3 + weights.b3
    return _softmax(logits)


# ---------------------------------------------------------------------------
# Wrapper compatible with the model_runner's `_safe_predict_proba` interface.
# ---------------------------------------------------------------------------
class KerasMlpEstimator:
    """sklearn-flavoured wrapper around the NumPy MLP.

    Exposes ``predict_proba`` so the existing model_runner aggregation
    logic works unchanged.
    """

    def __init__(self, weights: KerasMlpWeights) -> None:
        self.weights = weights
        # Class layout matches the trained LabelEncoder
        # (classes_ = ['ASD', 'Neurotypical']). column 0 = ASD.
        self.classes_ = np.array([0, 1])
        self.n_features_in_ = weights.n_features

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return forward(np.asarray(X, dtype=np.float64), self.weights)

    def predict(self, X: np.ndarray) -> np.ndarray:
        return self.predict_proba(X).argmax(axis=1)
