"""
Backend configuration re-export shim.
Central configuration lives in config.settings.
"""
from config.settings import Settings, settings, BASE_DIR

__all__ = ["Settings", "settings", "BASE_DIR"]

