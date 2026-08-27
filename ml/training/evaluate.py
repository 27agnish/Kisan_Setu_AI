"""
Model Evaluation Module for Kisan Setu Agricultural Price Prediction.
Calculates key regression metrics (MAE, RMSE, R², MAPE) and residual distributions.
"""

import numpy as np
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score

def calculate_metrics(y_true, y_pred, model_name="Model") -> dict:
    """Computes comprehensive regression evaluation metrics."""
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(root_mean_squared_error(y_true, y_pred))
    r2 = float(r2_score(y_true, y_pred))
    mape = float(np.mean(np.abs((y_true - y_pred) / (y_true + 1e-5))) * 100)
    
    residuals = y_true - y_pred
    residual_mean = float(np.mean(residuals))
    residual_std = float(np.std(residuals))
    
    return {
        "model_name": model_name,
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4),
        "mape_percent": round(mape, 2),
        "residual_mean": round(residual_mean, 4),
        "residual_std": round(residual_std, 4),
        "prediction_interval_95": round(1.96 * residual_std, 2)
    }

def print_metrics_comparison(rf_metrics: dict, xgb_metrics: dict):
    """Nicely formats model comparison report."""
    print("=" * 60)
    print("       AGRICULTURAL PRICE PREDICTION MODEL COMPARISON")
    print("=" * 60)
    print(f"{'Metric':<20} | {'Baseline (Random Forest)':<22} | {'Primary (XGBoost)':<15}")
    print("-" * 60)
    print(f"{'MAE (₹/kg)':<20} | {rf_metrics['mae']:<22.4f} | {xgb_metrics['mae']:<15.4f}")
    print(f"{'RMSE (₹/kg)':<20} | {rf_metrics['rmse']:<22.4f} | {xgb_metrics['rmse']:<15.4f}")
    print(f"{'R² Score':<20} | {rf_metrics['r2']:<22.4f} | {xgb_metrics['r2']:<15.4f}")
    print(f"{'MAPE (%)':<20} | {rf_metrics['mape_percent']:<21.2f}% | {xgb_metrics['mape_percent']:<14.2f}%")
    print(f"{'95% Pred Interval':<20} | ±₹{rf_metrics['prediction_interval_95']:<20.2f} | ±₹{xgb_metrics['prediction_interval_95']:<13.2f}")
    print("=" * 60)
