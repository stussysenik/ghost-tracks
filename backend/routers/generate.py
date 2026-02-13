"""POST /generate - Generate shape ideas for a Prague neighborhood."""

from fastapi import APIRouter, HTTPException

from models.schemas import GenerateRequest, GenerateResponse
from services.shape_generator import ShapeGenerator

router = APIRouter()
generator = ShapeGenerator()


@router.post("/", response_model=GenerateResponse)
async def generate_shapes(req: GenerateRequest) -> GenerateResponse:
    try:
        return await generator.generate_for_neighborhood(
            neighborhood=req.neighborhood,
            count=req.count,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
