# shape-routing

## ADDED Requirements

### Requirement: Owned OSM road graph

The system SHALL snap shapes to streets using a self-owned OSM walk-network graph (cached on disk, keyed by bounding box) instead of the Mapbox Directions API, exposing internal `nearest_node` and `route_between` operations.

#### Scenario: Offline generation against cached area

- **WHEN** a generation targets an area whose graph is already cached
- **THEN** snapping completes using only the local graph with no external routing API calls

### Requirement: Dense-waypoint short-hop routing

The system SHALL resample extracted outlines to arc-length-uniform waypoints (default ~80) and route consecutive waypoint pairs individually over the graph with a shape-fidelity cost function, so that no single routing hop is long enough to introduce shape-destroying detours.

#### Scenario: Shape preserved through snapping

- **WHEN** a fixture shape is snapped in an area that can express it
- **THEN** the snapped route's snap-fidelity score (Fréchet/Hausdorff) meets or beats the committed Mapbox-baseline scoreboard for that fixture

#### Scenario: Inexpressible stroke fails fast

- **WHEN** the shortest available hop between two consecutive waypoints exceeds the configured multiple of their straight-line distance
- **THEN** generation fails fast with a diagnostic identifying the inexpressible stroke and area, instead of returning a distorted route
