# Make Routes Reliable and Runnable

## Why

Ghost Tracks generates GPS art, but generation is not reliable for arbitrary shapes — users retry and get spaghetti, and nothing measures where the pipeline fails (extraction, snapping, or runnability). The 64 passing unit tests prove mechanics, not outcomes. Monetization (pay-at-export, Polar) is deliberately deferred until the product is dependable; this change is the bet that reliability + human-runnable routes is the right thing to build first.

Mom-Test framing — the observable user problems, not feature wishes:
- "I uploaded a heart and got a tangle that looks nothing like it." (fidelity)
- "The route was 43 km and didn't end where it started — I can't actually run this." (runnability)
- "I regenerated 8 times hoping for a better one." (no measurable quality, no control)
- "I want my week of runs to add up to something." (workout planning as art — the arts × sports thesis)

Studied technique (reference asset: DrawonMaps, shahnab.github.io/DrawonMaps): extraction is purely algorithmic (Canny → RDP → ~80 uniform arc-length waypoints); shape fidelity through snapping is achieved by **dense waypoint chunked routing** (~4-point chunks, step 3, ~200–400 m per routing call, parallel) so the router cannot shortcut, plus OSRM map-matching (`tidy=true`) — all on free OSM infrastructure. This change adopts that technique on a backend-owned OSM graph, which additionally enables custom edge costs (repeat penalties, loop closure) and offline deterministic evaluation.

## What Changes

1. **Generation eval harness** (`generation-eval`, first deliverable): per-stage benchmark over a fixture set of shapes — extraction fidelity, snap fidelity (Hausdorff/IoU vs. target geometry), runnability score — running offline against cached OSM extracts, deterministic, in CI. The harness names the dominant failure mode empirically and gates every subsequent task.
2. **Shape-fidelity routing** (`shape-routing`): replace Mapbox Directions A→B snapping with an owned OSM road graph (osmnx/networkx, cached extracts) routed via the dense-waypoint short-hop technique with shape-fidelity edge costs.
3. **Runnable route contract** (`runnable-route-contract`): every exported route is a closed loop, hits a user-set target distance (±10%), and penalizes repeated street segments — enforced by the router's cost model and scored by the eval.
4. **Workout planner** (`workout-planner`): multi-run plans on top of the contract — a series of routes across a week forming a theme/composition, with per-run distance and elevation/pace targets. Sequenced last; depends on the contract holding.
5. **Groundwork notes only** (design.md): DrawonMaps-style drag-to-edit repair of generated routes, and the future pay-at-export gate (server-side export required — GPX is currently built client-side in `src/lib/services/gpx.ts`). **No payment code, no limits, in this change.**

## Impact

- Affected specs: `generation-eval`, `shape-routing`, `runnable-route-contract`, `workout-planner` (all new capabilities; `openspec/specs/` is currently empty).
- Affected code: `backend/services/street_mapper.py` (replaced), `backend/services/shape_generator.py`, `backend/services/shape_validator.py` (metrics reused by eval), new `backend/services/road_graph.py`, new `backend/eval/`, `backend/routers/generate.py`, frontend distance/plan controls.
- Removed dependency: Mapbox Directions for snapping (Mapbox GL remains for map rendering).
- Relationship to `launch-multimodal-v1` (11/26 tasks): its remaining snapping/validator tasks are superseded by this change; modalities and Cerebras decisions are untouched.
