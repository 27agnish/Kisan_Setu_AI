"""
Vercel Serverless Function Entrypoint for Kisan Setu AI.
Exposes the FastAPI application object `app` to Vercel's Python runtime.
"""
import sys
from pathlib import Path

# Add project root directory to sys.path so 'backend', 'ml', and 'config' can be imported
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Import the existing FastAPI application
from backend.main import app
from fastapi import Request


@app.middleware("http")
async def normalize_vercel_paths(request: Request, call_next):
    """
    Normalizes request paths if an edge proxy or rewrite rule prefixes
    or rewrites the target to /api/index.py or /api/index.
    """
    path = request.scope.get("path", "")
    if path in ("/api/index.py", "/api/index"):
        request.scope["path"] = "/"
    elif path.startswith("/api/index.py/"):
        request.scope["path"] = path[len("/api/index.py") :]
    elif path.startswith("/api/index/"):
        request.scope["path"] = path[len("/api/index") :]

    return await call_next(request)


__all__ = ["app"]
