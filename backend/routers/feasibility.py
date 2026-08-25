"""Feasibility check endpoint."""

from fastapi import APIRouter, HTTPException

from models.schemas import FeasibilityRequest, FeasibilityResponse
from services.feasibility_service import FeasibilityService

router = APIRouter()
service = FeasibilityService()


@router.post("/", response_model=FeasibilityResponse)
async def check_feasibility(request: FeasibilityRequest) -> FeasibilityResponse:
    try:
        return service.check_feasibility(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
