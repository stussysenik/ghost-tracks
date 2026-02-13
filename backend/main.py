"""Ghost Tracks Backend - Dynamic Strava Art Generation."""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env.local from the project root (one level up from backend/)
_project_root = Path(__file__).resolve().parent.parent
load_dotenv(_project_root / ".env.local")

# Allow imports from backend root when running as `uvicorn main:app`
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from routers import generate, describe, health  # noqa: E402

app = FastAPI(
    title="Ghost Tracks Backend",
    version="2.0.0",
    description="Dynamic Strava art route generation for Prague",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(generate.router, prefix="/generate", tags=["generate"])
app.include_router(describe.router, prefix="/describe", tags=["describe"])
