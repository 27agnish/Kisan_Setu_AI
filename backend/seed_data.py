"""
Backend seed_data re-export shim.
Canonical seed implementation lives in database.seed.seed_data.
"""
from database.seed.seed_data import seed_database

__all__ = ["seed_database"]
