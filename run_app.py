"""
Kisan Setu Application Master Runner.
Verifies dependencies, trains ML models if missing, seeds database, and starts the FastAPI server.
"""

import os
import sys
import argparse
import subprocess
import uvicorn

def main():
    parser = argparse.ArgumentParser(description="Kisan Setu Application Server & ML Engine")
    parser.add_argument("--host", default="0.0.0.0", help="Host address (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Port (default: 8000)")
    parser.add_argument("--train-ml", action="store_true", help="Force retrain ML price models")
    parser.add_argument("--seed-db", action="store_true", help="Force reseed demo database")
    parser.add_argument("--test", action="store_true", help="Run end-to-end integration test suite")
    args = parser.parse_args()

    # 1. Run integration test if requested
    if args.test:
        print("Running end-to-end integration test suite...")
        from test_backend_api import run_all_tests
        run_all_tests()
        return

    # 2. Check / Train ML Model
    model_path = os.path.join("ml", "models", "best_model.joblib")
    if args.train_ml or not os.path.exists(model_path):
        print("\n[Step 1/3] Training / Verifying ML Price Prediction Pipeline...")
        from ml.train_model import train_pipeline
        train_pipeline()
    else:
        print("\n[Step 1/3] ✓ Trained ML model found at ml/models/best_model.joblib")

    # 3. Seed Database
    print("\n[Step 2/3] Initializing SQLite database & agricultural demo records...")
    from backend.seed_data import seed_database
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
