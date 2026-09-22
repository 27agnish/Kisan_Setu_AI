"""
Kisan Setu FastAPI Backend Application.
Multi-user architecture with real authentication, Google Maps Platform integration, and ML price prediction.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import engine, Base, get_db
from backend.seed_data import seed_database
from backend.routes import auth, listings, marketplace, orders, price_prediction, logistics, maps, tracking
from ml.predict import predictor

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure database schema is created and initial seed data is present
    print("🚀 Initializing Kisan Setu multi-user backend...")
    Base.metadata.create_all(bind=engine)
    seed_database()
    
    # Check ML Predictor
    if not predictor.is_ready:
        is_production = (
            os.getenv("VERCEL") == "1"
            or os.getenv("VERCEL_ENV") is not None
            or os.getenv("APP_ENV", "").lower() == "production"
        )
        auto_train_enabled = os.getenv("AUTO_TRAIN_ON_STARTUP", "0") == "1"
        if not is_production and auto_train_enabled:
            print("⚠️ ML model artifacts not found. Initiating on-the-fly training...")
            try:
                from ml.train_model import train_pipeline
                train_pipeline()
                predictor.load_artifacts()
            except Exception as e:
                print(f"Error auto-training ML model on startup: {e}")
        else:
            if is_production:
                print("ℹ️ Production/serverless runtime detected; skipping on-the-fly training. Trained model artifacts or fallback heuristic pricing active.")
            else:
                print("ℹ️ ML model artifacts not found. Startup auto-training disabled. Run 'python ml/train_model.py' to train offline, or fallback heuristic active.")
            
    yield
    print("🛑 Shutting down Kisan Setu backend.")

app = FastAPI(
    title="Kisan Setu API",
    description="Multi-user agricultural marketplace, AI price prediction, and Google Maps logistics platform.",
    version="2.1.0",
    lifespan=lifespan
)

# CORS Configuration
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Include Routers
app.include_router(auth.router)
app.include_router(maps.router)
app.include_router(listings.router)
app.include_router(marketplace.router)
app.include_router(orders.router)
app.include_router(tracking.router)
app.include_router(price_prediction.router)
app.include_router(logistics.router)

@app.get("/api/health")
def health_check():
    """System health check and ML status."""
    return {
        "status": "healthy",
        "service": "Kisan Setu API",
        "ml_model_loaded": predictor.is_ready,
        "active_model": predictor.metrics.get("best_model", "RandomForest"),
        "total_historical_records": predictor.metrics.get("total_records", 48084),
        "has_google_maps_key": bool(settings.google_maps_api_key and len(settings.google_maps_api_key) > 5)
    }

@app.post("/api/reset-demo-data")
def reset_demo_data(db: Session = Depends(get_db)):
    """Resets the demo database back to clean authentic initial state."""
    seed_database(db, force_refresh=True)
    return {"message": "Demo data successfully reset to initial state."}

# Frontend Path Configuration
FRONTEND_DIR = os.path.join(str(settings.base_dir), "frontend")
FRONTEND_INDEX = os.path.join(FRONTEND_DIR, "index.html")
LEGACY_FRONTEND = os.path.join(str(settings.base_dir), "kisan-setu-frontend.html")

# Mount static asset routes
if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
    if os.path.exists(os.path.join(FRONTEND_DIR, "css")):
        app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
    if os.path.exists(os.path.join(FRONTEND_DIR, "js")):
        app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="js")
    if os.path.exists(os.path.join(FRONTEND_DIR, "assets")):
        app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

@app.get("/", response_class=FileResponse)
def serve_home():
    target = FRONTEND_INDEX if os.path.exists(FRONTEND_INDEX) else LEGACY_FRONTEND
    if os.path.exists(target):
        return FileResponse(
            target,
            media_type="text/html",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            }
        )
    return JSONResponse({"message": "Frontend HTML file not found."})

@app.get("/index.html", response_class=FileResponse)
def serve_index():
    return serve_home()

@app.get("/kisan-setu-frontend.html", response_class=FileResponse)
def serve_legacy_frontend():
    return serve_home()

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.host, port=settings.port, reload=True)
