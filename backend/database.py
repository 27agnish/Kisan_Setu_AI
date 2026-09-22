"""
Database configuration and session lifecycle for Kisan Setu.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config.settings import settings, BASE_DIR

# Robust absolute path resolution for SQLite to prevent CWD dependency
db_url = settings.database_url
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
if db_url.startswith("sqlite:///./"):
    rel_part = db_url[len("sqlite:///./"):]
    abs_path = os.path.join(str(BASE_DIR), rel_part)
    db_url = f"sqlite:///{abs_path}"
elif db_url.startswith("sqlite:///") and not db_url.startswith("sqlite:////"):
    rel_part = db_url[len("sqlite:///"):]
    if not os.path.isabs(rel_part):
        abs_path = os.path.join(str(BASE_DIR), rel_part)
        db_url = f"sqlite:///{abs_path}"

# For SQLite, ensure check_same_thread is False for multi-threaded FastAPI workers
connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}

engine = create_engine(
    db_url,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """FastAPI dependency for yielding database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
