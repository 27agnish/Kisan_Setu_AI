import os
from dataclasses import dataclass

@dataclass
class Settings:
    app_name: str = os.getenv("APP_NAME", "Kisan Setu API")
    app_env: str = os.getenv("APP_ENV", "development")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./kisan_setu.db")
    model_dir: str = os.getenv("MODEL_DIR", "ml/models")
    data_dir: str = os.getenv("DATA_DIR", "ml/data")
    secret_key: str = os.getenv("SECRET_KEY", "kisan_setu_secret_key_2026_super_secure_jwt")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) # 24 hours
    cors_origins: str = os.getenv("CORS_ORIGINS", "*")
    google_maps_api_key: str = os.getenv("GOOGLE_MAPS_API_KEY", "")

settings = Settings()
