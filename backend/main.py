"""Ghost Tracks Backend - Dynamic Strava Art Generation."""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
import logfire
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env.local from the project root (one level up from backend/)
_project_root = Path(__file__).resolve().parent.parent
load_dotenv(_project_root / ".env.local")

# Configure logfire
logfire.configure(send_to_logfire=False)

# Allow imports from backend root when running as `uvicorn main:app`
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from routers import area, billing, generate, describe, feasibility, health  # noqa: E402

app = FastAPI(
    title="Ghost Tracks Backend",
    version="2.0.0",
    description="Dynamic Strava art route generation for Prague",
)

logfire.instrument_fastapi(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:8910",
        "http://127.0.0.1:8910",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(generate.router, prefix="/generate", tags=["generate"])
app.include_router(describe.router, prefix="/describe", tags=["describe"])
app.include_router(area.router, prefix="/area", tags=["area"])
app.include_router(billing.router, tags=["billing"])
app.include_router(feasibility.router, prefix="/feasibility", tags=["feasibility"])
