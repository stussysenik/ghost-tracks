"""POST /generate - Generate shape ideas for a Prague neighborhood."""

from fastapi import APIRouter, HTTPException
import logfire
from models.schemas import GenerateRequest, GenerateResponse, ShapeIdea, BoundingBox, Coordinate
from services.intelligence import create_intelligence_graph, ShapeState

router = APIRouter()
intelligence_graph = create_intelligence_graph()

@router.post("/", response_model=GenerateResponse)
async def generate_shapes(req: GenerateRequest) -> GenerateResponse:
    with logfire.span("generate_shapes_endpoint", neighborhood=req.neighborhood):
        try:
            # Prepare state for LangGraph
            initial_state = {
                "shape_state": ShapeState(neighborhood=req.neighborhood, constraints=f"count={req.count}")
            }
            
            # Invoke the graph
            result = intelligence_graph.invoke(initial_state)
            shape_state: ShapeState = result["shape_state"]
            
            # For now, we bridge the LangGraph output to the existing schema
            # In a real scenario, we'd have dspy generate multiple structured ideas
            idea = ShapeIdea(
                name=shape_state.generated_idea[:50] if shape_state.generated_idea else "New Shape",
                description=shape_state.generated_idea or "A creative shape",
                emoji="✨",
                estimated_distance_km=5.0,
                difficulty="moderate",
                control_points=[Coordinate(lng=14.42, lat=50.08)], # Dummy coordinates for now
                target_area=req.neighborhood
            )
            
            return GenerateResponse(
                ideas=[idea],
                neighborhood=req.neighborhood,
                bbox=BoundingBox(min_lng=14.4, min_lat=50.0, max_lng=14.5, max_lat=50.1) # Dummy bbox
            )
        except Exception as exc:
            logfire.error("Generation failed", exception=exc)
            raise HTTPException(status_code=500, detail=str(exc))
