"""POST /area/check - size a bbox from a dropped pin and verify street density."""

from fastapi import APIRouter

from models.schemas import AreaCheckRequest, AreaCheckResponse
from services.area import bbox_from_center, check_density

router = APIRouter()


@router.post("/check", response_model=AreaCheckResponse)
async def check_area(req: AreaCheckRequest) -> AreaCheckResponse:
    bbox = bbox_from_center(req.center, req.target_distance_km)
    density = await check_density(bbox)
    return AreaCheckResponse(
        ok=density.ok,
        bbox=bbox,
        way_count=density.way_count,
        message=density.message,
    )
