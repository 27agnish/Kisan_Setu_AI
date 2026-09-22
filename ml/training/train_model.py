"""
End-to-End Model Training Pipeline for Kisan Setu Agricultural Price Prediction.
Trains Baseline (Random Forest) and Primary (XGBoost) models on historical mandi data
using strict chronological train/val/test splits, compares metrics, and exports production models.
"""

import os
import sys
from pathlib import Path

# Project root directory (SIH_2026)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import json
import joblib
import pandas as pd
import numpy as np
from datetime import datetime
from sklearn.ensemble import RandomForestRegressor
try:
    from xgboost import XGBRegressor
except ImportError:
    XGBRegressor = None

from ml.training.preprocess import (
    engineer_features,
    build_preprocessor,
    CATEGORICAL_FEATURES,
    NUMERICAL_FEATURES,
    TARGET_COLUMN
)
from ml.training.evaluate import calculate_metrics, print_metrics_comparison
from ml.training.generate_dataset import generate_agricultural_dataset

DEFAULT_DATA_PATH = str(BASE_DIR / "ml" / "data" / "agmarknet_historical_prices.csv")
DEFAULT_MODEL_DIR = str(BASE_DIR / "ml" / "models")

def train_pipeline(data_path=None, model_dir=None):
    data_path = data_path or DEFAULT_DATA_PATH
    model_dir = model_dir or DEFAULT_MODEL_DIR
    os.makedirs(model_dir, exist_ok=True)
    
    # 1. Load Data
    if not os.path.exists(data_path):
        print(f"Dataset not found at {data_path}. Generating fresh Agmarknet dataset...")
        df_raw = generate_agricultural_dataset(data_path)
    else:
        print(f"Loading agricultural mandi dataset from {data_path}...")
        df_raw = pd.read_csv(data_path)
        
    print(f"Total raw records loaded: {len(df_raw)}")
    
    # 2. Data Cleaning & Feature Engineering
    print("Performing feature engineering & temporal featurization...")
    df_clean = df_raw.dropna(subset=[TARGET_COLUMN, 'commodity', 'market', 'date']).copy()
    df_features = engineer_features(df_clean)
    
    # 3. Strict Chronological Train/Validation/Test Split
    df_features.sort_values(by='date', inplace=True)
    dates = df_features['date'].unique()
    n_dates = len(dates)
    
    train_end_idx = int(n_dates * 0.70)
    val_end_idx = int(n_dates * 0.85)
    
    train_cutoff = dates[train_end_idx]
    val_cutoff = dates[val_end_idx]
    
    train_df = df_features[df_features['date'] <= train_cutoff].copy()
    val_df = df_features[(df_features['date'] > train_cutoff) & (df_features['date'] <= val_cutoff)].copy()
    test_df = df_features[df_features['date'] > val_cutoff].copy()
    
    print(f"\nChronological Data Split Summary:")
    print(f"  • Train Set:      {train_df['date'].min().strftime('%Y-%m-%d')} to {train_df['date'].max().strftime('%Y-%m-%d')} ({len(train_df)} rows, {len(train_df)/len(df_features)*100:.1f}%)")
    print(f"  • Validation Set: {val_df['date'].min().strftime('%Y-%m-%d')} to {val_df['date'].max().strftime('%Y-%m-%d')} ({len(val_df)} rows, {len(val_df)/len(df_features)*100:.1f}%)")
    print(f"  • Test Set:       {test_df['date'].min().strftime('%Y-%m-%d')} to {test_df['date'].max().strftime('%Y-%m-%d')} ({len(test_df)} rows, {len(test_df)/len(df_features)*100:.1f}%)")
    
    X_train_raw = train_df[CATEGORICAL_FEATURES + NUMERICAL_FEATURES]
    y_train = train_df[TARGET_COLUMN].values
    
    X_val_raw = val_df[CATEGORICAL_FEATURES + NUMERICAL_FEATURES]
    y_val = val_df[TARGET_COLUMN].values
    
    X_test_raw = test_df[CATEGORICAL_FEATURES + NUMERICAL_FEATURES]
    y_test = test_df[TARGET_COLUMN].values
    
    # 4. Preprocessor Fitting (ONLY on Train set to prevent data leakage)
    print("\nFitting preprocessing transformations on training set...")
    preprocessor = build_preprocessor()
    X_train = preprocessor.fit_transform(X_train_raw)
    X_val = preprocessor.transform(X_val_raw)
    X_test = preprocessor.transform(X_test_raw)
    
    # 5. Train Baseline Model (Random Forest Regressor)
    print("\nTraining Baseline Model: RandomForestRegressor (n_estimators=100, max_depth=14)...")
    rf_model = RandomForestRegressor(
        n_estimators=100,
        max_depth=14,
        min_samples_split=5,
        random_state=42,
        n_jobs=-1
    )
    rf_model.fit(X_train, y_train)
    rf_test_pred = rf_model.predict(X_test)
    rf_metrics = calculate_metrics(y_test, rf_test_pred, model_name="RandomForestRegressor")
    
    # 6. Train Primary Model (XGBoost Regressor)
    if XGBRegressor is None:
        raise ImportError("xgboost is required for offline training. Install it with: pip install -r requirements-train.txt")
    print("Training Primary Model: XGBoostRegressor (n_estimators=300, lr=0.04, max_depth=6)...")
    xgb_model = XGBRegressor(
        n_estimators=300,
        learning_rate=0.04,
        max_depth=6,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
        n_jobs=-1
    )
    xgb_model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False
    )
    xgb_test_pred = xgb_model.predict(X_test)
    xgb_metrics = calculate_metrics(y_test, xgb_test_pred, model_name="XGBoostRegressor")
    
    # 7. Model Comparison & Best Selection
    print_metrics_comparison(rf_metrics, xgb_metrics)
    
    best_model_name = "XGBoost" if xgb_metrics['rmse'] <= rf_metrics['rmse'] else "RandomForest"
    best_model = xgb_model if best_model_name == "XGBoost" else rf_model
    best_metrics = xgb_metrics if best_model_name == "XGBoost" else rf_metrics
    
    print(f"\n>>> Selected Winning Production Model: {best_model_name} (Test RMSE: ₹{best_metrics['rmse']:.2f}/kg, R²: {best_metrics['r2']:.4f})")
    
    # 8. Save Model Artifacts
    print("\nSaving model artifacts to disk...")
    joblib.dump(preprocessor, os.path.join(model_dir, "preprocessor.joblib"))
    joblib.dump(rf_model, os.path.join(model_dir, "rf_price_model.joblib"))
    joblib.dump(xgb_model, os.path.join(model_dir, "xgboost_price_model.joblib"))
    joblib.dump(best_model, os.path.join(model_dir, "best_model.joblib"))
    
    metrics_summary = {
        "training_timestamp": datetime.now().isoformat(),
        "total_records": len(df_features),
        "train_rows": len(train_df),
        "val_rows": len(val_df),
        "test_rows": len(test_df),
        "best_model": best_model_name,
        "models": {
            "RandomForestRegressor": rf_metrics,
            "XGBoostRegressor": xgb_metrics
        },
        "feature_names": {
            "categorical": CATEGORICAL_FEATURES,
            "numerical": NUMERICAL_FEATURES
        },
        "supported_crops": sorted(df_raw['commodity'].unique().tolist()),
        "supported_markets": sorted(df_raw['market'].unique().tolist())
    }
    
    with open(os.path.join(model_dir, "metrics.json"), "w") as f:
        json.dump(metrics_summary, f, indent=2)
        
    print("Model training pipeline completed successfully!")
    print(f"Artifacts saved in '{model_dir}/'")
    return metrics_summary

if __name__ == "__main__":
    train_pipeline()
