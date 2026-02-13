"""Ghost Tracks - Pydantic schemas for request/response models."""

from __future__ import annotations

from pydantic import BaseModel, Field


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
    neighborhood: str
    count: int = Field(default=3, ge=1, le=6)


class GenerateResponse(BaseModel):
    ideas: list[ShapeIdea]
    neighborhood: str
    bbox: BoundingBox


class DescribeRequest(BaseModel):
    description: str
    max_distance_km: float = Field(default=10.0, ge=1.0, le=30.0)
    neighborhood: str | None = Field(default=None)


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


class HealthResponse(BaseModel):
    status: str
    version: str
