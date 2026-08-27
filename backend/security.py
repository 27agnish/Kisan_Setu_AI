"""
Backend security utilities re-export shim.
Canonical security implementation lives in backend.services.security.
"""
from backend.services.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    get_current_user,
    get_optional_current_user,
    require_role,
    security_scheme
)

__all__ = [
    "hash_password",
    "verify_password",
    "create_access_token",
    "decode_access_token",
    "get_current_user",
    "get_optional_current_user",
    "require_role",
    "security_scheme"
]
