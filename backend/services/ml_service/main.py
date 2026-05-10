"""
ML Inference Service - TensorFlow Autism Detection
"""

import logging
from pathlib import Path
from typing import Dict

import numpy as np
import tensorflow as tf
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="ML Service", version="1.0.0")
model = None
scaler = None
label_encoder = None

logger = logging.getLogger(__name__)


class FeatureRequest(BaseModel):
    features: Dict


class PredictionResponse(BaseModel):
    prediction: str
    confidence: float
    raw_probabilities: list


def load_models():
    """Load TensorFlow model, scaler, and label encoder."""
    global model, scaler, label_encoder
    if model is None:
        try:
            # Model file paths - look in backend/app/models directory
            model_dir = Path(__file__).parent.parent.parent / "app" / "models" / "eye_tracking_fyp-main"
            model_path = model_dir / "autism_model.h5"
            scaler_path = model_dir / "scaler.pkl"
            label_encoder_path = model_dir / "label_encoder.pkl"
            
            if not all(path.exists() for path in [model_path, scaler_path, label_encoder_path]):
                raise FileNotFoundError("Model files not found")
            
            # Load TensorFlow model
            model = tf.keras.models.load_model(model_path, compile=False)
            
            # Load scaler and label encoder
            import pickle
            with open(scaler_path, 'rb') as f:
                scaler = pickle.load(f)
            
            with open(label_encoder_path, 'rb') as f:
                label_encoder = pickle.load(f)
            
            logger.info("ML models loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load ML models: {e}")
            raise HTTPException(
                status_code=500,
                detail="ML models not available"
            )


def prepare_features_for_prediction(features: Dict) -> np.ndarray:
    """Convert CV features to model input format."""
    try:
        # Map CV service features to model training features
        feature_mapping = {
            'Eye Position Right X [mm]': 'eye_position_right_x',
            'Eye Position Right Y [mm]': 'eye_position_right_y', 
            'Eye Position Right Z [mm]': 'eye_position_right_z',
            'Eye Position Left X [mm]': 'eye_position_left_x',
            'Eye Position Left Y [mm]': 'eye_position_left_y',
            'Eye Position Left Z [mm]': 'eye_position_left_z',
            'Pupil Position Right X [px]': 'pupil_position_right_x',
            'Pupil Position Right Y [px]': 'pupil_position_right_y',
            'Pupil Position Left X [px]': 'pupil_position_left_x',
            'Pupil Position Left Y [px]': 'pupil_position_left_y',
            'Point of Regard Right X [px]': 'point_of_regard_right_x',
            'Point of Regard Right Y [px]': 'point_of_regard_right_y',
            'Point of Regard Left X [px]': 'point_of_regard_left_x',
            'Point of Regard Left Y [px]': 'point_of_regard_left_y'
        }
        
        # Extract features in correct order for model
        model_features = []
        for feature_name in feature_mapping.keys():
            # Try to get from CV features, otherwise use defaults
            cv_key = feature_mapping[feature_name]
            
            if cv_key in features:
                value = features[cv_key]
            else:
                # Fallback: estimate from available CV features
                if 'eye_aspect_ratio' in cv_key:
                    value = 0.3  # Default EAR
                elif 'gaze_vector' in cv_key:
                    gaze = features.get('gaze_vector', [0, 0])
                    if 'X' in feature_name:
                        value = gaze[0] * 10 if len(gaze) > 0 else 0
                    else:
                        value = gaze[1] * 10 if len(gaze) > 1 else 0
                elif 'head_pose' in cv_key:
                    pose = features.get('head_pose', [0, 0, 0])
                    if 'Z' in feature_name:
                        value = pose[2] * 100 if len(pose) > 2 else 0
                    else:
                        value = pose[0] * 10 if len(pose) > 0 else 0
                else:
                    value = 0.0
            
            model_features.append(float(value))
        
        return np.array(model_features).reshape(1, -1)
        
    except Exception as e:
        logger.error(f"Feature preparation error: {e}")
        raise HTTPException(status_code=400, detail=f"Feature preparation failed: {str(e)}")


@app.post("/predict", response_model=PredictionResponse)
async def predict_autism(request: FeatureRequest):
    """Predict autism risk from eye tracking features."""
    try:
        load_models()
        
        # Prepare features for model
        features_array = prepare_features_for_prediction(request.features)
        
        # Scale features
        features_scaled = scaler.transform(features_array)
        
        # Make prediction
        prediction_proba = model.predict(features_scaled, verbose=0)[0]
        predicted_class_idx = np.argmax(prediction_proba)
        confidence_score = float(np.max(prediction_proba))
        
        # Convert numeric prediction back to label
        prediction_label = label_encoder.inverse_transform([predicted_class_idx])[0]
        
        # Normalize confidence score to 0-1 range
        normalized_confidence = confidence_score / 100.0 if confidence_score > 1 else confidence_score
        
        result = {
            "prediction": prediction_label,
            "confidence": normalized_confidence,
            "raw_probabilities": prediction_proba.tolist()
        }
        
        logger.info(f"Prediction completed: {prediction_label} with {normalized_confidence:.2f} confidence")
        return result
        
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "ml-service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
