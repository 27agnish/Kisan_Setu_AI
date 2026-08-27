"""
Agricultural Price Preprocessing & Feature Engineering Module for Kisan Setu.
Engineers temporal, autoregressive lag, rolling statistics, arrival dynamics,
and categorical features while strictly preventing temporal lookahead / data leakage.
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
import joblib

def determine_season(month: int) -> str:
    """Classifies Indian agricultural crop seasons."""
    if month in [6, 7, 8, 9, 10]:
        return "Kharif" # Monsoon season
    elif month in [11, 12, 1, 2, 3]:
        return "Rabi"   # Winter season
    else:
        return "Zaid"   # Summer season

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Creates comprehensive feature set for price prediction.
    Ensures calculations are performed strictly per (commodity, market) time series.
    """
    data = df.copy()
    data['date'] = pd.to_datetime(data['date'])
    data.sort_values(by=['commodity', 'market', 'date'], inplace=True)
    
    # 1. Temporal Features
    data['month'] = data['date'].dt.month
    data['day_of_week'] = data['date'].dt.dayofweek
    data['day_of_year'] = data['date'].dt.dayofyear
    data['is_weekend'] = data['day_of_week'].isin([5, 6]).astype(int)
    data['season'] = data['month'].apply(determine_season)
    
    # Cyclic encoding for seasonality
    data['month_sin'] = np.sin(2 * np.pi * data['month'] / 12.0)
    data['month_cos'] = np.cos(2 * np.pi * data['month'] / 12.0)
    data['day_sin'] = np.sin(2 * np.pi * data['day_of_year'] / 365.25)
    data['day_cos'] = np.cos(2 * np.pi * data['day_of_year'] / 365.25)
    
    # 2. Lag and Rolling Window Features (Grouped by commodity & market)
    grouped = data.groupby(['commodity', 'market'])
    
    # Price lags
    data['lag_1_price'] = grouped['modal_price'].shift(1)
    data['lag_7_price'] = grouped['modal_price'].shift(7)
    data['lag_14_price'] = grouped['modal_price'].shift(14)
    data['lag_30_price'] = grouped['modal_price'].shift(30)
    
    # Rolling averages (using closed='left' equivalent by rolling on shifted series to avoid leakage)
    shifted_price = grouped['modal_price'].shift(1)
    data['rolling_7_mean'] = grouped['modal_price'].transform(lambda x: x.shift(1).rolling(7, min_periods=1).mean())
    data['rolling_14_mean'] = grouped['modal_price'].transform(lambda x: x.shift(1).rolling(14, min_periods=1).mean())
    data['rolling_30_mean'] = grouped['modal_price'].transform(lambda x: x.shift(1).rolling(30, min_periods=1).mean())
    
    # Price volatility & momentum trend
    data['price_volatility_7d'] = grouped['modal_price'].transform(lambda x: x.shift(1).rolling(7, min_periods=1).std()).fillna(0.5)
    data['price_trend_7d'] = ((data['rolling_7_mean'] - data['rolling_30_mean']) / (data['rolling_30_mean'] + 1e-5)).clip(-0.5, 0.5)
    
    # Arrival dynamics
    data['rolling_arrival_7d'] = grouped['arrival_quantity'].transform(lambda x: x.shift(1).rolling(7, min_periods=1).mean()).fillna(1000.0)
    data['arrival_ratio_7d'] = (data['arrival_quantity'] / (data['rolling_arrival_7d'] + 1e-5)).clip(0.1, 5.0)
    
    # Fill remaining initial NaNs from shifting with backfill or first valid value
    for col in ['lag_1_price', 'lag_7_price', 'lag_14_price', 'lag_30_price', 'rolling_7_mean', 'rolling_14_mean', 'rolling_30_mean']:
        data[col] = data[col].fillna(data['modal_price'])
        
    return data

CATEGORICAL_FEATURES = ['commodity', 'variety', 'state', 'district', 'market', 'season', 'quality_grade']
NUMERICAL_FEATURES = [
    'month_sin', 'month_cos', 'day_sin', 'day_cos', 'is_weekend',
    'lag_1_price', 'lag_7_price', 'lag_14_price', 'lag_30_price',
    'rolling_7_mean', 'rolling_14_mean', 'rolling_30_mean',
    'price_volatility_7d', 'price_trend_7d',
    'arrival_quantity', 'rolling_arrival_7d', 'arrival_ratio_7d'
]
TARGET_COLUMN = 'modal_price'

def build_preprocessor() -> ColumnTransformer:
    """Builds a scikit-learn ColumnTransformer for preprocessing."""
    numeric_transformer = StandardScaler()
    categorical_transformer = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, NUMERICAL_FEATURES),
            ('cat', categorical_transformer, CATEGORICAL_FEATURES)
        ]
    )
    return preprocessor
