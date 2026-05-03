# Specification: Ghost Tracks Architecture Refactor (Functional Geometry Evolution)

## Goal
Transition to a high-performance, decoupled architecture that treats GPS art as **Functional Geometry**, utilizing Category Theory for topological mapping and Rust WASM for browser-side performance.

## The Advanced Pipeline
1.  **Multimodal Input**: User uploads images or text intents.
2.  **Logic Orchestrator (Gemini 1.5 Pro)**: Deconstructs images into topological graphs (nodes and interconnected edges).
3.  **Vectorization Engine (Python)**: Uses `vtracer` and `potrace` to turn raster contours into smooth vector paths.
4.  **Geometric Engine (Rust WASM)**:
    *   Treats routes as **Functors** (mapping Abstract Graphs to Road Networks).
    *   Utilizes **Sheaf Theory** to reconcile local street constraints (one-ways) with global shape fidelity.
    *   Leverages `geo-rust` and `lyon` for rigorous math and SVG tessellation.
5.  **Validation**: Pydantic (Python) and Zod (TS) ensure data integrity across the pipeline.

## Stack
- **Frontend**: Svelte 5 + xstate + Deck.gl + D3-geo.
- **WASM Engine**: Rust (`wasm-pack`) + `geo` + `lyon` for functional geometry.
- **Gateway**: Hono (Bun) for orchestration and sub-ms validation.
- **Intelligence**: Python (`dspy`, `langgraph`, `vtracer`, `opencv-python`, `google-generativeai`).
- **Observability**: Pydantic Logfire (Local-first).

## Updated Task Breakdown
- [x] Initialize Hono API on Bun.
- [x] Set up xstate in Svelte.
- [x] Define shared Zod/Pydantic schemas.
- [ ] Set up Rust WASM scaffolding (`wasm-pack`).
- [ ] Implement Image-to-Path microservice in Python.
- [ ] Integrate Gemini 1.5 Pro for topological graph extraction.
- [ ] Implement Sheaf-based constraint logic in the Geometric Engine.
- [ ] Add `Deck.gl` for high-performance path visualization over Mapbox/Google Maps.
