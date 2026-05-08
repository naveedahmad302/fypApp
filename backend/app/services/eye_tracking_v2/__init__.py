"""v2 eye-tracking pipeline (trained model + 14-feature MediaPipe adapter).

Public surface intentionally narrow — most callers should go through the
dispatcher in ``services/eye_tracking.py``.
"""

from .config import (  # noqa: F401
    DEFAULT_ADAPTER_CONFIG,
    FEATURE_ORDER,
    AdapterConfig,
    PipelineConfig,
    get_backend,
    load_pipeline_config,
)
from .mediapipe_adapter import (  # noqa: F401
    FrameVector,
    feature_vector_dict,
    landmarks_to_feature_vector,
)
from .model_runner import (  # noqa: F401
    InferenceResult,
    LoadedModel,
    ModelArtefactMissing,
    load_model,
    run_inference,
)
from .pipeline import (  # noqa: F401
    analyze_eye_tracking_v2,
    extract_feature_matrix,
)
from .validation import (  # noqa: F401
    FeatureValidationError,
    summarise,
    validate_feature_matrix,
    validate_feature_vector,
)
