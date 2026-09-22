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

__all__ = ["app"]
