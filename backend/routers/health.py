"""Health check endpoint."""

from fastapi import APIRouter

from models.schemas import HealthResponse

router = APIRouter()


@router.get("/", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(status="ok", version="2.0.0")
