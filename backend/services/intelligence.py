import dspy
import logfire
from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field
from typing import TypedDict, List, Optional

# 1. dspy setup
class ShapeIdea(dspy.Signature):
    """Generate a creative idea for a GPS art shape based on a neighborhood."""
    neighborhood = dspy.InputField()
    constraints = dspy.InputField(desc="e.g. max distance, terrain")
    idea = dspy.OutputField(desc="A creative shape description and why it fits")

# 2. Pydantic schema for business logic
class ShapeState(BaseModel):
    neighborhood: str
    constraints: Optional[str] = None
    generated_idea: Optional[str] = None
    validation_status: str = "pending"

class GraphState(TypedDict):
    shape_state: ShapeState

# 3. LangGraph node functions
def generate_idea_node(state: GraphState) -> GraphState:
    with logfire.span("generating shape idea for {neighborhood}", neighborhood=state["shape_state"].neighborhood):
        predictor = dspy.Predict(ShapeIdea)
        response = predictor(
            neighborhood=state["shape_state"].neighborhood,
            constraints=state["shape_state"].constraints or "none"
        )
        state["shape_state"].generated_idea = response.idea
        return state

def validate_idea_node(state: GraphState) -> GraphState:
    with logfire.span("validating shape idea"):
        # Logic to validate if the idea is feasible
        state["shape_state"].validation_status = "validated"
        return state

# 4. Define the graph
def create_intelligence_graph():
    workflow = StateGraph(GraphState)
    
    workflow.add_node("generate", generate_idea_node)
    workflow.add_node("validate", validate_idea_node)
    
    workflow.set_entry_point("generate")
    workflow.add_edge("generate", "validate")
    workflow.add_edge("validate", END)
    
    return workflow.compile()

# Example usage
if __name__ == "__main__":
    # Note: Requires DSPy configuration (LM/RM) to actually run
    # dspy.settings.configure(lm=...)
    graph = create_intelligence_graph()
    initial_state = {
        "shape_state": ShapeState(neighborhood="Staré Město", constraints="max 5km")
    }
    # result = graph.invoke(initial_state)
    print("Intelligence Graph initialized with dspy and langgraph.")
