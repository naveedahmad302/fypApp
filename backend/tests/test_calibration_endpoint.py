"""Integration tests for the calibration HTTP endpoints (PR-H)."""

from __future__ import annotations

import numpy as np
from fastapi.testclient import TestClient


def _samples_payload(direction: str, n: int, seed: int) -> dict:
    rng = np.random.default_rng(seed)
    return {
        "direction": direction,
        "vectors": rng.normal(0.0, 1.0, size=(n, 14)).tolist(),
    }


def _full_calibration_payload() -> dict:
    return {
        "samples": [
            _samples_payload("center", 10, 1),
            _samples_payload("left", 10, 2),
            _samples_payload("right", 10, 3),
            _samples_payload("up", 10, 4),
            _samples_payload("down", 10, 5),
        ],
        "notes": "test",
    }


def test_get_calibration_when_none_exists(authed_client: tuple[TestClient, str]):
    client, _ = authed_client
    resp = client.get("/api/assessment/calibration")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body == {"has_calibration": False, "profile": None}


def test_post_then_get_round_trips(authed_client: tuple[TestClient, str]):
    client, uid = authed_client
    resp = client.post(
        "/api/assessment/calibration", json=_full_calibration_payload()
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user_id"] == uid
    assert body["n_samples"] == 50
    assert body["schema_version"] >= 1

    # GET reflects the saved profile.
    resp2 = client.get("/api/assessment/calibration")
    assert resp2.status_code == 200
    assert resp2.json()["has_calibration"] is True
    assert resp2.json()["profile"]["n_samples"] == 50


def test_post_recalibration_replaces_previous(
    authed_client: tuple[TestClient, str],
):
    client, _ = authed_client
    client.post(
        "/api/assessment/calibration", json=_full_calibration_payload()
    )
    second = {
        "samples": [_samples_payload("center", 35, 99)],
        "notes": "second pass",
    }
    resp = client.post("/api/assessment/calibration", json=second)
    assert resp.status_code == 200
    assert resp.json()["n_samples"] == 35
    assert resp.json()["notes"] == "second pass"


def test_post_below_min_frames_returns_422(
    authed_client: tuple[TestClient, str],
):
    client, _ = authed_client
    payload = {"samples": [_samples_payload("center", 3, 0)]}
    resp = client.post("/api/assessment/calibration", json=payload)
    assert resp.status_code == 422


def test_post_wrong_vector_length_returns_400(
    authed_client: tuple[TestClient, str],
):
    client, _ = authed_client
    payload = {
        "samples": [
            {"direction": "center", "vectors": [[0.0] * 7] * 40},
        ]
    }
    resp = client.post("/api/assessment/calibration", json=payload)
    assert resp.status_code == 400


def test_post_requires_auth(client: TestClient):
    resp = client.post(
        "/api/assessment/calibration", json=_full_calibration_payload()
    )
    assert resp.status_code in (401, 403)


def test_delete_removes_profile(authed_client: tuple[TestClient, str]):
    client, _ = authed_client
    client.post(
        "/api/assessment/calibration", json=_full_calibration_payload()
    )
    resp = client.delete("/api/assessment/calibration")
    assert resp.status_code == 204
    assert client.get("/api/assessment/calibration").json() == {
        "has_calibration": False,
        "profile": None,
    }


def test_calibration_does_not_leak_across_users(
    authed_client: tuple[TestClient, str],
    other_user_token: str,
):
    client, _ = authed_client
    client.post(
        "/api/assessment/calibration", json=_full_calibration_payload()
    )

    # Switch identity to bob.
    client.headers.update({"Authorization": f"Bearer {other_user_token}"})
    resp = client.get("/api/assessment/calibration")
    assert resp.status_code == 200
    assert resp.json()["has_calibration"] is False
