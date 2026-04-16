#!/bin/bash
# Setup script for ASD Detection Backend
# Downloads required ML models and installs dependencies

set -e

echo "Installing Python dependencies..."
poetry install

echo "Downloading MediaPipe Face Landmarker model..."
curl -L -o app/services/face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task

echo "Setup complete! Run 'poetry run fastapi dev app/main.py' to start the server."
