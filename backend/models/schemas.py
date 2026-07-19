"""Ghost Tracks - Pydantic schemas for request/response models."""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class Coordinate(BaseModel):
    lng: float = Field(..., ge=-180, le=180)
    lat: float = Field(..., ge=-90, le=90)


class BoundingBox(BaseModel):
    min_lng: float
    min_lat: float
    max_lng: float
    max_lat: float

    def center(self) -> Coordinate:
        return Coordinate(
            lng=(self.min_lng + self.max_lng) / 2,
            lat=(self.min_lat + self.max_lat) / 2,
        )

    def width_deg(self) -> float:
        return self.max_lng - self.min_lng

    def height_deg(self) -> float:
        return self.max_lat - self.min_lat


class Neighborhood(BaseModel):
    name: str
    name_cs: str
    center: Coordinate
    bbox: BoundingBox
    street_layout: str = Field(..., pattern=r"^(grid|organic|mixed)$")
    character: str
    good_for: list[str]


class Area(BaseModel):
    """A generic, global generation area — a pin + a computed bounding box.
    Duck-compatible with Neighborhood (name/center/bbox/street_layout) so the
    generator treats curated neighborhoods and dropped pins identically."""

    name: str
    center: Coordinate
    bbox: BoundingBox
    street_layout: str = "mixed"


class ShapeIdea(BaseModel):
    name: str
    description: str
    emoji: str
    estimated_distance_km: float = Field(..., gt=0)
    difficulty: str = Field(..., pattern=r"^(easy|moderate|hard)$")
    control_points: list[Coordinate]
    target_area: str


class WaypointMarker(BaseModel):
    index: int
    lng: float
    lat: float
    instruction: str


class ValidationResult(BaseModel):
    score: float = Field(..., ge=0, le=100)
    passed: bool
    method: str
    reasoning: str = ""


# --- Request / Response ---


class GenerateRequest(BaseModel):
    # Global area selection: either a dropped pin (`center` + target length) or
    # a curated neighborhood name. At least one is required.
    center: Coordinate | None = None
    target_distance_km: float = Field(default=5.0, ge=1.0, le=30.0)
    area_name: str | None = None
    neighborhood: str | None = None
    count: int = Field(default=3, ge=1, le=6)

    @model_validator(mode="after")
    def _require_area(self) -> "GenerateRequest":
        if self.center is None and not self.neighborhood:
            raise ValueError("Provide either `center` (a dropped pin) or `neighborhood`.")
        return self


class GenerateResponse(BaseModel):
    ideas: list[ShapeIdea]
    neighborhood: str
    bbox: BoundingBox


class DescribeRequest(BaseModel):
    description: str
    max_distance_km: float = Field(default=10.0, ge=1.0, le=30.0)
    # Opt-in distance targeting. Absent means "size the shape to the area", the
    # behaviour before the runnable-route contract; the UI control lands in 4.4.
    target_distance_km: float | None = Field(default=None, ge=1.0, le=30.0)
    neighborhood: str | None = Field(default=None)
    # Optional dropped pin; when absent the backend auto-selects an area.
    center: Coordinate | None = None
    area_name: str | None = None


class AreaCheckRequest(BaseModel):
    center: Coordinate
    target_distance_km: float = Field(default=5.0, ge=1.0, le=30.0)


class AreaCheckResponse(BaseModel):
    ok: bool
    bbox: BoundingBox
    way_count: int | None = None
    message: str


class DescribeResponse(BaseModel):
    shape: ShapeIdea
    neighborhood: str
    bbox: BoundingBox
    similarity_score: float
    routed_coordinates: list[list[float]]
    distance_km: float
    duration_minutes: int
    waypoints: list[WaypointMarker]
    alternative_neighborhoods: list[str] = Field(default_factory=list)
    # The requested distance, and whether the route actually reached it. When
    # `best_effort` is true, `distance_km` is the closest achievable length — the
    # measured truth, never the target rounded into place.
    target_distance_km: float | None = None
    best_effort: bool = False


class HealthResponse(BaseModel):
    status: str
    version: str
