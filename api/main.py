from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import models
from .database import engine
import os

# Create all database tables based on SQLAlchemy models
# Note: In production you should use Alembic for migrations, but this is fine for initial setup.
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="GradVision API",
    description="Clinical AI API for Breast Cancer Detection",
    version="4.0",
)

# Set up CORS so the frontend can communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "null", "http://127.0.0.1:8000", "http://localhost:8000"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure upload directory exists
os.makedirs("uploads", exist_ok=True)
os.makedirs("heatmaps", exist_ok=True)

from .routes import auth_routes, patient_routes, diagnostics_routes

# Include imported routers
app.include_router(auth_routes.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(patient_routes.router, prefix="/api/v1/patients", tags=["patients"])
app.include_router(diagnostics_routes.router, prefix="/api/v1/diagnostics", tags=["diagnostics"])

@app.get("/")
def read_root():
    return {"message": "Welcome to the GradVision API. Documentation is available at /docs"}
