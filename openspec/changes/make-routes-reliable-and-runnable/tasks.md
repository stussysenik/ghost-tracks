# Tasks — Make Routes Reliable and Runnable

## 1. Eval harness (truth first)

- [x] 1.1 Create `backend/eval/` with fixture manifest: 12 deterministic shapes (parametric templates + letters) across 3 pinned areas spanning difficulty tiers (`eval/fixtures.py`). NOTE: OSM walk-network extract *caching* deferred to Task 2 (`road_graph.py`), its first consumer — the Mapbox baseline and all metrics need no graph; the 3 area bboxes (dense grid / irregular / sparse) are pinned here so Task 2 keys off them.
- [x] 1.2 Implement stage metrics module reusing `shape_validator.py`: extraction IoU, snap fidelity (discrete Fréchet + Hausdorff + modified Hausdorff), runnability (loop ✓, distance error, repeat ratio) — `eval/metrics.py`, 12 unit tests in `tests/test_eval_metrics.py`
- [x] 1.3 Wire `pytest -m eval` runner producing a per-stage scoreboard (JSON + readable table), fully offline — `eval/scoreboard.py`, `tests/test_eval.py`, marker registered + deselected by default in `pyproject.toml`
- [x] 1.4 Record the baseline scoreboard for the current Mapbox pipeline (committed cassettes in `eval/fixtures/recorded/`, replayed offline) and commit `eval/scoreboard.json`. **Dominant failure mode named empirically: runnability (health 0.08), NOT snapping (0.86) or extraction (1.0)** — only 8% of routes within ±10% distance, mean distance error 158%, loop closure 58%, repeat ratio 66%.

## 2. Owned road graph

- [x] 2.1 Add `backend/services/road_graph.py`: osmnx walk-network load with on-disk cache keyed by bbox (rounded-bbox hash → GraphML; `allow_download=False` fails closed offline); `nearest_node`, `node_coord`, `route_between` internal API (groundwork for the Task 3 router + future drag-edit). One online step `eval/build_graphs.py` (graph analogue of `record_baseline.py`) materialized the 3 pinned extracts into `eval/fixtures/graphs/` (committed): eixample 3880n/12190e, prague 2879n/7878e, scottsdale 1742n/5276e — node density tracks the tier.
- [x] 2.2 Unit tests for graph cache determinism and nearest-node snapping on a fixture extract — `tests/test_road_graph.py` (8 tests, fully offline via committed extracts): cache-key stability, offline fail-closed, structural determinism across loads, nearest-node snapping within-bbox/<200 m, self-snap, `route_between` ≥ crow-flies.

## 3. Shape-fidelity routing

- [ ] 3.1 Arc-length-uniform waypoint resampling (~80, configurable) of extracted outlines
- [ ] 3.2 Short-hop router: consecutive-pair A* over custom edge cost; per-hop distance cap with fail-fast diagnostic when the area cannot express a stroke
- [ ] 3.3 Replace Mapbox Directions call in generation flow (`street_mapper.py` → `road_graph`); delete dead Mapbox snapping code
- [ ] 3.4 Eval gate: snap-fidelity scores beat the recorded Mapbox baseline on the fixture set; commit new scoreboard

## 4. Runnable route contract

- [ ] 4.1 Loop closure through the graph (start node == end node) as a router post-pass
- [ ] 4.2 Distance targeting: radius scaling with ≤3 measured-length iterations to hit target ±10%; honest surfacing when best-effort
- [ ] 4.3 Repeat-penalty edge costs; repeat ratio reported per route
- [ ] 4.4 Frontend: target-distance control + contract badges (loop ✓, distance, repeats) on the route panel
- [ ] 4.5 Eval gate: 100% loop closure on fixtures; ≥80% of fixtures within distance ±10%; scoreboard committed

## 5. Workout planner

- [ ] 5.1 Plan model + API: ordered runs with per-run distance and elevation/pace targets, shared start anchor, theme (shape-per-run or segmented composition)
- [ ] 5.2 Elevation annotations from graph elevation data; pace targets from user input
- [ ] 5.3 Planner UI: week view, per-run route cards, GPX export per run (client-side, unchanged for now)
- [ ] 5.4 Unit tests: plan validation (contract holds per run), segmentation coverage of the composition
- [ ] 5.5 Optional LLM theme suggestions via existing Cerebras path (never draws paths); behind a flag

## 6. Close-out

- [ ] 6.1 Full eval + `pytest` + frontend `check` green; README/docs updated (Mapbox Directions removal, eval usage)
- [ ] 6.2 Mark superseded snapping/validator tasks in `launch-multimodal-v1` and note the supersession in its tasks.md
