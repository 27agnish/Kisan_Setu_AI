"""
Kisan Setu Application Master Runner.
Verifies dependencies, loads ML models, initializes database, and starts the FastAPI server.
"""

import os
import sys
from pathlib import Path
import argparse
import uvicorn

# Ensure repository root is on sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from config.settings import settings

def main():
    parser = argparse.ArgumentParser(description="Kisan Setu Application Server & ML Engine")
    parser.add_argument("--host", default=settings.host, help=f"Host address (default: {settings.host})")
    parser.add_argument("--port", type=int, default=settings.port, help=f"Port (default: {settings.port})")
    parser.add_argument("--train-ml", action="store_true", help="Force retrain ML price models")
    parser.add_argument("--seed-db", action="store_true", help="Force reseed demo database")
    parser.add_argument("--test", action="store_true", help="Run end-to-end integration test suite")
    args = parser.parse_args()

    # 1. Run integration test if requested
    if args.test:
        print("Running end-to-end integration test suite...")
        try:
            from tests.test_backend_api import run_all_tests
        except ImportError:
            from test_backend_api import run_all_tests
        run_all_tests()
        return

    # 2. Check / Train ML Model
    model_path = os.path.join(settings.model_dir, "best_model.joblib")
    if args.train_ml or not os.path.exists(model_path):
        print("\n[Step 1/3] Training / Verifying ML Price Prediction Pipeline...")
        from ml.training.train_model import train_pipeline
        train_pipeline()
    else:
        print(f"\n[Step 1/3] ✓ Trained ML model found at {model_path}")

    # 3. Seed Database
    print("\n[Step 2/3] Initializing SQLite database & agricultural demo records...")
    from database.seed.seed_data import seed_database
    seed_database(force_refresh=args.seed_db)

    # 4. Start Server
    print("\n[Step 3/3] Starting Kisan Setu Web Application Server...")
    print("=" * 65)
    print(f"🌾 KISAN SETU IS RUNNING LIVE AT: http://localhost:{args.port}")
    print(f"📡 API Documentation (Swagger):  http://localhost:{args.port}/docs")
    print(f"🤖 Active ML Price Predictor:    Loaded and calibrated on AGMARKNET data")
    print("=" * 65)
    print("Press Ctrl+C to stop the server.\n")

    uvicorn.run("backend.main:app", host=args.host, port=args.port, reload=False)

if __name__ == "__main__":
    main()
