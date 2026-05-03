from pydantic import BaseModel, Field
from typing import List, Tuple
from datetime import datetime
from uuid import UUID

class Route(BaseModel):
    id: UUID
    name: str
    points: List[Tuple[float, float]]
    distance: float = Field(gt=0)
    neighborhood: str
    created_at: datetime = Field(default_factory=datetime.now)

    def formatted_distance(self) -> str:
        return f"{self.distance / 1000:.2f} km"

    def summary(self) -> str:
        return f"{self.name} in {self.neighborhood} ({self.formatted_distance()})"
