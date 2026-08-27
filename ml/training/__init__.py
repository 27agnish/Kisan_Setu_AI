"""
ML Training subpackage for Kisan Setu.
"""
from ml.training.train_model import train_pipeline
from ml.training.preprocess import engineer_features, build_preprocessor, determine_season
from ml.training.generate_dataset import generate_agricultural_dataset
from ml.training.evaluate import calculate_metrics, print_metrics_comparison

__all__ = [
    "train_pipeline",
    "engineer_features",
    "build_preprocessor",
    "determine_season",
    "generate_agricultural_dataset",
    "calculate_metrics",
    "print_metrics_comparison"
]
