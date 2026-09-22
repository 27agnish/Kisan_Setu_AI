"""
Central application configuration for Kisan Setu.
Loads environment variables with fallback defaults and computes project root paths.
"""
import os
from pathlib import Path
from dataclasses import dataclass
from dotenv import load_dotenv

# Project root directory (SIH_2026)
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env from root if available
env_path = BASE_DIR / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

@dataclass
class Settings:
    base_dir: Path = BASE_DIR
    app_name: str = os.getenv("APP_NAME", "Kisan Setu API")
    app_env: str = os.getenv("APP_ENV", "development")
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT") or "8000")
    
    # Database URL: default to database/kisan_setu.db under project root (or /tmp on Vercel)
    is_vercel: bool = os.getenv("VERCEL") == "1" or os.getenv("VERCEL_ENV") is not None
    database_url: str = (
        "sqlite:////tmp/kisan_setu.db"
        if (os.getenv("VERCEL") == "1" or os.getenv("VERCEL_ENV") is not None) and (not os.getenv("DATABASE_URL") or (os.getenv("DATABASE_URL", "").startswith("sqlite") and "/tmp" not in os.getenv("DATABASE_URL", "")))
        else os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'database' / 'kisan_setu.db'}").replace("postgres://", "postgresql://", 1)
    )
    
    # ML Models and Data
    model_dir: str = os.getenv("MODEL_DIR", str(BASE_DIR / "ml" / "models"))
    data_dir: str = os.getenv("DATA_DIR", str(BASE_DIR / "ml" / "data"))
    
    # Security / Auth
    secret_key: str = os.getenv("SECRET_KEY", "kisan_setu_secret_key_2026_super_secure_jwt")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES") or "1440") # 24 hours
    cors_origins: str = os.getenv("CORS_ORIGINS", "*")
    
    # Maps
    google_maps_api_key: str = os.getenv("GOOGLE_MAPS_API_KEY", "")

settings = Settings()
