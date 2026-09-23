"""
Targeted Auth Resilience & Serialization Test Suite for Kisan Setu.
Tests:
- Login with existing credentials
- Login with wrong password (returns 401 JSON)
- Login with nonexistent user (returns 401 JSON)
- Signup with fresh user (returns 200 with TokenResponse)
- Signup with duplicate email (returns 400 JSON)
- Signup with mismatched passwords (returns 400 JSON)
- Authenticated /api/auth/me (returns 200 UserResponse)
- Unauthenticated /api/auth/me (returns 401 JSON)
- Invalid token /api/auth/me (returns 401 JSON)
- Detached instance safety (no DetachedInstanceError when session is closed)
- Empty secret key fallback resilience
- Global 500 exception handler returning JSON (not text/plain)
"""

import os
import sys
import uuid
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal, get_db
from backend.models import User
from backend.schemas import UserResponse, TokenResponse
from backend.services.security import create_access_token, decode_access_token
from backend.config import settings

client = TestClient(app, raise_server_exceptions=False)

def test_login_existing_farmer():
    res = client.post("/api/auth/login", json={
        "email": "ramesh@kisansetu.in",
        "password": "secret123"
    })
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    assert "application/json" in res.headers["content-type"]
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    user = data["user"]
    assert user["email"] == "ramesh@kisansetu.in"
    assert user["role"] == "FARMER_FPO"
    assert user["farmer_profile"] is not None
    assert user["farmer_profile"]["farm_name"] == "Ramesh Organic Farms"
    assert user["buyer_profile"] is None

def test_login_existing_buyer():
    res = client.post("/api/auth/login", json={
        "email": "cityfresh@kisansetu.in",
        "password": "secret123"
    })
    assert res.status_code == 200
    assert "application/json" in res.headers["content-type"]
    data = res.json()
    assert data["user"]["role"] == "BUYER_CONSUMER"
    assert data["user"]["buyer_profile"] is not None

def test_login_wrong_password():
    res = client.post("/api/auth/login", json={
        "email": "ramesh@kisansetu.in",
        "password": "wrongpassword123"
    })
    assert res.status_code == 401
    assert "application/json" in res.headers["content-type"]
    data = res.json()
    assert "detail" in data
    assert "Invalid email or password" in data["detail"]

def test_login_nonexistent_user():
    res = client.post("/api/auth/login", json={
        "email": "nonexistent_user_9999@example.com",
        "password": "any_password"
    })
    assert res.status_code == 401
    assert "application/json" in res.headers["content-type"]
    assert "Invalid email or password" in res.json()["detail"]

def test_signup_new_farmer():
    unique_email = f"farmer_{uuid.uuid4().hex[:8]}@example.com"
    res = client.post("/api/auth/signup", json={
        "name": "Kavita Sharma",
        "email": unique_email,
        "phone": "+91 98765 43210",
        "password": "MySecretPassword1",
        "confirm_password": "MySecretPassword1",
        "role": "FARMER_FPO"
    })
    assert res.status_code == 200, f"Signup failed: {res.text}"
    assert "application/json" in res.headers["content-type"]
    data = res.json()
    assert "access_token" in data
    assert data["user"]["name"] == "Kavita Sharma"
    assert data["user"]["email"] == unique_email
    assert data["user"]["farmer_profile"] is None
    assert data["user"]["buyer_profile"] is None

def test_signup_duplicate_email():
    res = client.post("/api/auth/signup", json={
        "name": "Duplicate User",
        "email": "ramesh@kisansetu.in",
        "phone": "+91 99999 88888",
        "password": "secretpassword",
        "confirm_password": "secretpassword",
        "role": "FARMER_FPO"
    })
    assert res.status_code == 400
    assert "application/json" in res.headers["content-type"]
    assert "already exists" in res.json()["detail"]

def test_signup_password_mismatch():
    res = client.post("/api/auth/signup", json={
        "name": "Mismatch User",
        "email": f"mismatch_{uuid.uuid4().hex[:6]}@example.com",
        "phone": "+91 99999 88888",
        "password": "passwordA",
        "confirm_password": "passwordB",
        "role": "FARMER_FPO"
    })
    assert res.status_code == 400
    assert "application/json" in res.headers["content-type"]
    assert "Passwords do not match" in res.json()["detail"]

def test_authenticated_me_endpoint():
    login_res = client.post("/api/auth/login", json={
        "email": "ramesh@kisansetu.in",
        "password": "secret123"
    })
    token = login_res.json()["access_token"]
    
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert "application/json" in me_res.headers["content-type"]
    user_data = me_res.json()
    assert user_data["email"] == "ramesh@kisansetu.in"
    assert user_data["farmer_profile"]["farm_name"] == "Ramesh Organic Farms"

def test_unauthenticated_me_endpoint():
    res = client.get("/api/auth/me")
    assert res.status_code == 401
    assert "application/json" in res.headers["content-type"]
    assert "detail" in res.json()

def test_invalid_token_me_endpoint():
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid_garbage_token"})
    assert res.status_code == 401
    assert "application/json" in res.headers["content-type"]
    assert "detail" in res.json()

def test_detached_instance_resilience():
    """Verify that User instance serialization works cleanly even if the Session was closed."""
    db = SessionLocal()
    user = db.query(User).filter(User.email == "ramesh@kisansetu.in").first()
    assert user is not None
    # Close session to detach user
    db.close()
    
    # Validation must NOT throw DetachedInstanceError
    user_resp = UserResponse.model_validate(user)
    assert user_resp.name == "Ramesh Kumar"
    assert user_resp.farmer_profile.farm_name == "Ramesh Organic Farms"

    # TokenResponse serialization must also succeed
    token_resp = TokenResponse(
        access_token="fake_test_token",
        token_type="bearer",
        user=user_resp
    )
    assert token_resp.access_token == "fake_test_token"

def test_empty_secret_key_fallback():
    """Verify that blank/whitespace secret key in settings does not crash token generation."""
    orig_key = settings.secret_key
    orig_algo = settings.jwt_algorithm
    try:
        settings.secret_key = ""
        settings.jwt_algorithm = "   "
        token = create_access_token({"sub": "1", "role": "FARMER_FPO"})
        assert isinstance(token, str) and len(token) > 10
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "1"
        assert payload["role"] == "FARMER_FPO"
    finally:
        settings.secret_key = orig_key
        settings.jwt_algorithm = orig_algo

def test_global_exception_handler_returns_json():
    """Verify that unhandled exceptions produce HTTP 500 application/json instead of text/plain."""
    @app.get("/api/test-trigger-unhandled-500", include_in_schema=False)
    def crash_route():
        raise RuntimeError("Test crash for global exception handler")
        
    res = client.get("/api/test-trigger-unhandled-500")
    assert res.status_code == 500
    assert "application/json" in res.headers["content-type"]
    body = res.json()
    assert "detail" in body
    assert "Test crash for global exception handler" in body["detail"]
    assert body["error_type"] == "RuntimeError"

if __name__ == "__main__":
    for name, func in list(globals().items()):
        if name.startswith("test_") and callable(func):
            print(f"Running {name}...")
            func()
            print(f"  ✓ {name} passed")
    print("\nALL AUTH RESILIENCE TESTS PASSED!")
