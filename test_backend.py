#!/usr/bin/env python3
"""Quick test script for ASD Detection API endpoints."""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_endpoints():
    """Test all main API endpoints."""
    
    print("🔍 Testing ASD Detection API Endpoints")
    print("=" * 50)
    
    # Test health endpoint
    try:
        resp = requests.get(f"{BASE_URL}/healthz")
        print(f"✅ Health Check: {resp.json()}")
    except Exception as e:
        print(f"❌ Health Check Failed: {e}")
    
    # Test root endpoint
    try:
        resp = requests.get(f"{BASE_URL}/")
        data = resp.json()
        print(f"✅ API Info: {data['service']} v{data['version']}")
        print(f"📋 Available endpoints: {list(data['endpoints'].keys())}")
    except Exception as e:
        print(f"❌ API Info Failed: {e}")
    
    # Test eye tracking endpoint (will fail without proper data, but shows endpoint exists)
    try:
        test_data = {
            "user_id": "test_user_123",
            "frames_base64": [],
            "frame_metadata": []
        }
        resp = requests.post(f"{BASE_URL}/api/assessment/eye-tracking", 
                          json=test_data)
        print(f"✅ Eye Tracking Endpoint: {resp.status_code}")
    except Exception as e:
        print(f"❌ Eye Tracking Test: {e}")

if __name__ == "__main__":
    test_endpoints()
