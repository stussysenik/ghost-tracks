"""POST /generate - Generate shape ideas for a Prague neighborhood."""

import logfire
from fastapi import APIRouter, HTTPException

from models.schemas import GenerateRequest, GenerateResponse
from services.area import area_from_center
from services.shape_generator import ShapeGenerator

router = APIRouter()
generator = ShapeGenerator()


@router.post("/", response_model=GenerateResponse)
async def generate_shapes(req: GenerateRequest) -> GenerateResponse:
    label = req.area_name or req.neighborhood or "pin"
    with logfire.span("generate_shapes_endpoint", area=label):
        try:
            if req.center is not None:
                area = area_from_center(req.center, req.target_distance_km, req.area_name)
                return await generator.generate_for_area(area, req.count)
            return await generator.generate_for_neighborhood(
                neighborhood=req.neighborhood,
                count=req.count,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        except Exception as exc:
            logfire.error("Generation failed", exception=exc)
            raise HTTPException(status_code=500, detail=str(exc))
