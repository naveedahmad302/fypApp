#!/bin/bash
# Setup script for ASD Detection Backend
# Downloads required ML models and installs dependencies

set -e

echo "Installing system dependencies..."
# ffmpeg is required to decode mp4/AAC audio for speech analysis
if ! command -v ffmpeg &> /dev/null; then
  echo "Installing ffmpeg..."
  if command -v apt-get &> /dev/null; then
    sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg
  elif command -v brew &> /dev/null; then
    brew install ffmpeg
  else
    echo "WARNING: ffmpeg not found. Please install ffmpeg manually for speech analysis to work."
  fi
else
  echo "ffmpeg already installed."
fi

echo "Installing Python dependencies..."
poetry install

echo "Downloading MediaPipe Face Landmarker model..."
curl -L -o app/services/face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task

echo "Setup complete! Run 'poetry run fastapi dev app/main.py' to start the server."
