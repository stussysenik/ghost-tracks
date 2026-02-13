"""POST /describe - Generate a route from a text description."""

from fastapi import APIRouter, HTTPException

from models.schemas import DescribeRequest, DescribeResponse
from services.shape_generator import ShapeGenerator

router = APIRouter()
generator = ShapeGenerator()


@router.post("/", response_model=DescribeResponse)
async def describe_shape(req: DescribeRequest) -> DescribeResponse:
    try:
        return await generator.generate_from_description(
            description=req.description,
            max_distance_km=req.max_distance_km,
            neighborhood=req.neighborhood,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
