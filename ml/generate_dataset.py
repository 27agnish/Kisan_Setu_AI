"""
ML Generate Dataset re-export shim.
Canonical implementation is in ml.training.generate_dataset.
"""
from ml.training.generate_dataset import generate_agricultural_dataset

__all__ = ["generate_agricultural_dataset"]

if __name__ == "__main__":
    generate_agricultural_dataset()
