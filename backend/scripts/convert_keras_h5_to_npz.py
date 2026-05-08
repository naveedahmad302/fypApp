"""One-shot extractor: Keras .h5 → NumPy .npz.

Usage::

    python backend/scripts/convert_keras_h5_to_npz.py \
        --src D:/fypApp/backend/app/model_1/eye_tracking_fyp-main/autism_model.h5 \
        --dst backend/app/models/eye_model_v1/autism_model_weights.npz

The conversion uses ``h5py`` only (a tiny native package, no
TensorFlow). Re-run whenever the model is re-trained.

The script makes strong assumptions about the architecture: a
Sequential MLP with three Dense layers of widths (128, 64, 2). If you
change the architecture, update this script and ``keras_mlp.py``.
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

import h5py
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(name)s | %(message)s")
log = logging.getLogger("convert_h5")


# Path inside the .h5 → npz key
LAYER_PATHS = {
    "W1": "/model_weights/dense/sequential/dense/kernel",
    "b1": "/model_weights/dense/sequential/dense/bias",
    "W2": "/model_weights/dense_1/sequential/dense_1/kernel",
    "b2": "/model_weights/dense_1/sequential/dense_1/bias",
    "W3": "/model_weights/dense_2/sequential/dense_2/kernel",
    "b3": "/model_weights/dense_2/sequential/dense_2/bias",
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--src", required=True, help="Path to autism_model.h5")
    parser.add_argument("--dst", required=True, help="Path to write the .npz file")
    args = parser.parse_args()

    src = Path(args.src)
    dst = Path(args.dst)
    if not src.is_file():
        raise SystemExit(f"Source file not found: {src}")
    dst.parent.mkdir(parents=True, exist_ok=True)

    log.info("Loading %s", src)
    arrays: dict[str, np.ndarray] = {}
    with h5py.File(src, "r") as f:
        for key, path in LAYER_PATHS.items():
            if path not in f:
                raise SystemExit(
                    f"Expected layer not found in H5: {path}. "
                    "If you retrained with a different architecture, "
                    "update LAYER_PATHS in this script."
                )
            arr = f[path][:]
            arrays[key] = np.asarray(arr)
            log.info("  %s : %s %s", key, arr.shape, arr.dtype)

    np.savez(dst, **arrays)
    log.info("Wrote %s (%d bytes)", dst, dst.stat().st_size)
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
