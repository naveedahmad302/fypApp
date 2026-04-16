# ASD Detection Backend API

AI-powered backend for Autism Spectrum Disorder (ASD) assessment through three modules:

1. **Eye Tracking Analysis** — MediaPipe Face Mesh for gaze pattern detection
2. **Speech/Voice Analysis** — librosa for audio feature extraction and prosody analysis
3. **MCQ Behavioral Assessment** — Weighted scoring based on ASD screening criteria

## Setup

```bash
cd backend
poetry install
```

## Run Development Server

```bash
poetry run fastapi dev app/main.py
```

Server runs at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/assessment/eye-tracking` | Analyze eye tracking frames |
| POST | `/api/assessment/speech` | Analyze speech audio recording |
| POST | `/api/assessment/mcq` | Score MCQ questionnaire answers |
| POST | `/api/assessment/report/generate` | Generate combined ASD report |
| GET | `/api/assessment/report/{user_id}` | Get user's latest report |
| GET | `/api/assessment/history/{user_id}` | Get assessment history |
| GET | `/api/assessment/questions` | Get MCQ question bank |
| GET | `/healthz` | Health check |

## Tech Stack

- **Framework:** FastAPI
- **AI/ML:** MediaPipe, librosa, OpenCV, NumPy, scikit-learn
- **Database:** SQLite
- **Validation:** Pydantic v2
