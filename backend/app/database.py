"""Database setup and session management using SQLite."""

import os
from pathlib import Path

import sqlite3
from contextlib import contextmanager
from typing import Generator

# Use /data/app.db for persistent storage when deployed, otherwise local
_default_db = "/data/app.db" if os.path.isdir("/data") else os.path.join(os.path.dirname(__file__), "..", "data", "app.db")
DB_PATH = os.environ.get("DATABASE_PATH", _default_db)

# Ensure the directory exists
Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)


def get_connection() -> sqlite3.Connection:
    """Create a new database connection with row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """Context manager for database connections."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Initialize database tables."""
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS assessments (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('eye_tracking', 'speech', 'mcq', 'combined')),
                status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS eye_tracking_results (
                id TEXT PRIMARY KEY,
                assessment_id TEXT NOT NULL UNIQUE,
                gaze_points_count INTEGER NOT NULL DEFAULT 0,
                avg_fixation_duration REAL NOT NULL DEFAULT 0.0,
                attention_score REAL NOT NULL DEFAULT 0.0,
                gaze_pattern_type TEXT NOT NULL DEFAULT 'normal',
                left_eye_openness REAL DEFAULT 0.0,
                right_eye_openness REAL DEFAULT 0.0,
                blink_rate REAL DEFAULT 0.0,
                saccade_frequency REAL DEFAULT 0.0,
                joint_attention_score REAL DEFAULT 0.0,
                asd_risk_score REAL NOT NULL DEFAULT 0.0,
                raw_landmarks_json TEXT,
                insights_json TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS speech_results (
                id TEXT PRIMARY KEY,
                assessment_id TEXT NOT NULL UNIQUE,
                words_per_minute REAL NOT NULL DEFAULT 0.0,
                avg_pause_duration REAL NOT NULL DEFAULT 0.0,
                clarity_score REAL NOT NULL DEFAULT 0.0,
                vocal_variation_score REAL NOT NULL DEFAULT 0.0,
                pitch_mean REAL DEFAULT 0.0,
                pitch_std REAL DEFAULT 0.0,
                energy_mean REAL DEFAULT 0.0,
                speech_rate_variability REAL DEFAULT 0.0,
                prosody_score REAL DEFAULT 0.0,
                monotone_score REAL DEFAULT 0.0,
                asd_risk_score REAL NOT NULL DEFAULT 0.0,
                mfcc_features_json TEXT,
                insights_json TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS mcq_results (
                id TEXT PRIMARY KEY,
                assessment_id TEXT NOT NULL UNIQUE,
                answers_json TEXT NOT NULL,
                question_scores_json TEXT NOT NULL,
                total_score REAL NOT NULL DEFAULT 0.0,
                max_possible_score REAL NOT NULL DEFAULT 0.0,
                risk_level TEXT NOT NULL DEFAULT 'low' CHECK(risk_level IN ('low', 'moderate', 'high')),
                behavioral_insights_json TEXT,
                asd_risk_score REAL NOT NULL DEFAULT 0.0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS reports (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                overall_score REAL NOT NULL DEFAULT 0.0,
                eye_tracking_score REAL DEFAULT 0.0,
                speech_score REAL DEFAULT 0.0,
                mcq_score REAL DEFAULT 0.0,
                risk_level TEXT NOT NULL DEFAULT 'low' CHECK(risk_level IN ('low', 'moderate', 'high')),
                risk_percentage REAL NOT NULL DEFAULT 0.0,
                recommendations_json TEXT,
                eye_assessment_id TEXT,
                speech_assessment_id TEXT,
                mcq_assessment_id TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (eye_assessment_id) REFERENCES assessments(id),
                FOREIGN KEY (speech_assessment_id) REFERENCES assessments(id),
                FOREIGN KEY (mcq_assessment_id) REFERENCES assessments(id)
            );

            CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON assessments(user_id);
            CREATE INDEX IF NOT EXISTS idx_assessments_type ON assessments(type);
            CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
        """)
