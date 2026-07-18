# Design — Make Routes Reliable and Runnable

## Context

The current pipeline (image → vtracer/skeletonize → control points → Mapbox Directions → validator retry) fails unpredictably on arbitrary shapes. Mapbox Directions optimizes travel time between sparse waypoints — the wrong objective for shape-following. The reference technique (DrawonMaps) proves shape fidelity comes from **waypoint density + short-hop routing**, not from a smarter router: ~80 arc-length-uniform waypoints, routed in ~4-point chunks (~200–400 m per call) so no call is long enough to shortcut.

## Goals / Non-Goals

**Goals:** measurable per-stage quality; shape-fidelity routing on an owned graph; routes that are humanly runnable by contract; multi-run workout plans; deterministic offline eval.

**Non-Goals (this change):** payments/limits (Polar, export gate), drag-to-edit UI, canvas draw modality changes, deployment.

## Decisions

### D1: Own the road graph (osmnx → networkx), drop Mapbox Directions for snapping
- Cached OSM extracts per eval fixture area (checked into `backend/eval/fixtures/graphs/` or downloaded once and cached) → **deterministic, offline, free**.
- Custom edge costs are the enabler: `cost = length × (1 + λ_repeat·visits) ± shape terms`. Repeat penalties and loop closure are inexpressible in OSRM/Mapbox request parameters.
- Walk/run network (`network_type="walk"`), not driving — routes are for humans.
- Alternative considered: self-hosted OSRM (fast, but fixed cost function → rejected); public OSRM demo server (rate-limited, non-deterministic, no SLA → eval-hostile → rejected).

### D2: Dense-waypoint short-hop routing (the DrawonMaps technique, graph-native)
- Resample extracted outline to N arc-length-uniform waypoints (start at ~80, tuned by eval).
- Snap each waypoint to nearest graph node; route consecutive pairs with A*/Dijkstra over the custom cost — each hop is short, so shape-destroying detours are geometrically impossible.
- Per-hop distance cap: if the shortest hop exceeds k× the straight-line distance, the area cannot express that stroke — fail fast with a diagnostic instead of returning spaghetti (feeds the area-selection score).

### D3: Eval harness is the gate, not a report
- Fixture set: ~10–15 shapes spanning difficulty (circle, heart, star, letter, animal silhouette, user-submitted failures as they arrive) × 2–3 cached areas (dense grid, irregular European, sparse suburb).
- Stage metrics: extraction (IoU of rasterized extracted path vs. source silhouette), snapping (discrete Fréchet + Hausdorff vs. target polyline, reusing `shape_validator.py` metrics), runnability (loop closure ✓, |distance − target|/target, repeat ratio).
- Runs as `pytest -m eval` offline; thresholds start descriptive (baseline logged), become assertions once the new router lands. CI-friendly because no network.

### D4: Runnability as cost-model constraints, not post-hoc filters
- Loop closure: route start node == end node (close the outline through the graph with the same short-hop technique).
- Distance targeting: scale the shape's geographic radius so predicted route length ≈ target; iterate ≤3× using measured length (route length is monotonic-ish in radius).
- Repeat penalty: multiplicative edge-cost escalation per prior traversal — discourages doubling without forbidding necessary retraces.

### D5: Workout planner composes routes, invents no new routing
- A plan = ordered set of contract-satisfying routes (e.g., Mon 5 km / Wed 8 km / Sat 12 km) sharing a start point (home anchor) and a theme (one shape per run, or one composition segmented across runs).
- Pace/elevation: targets are annotations computed from the graph's elevation data (SRTM via osmnx) and user pace input — planner selects among candidate routes; it does not add routing machinery.
- LLM (Cerebras Gemma 4 31B, per launch decisions) may suggest themes/segmentations; it never draws paths.

## Groundwork (explicitly deferred, recorded so the architecture leaves the door open)

- **Drag-to-edit repair:** the owned graph makes DrawonMaps-style live re-snapping feasible later — expose graph queries (`nearest_node`, `route_between`) behind a small internal API from day one; the future editor re-routes only the dragged hop.
- **Pay-at-export gate:** enforcement requires moving GPX assembly server-side (today client-side in `src/lib/services/gpx.ts`) and degrading preview geometry; decision from 2026-07-17 grill: pay-at-export, Polar, free previews. Build nothing now; keep full-resolution geometry assembly in one backend function so a gate is a wrapper, not a rewrite.

## Risks / Trade-offs

- **osmnx graph build latency** for arbitrary pin-drops (~seconds for a few km²): mitigate with on-disk graph cache keyed by bbox; acceptable for v2 (generation is already seconds-long).
- **Distance-targeting convergence** may oscillate on sparse networks: cap iterations, surface best-effort with the measured distance shown honestly.
- **Fixture bias:** eval shapes we pick may flatter the pipeline; counter by adding every real-world failure as a fixture (regression suite grows from user pain, Mom-Test style).
