"""
ML Preprocessing re-export shim.
Canonical implementation is in ml.training.preprocess.
"""
from ml.training.preprocess import (
    determine_season,
    engineer_features,
    build_preprocessor,
    CATEGORICAL_FEATURES,
    NUMERICAL_FEATURES,
    TARGET_COLUMN
)

__all__ = [
    "determine_season",
    "engineer_features",
    "build_preprocessor",
    "CATEGORICAL_FEATURES",
    "NUMERICAL_FEATURES",
    "TARGET_COLUMN"
]
