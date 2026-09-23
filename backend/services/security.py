"""
Authentication and security utilities for Kisan Setu.
Implements bcrypt password hashing, JWT token creation/verification, and FastAPI auth dependencies.
"""

import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db

security_scheme = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    """Hashes plaintext password using bcrypt with salt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against the stored bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generates a signed JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
        
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    secret = (getattr(settings, "secret_key", None) or "").strip() or "kisan_setu_secret_key_2026_super_secure_jwt"
    algo = (getattr(settings, "jwt_algorithm", None) or "").strip() or "HS256"
    encoded_jwt = jwt.encode(to_encode, secret, algorithm=algo)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decodes and validates a JWT access token."""
    try:
        secret = (getattr(settings, "secret_key", None) or "").strip() or "kisan_setu_secret_key_2026_super_secure_jwt"
        algo = (getattr(settings, "jwt_algorithm", None) or "").strip() or "HS256"
        payload = jwt.decode(token, secret, algorithms=[algo])
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, jwt.InvalidKeyError):
        return None

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
):
    """
    FastAPI dependency to authenticate requests via Bearer JWT token.
    """
    from backend.models import User
    
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please login.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with this token was not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive.",
        )
        
    return user

def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
):
    """Optional authentication dependency that returns User or None."""
    from backend.models import User
    if not credentials or not credentials.credentials:
        return None
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    try:
        user_id = int(payload["sub"])
        user = db.query(User).filter(User.id == user_id).first()
        return user if user and user.is_active else None
    except Exception:
        return None

def require_role(allowed_roles: List[str]):
    """Enforces specific user roles for protected routes."""
    def role_checker(current_user = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires one of roles {allowed_roles}, your role is {current_user.role}"
            )
        return current_user
    return role_checker
