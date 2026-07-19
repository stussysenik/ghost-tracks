"""POST /describe - Generate a route from a text description."""

from fastapi import APIRouter, HTTPException

from models.schemas import DescribeRequest, DescribeResponse
from services.area import area_from_center
from services.shape_generator import ShapeGenerator
from services.shape_router import UnroutableShapeError

router = APIRouter()
generator = ShapeGenerator()


@router.post("/", response_model=DescribeResponse)
async def describe_shape(req: DescribeRequest) -> DescribeResponse:
    try:
        area = (
            area_from_center(req.center, req.max_distance_km, req.area_name)
            if req.center is not None
            else None
        )
        return await generator.generate_from_description(
            description=req.description,
            max_distance_km=req.max_distance_km,
            neighborhood=req.neighborhood,
            area=area,
            target_distance_km=req.target_distance_km,
        )
    except (ValueError, UnroutableShapeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
