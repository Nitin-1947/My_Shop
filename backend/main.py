"""
My Shop — FastAPI application entrypoint.
Registers all routers, configures CORS, creates tables on startup.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import create_tables
from app.api import patients, doctors, generic_drugs, medicines, dose_patterns, generation, bills

app = FastAPI(
    title=settings.APP_NAME,
    description="Offline Medical Shop Random Bill Generator — local-first, no AI/cloud dependency.",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    create_tables()


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
def health():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(patients.router)
app.include_router(doctors.router)
app.include_router(generic_drugs.router)
app.include_router(medicines.router)
app.include_router(dose_patterns.router)
app.include_router(generation.router)
app.include_router(bills.router)
