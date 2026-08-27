"""
ML Train Model re-export shim.
Canonical implementation is in ml.training.train_model.
"""
from ml.training.train_model import train_pipeline

__all__ = ["train_pipeline"]

if __name__ == "__main__":
    train_pipeline()
