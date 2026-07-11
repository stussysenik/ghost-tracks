# Tasks: launch-multimodal-v1

## 1. Foundation cleanup (unblocks everything; local dev must work first)

- [x] 1.1 Delete `server/` (Hono gateway); point SvelteKit proxies' `BACKEND_URL`
      default at `http://127.0.0.1:8000`; verify Generate + Describe work end-to-end
      locally (Playwright specs pass)
- [x] 1.2 Delete `native/` (Rust stub); remove Rust/WASM claims from README; remove
      `cassowary` from `package.json` if unused
- [x] 1.3 Commit `.env.example` with the real key manifest (`CEREBRAS_API_KEY`,
      `MAPBOX_ACCESS_TOKEN`, `VITE_MAPBOX_ACCESS_TOKEN`, `BACKEND_URL`,
      `POLAR_ACCESS_TOKEN`); fix `scripts/orchestrator.rb` REQUIRED_KEYS to match;
      `npm run doctor` passes green
      <!-- code-complete: .env.example + orchestrator fixed; doctor now scans
           os.environ (was blind to backend keys) & ignores CI noise. "Green"
           needs a real .env — GLM/NIM/OPENAI drop from discovery after task 2. -->
- [x] 1.4 Add GitHub Actions CI: oxlint + `tsc --noEmit` + backend pytest on push
      <!-- .github/workflows/ci.yml: frontend job (oxlint+svelte-check) verified
           green locally; backend pytest job green after 2.3 adds LLM mocks. -->


## 2. LLM consolidation (prerequisite for judge + multimodal assist)

- [x] 2.1 Obtain `CEREBRAS_API_KEY`; re-point DSPy in `backend/services/llm.py` to
      Cerebras Gemma 4 31B (OpenAI-compatible base_url); delete NIM/OpenAI paths
      <!-- model id verified live: `gemma-4-31b` @ https://api.cerebras.ai/v1.
           Also rewired routers/generate.py off the dummy LangGraph stub onto the
           real ShapeGenerator; deleted services/intelligence.py + langgraph dep. -->
- [x] 2.2 Replace GLM-4V judge call in `shape_validator.py` with Gemma 4 31B vision
      via OpenAI client; remove `zhipuai` dependency
- [x] 2.3 Backend tests green with mocked LLM; one recorded-fixture integration test
      for text→shape and judge round-trip
      <!-- conftest blanks LLM keys → 55 hermetic tests deterministic (CI-safe);
           test_llm.py: mocked-LLM path test + 2 live round-trips (skip w/o key).
           Verified: 57 passed (incl. 2 live Cerebras) in 64s. -->


## 3. Global area selection (removes Prague lock)

- [x] 3.1 Backend: accept arbitrary bbox in generate/describe requests; bbox sized
      from target route length; remove `prague_neighborhoods.json` as required input
      <!-- Area model + area_from_center (bbox sized L*0.35); generate/describe take
           `center`; neighborhoods demoted to optional featured seed. Verified live:
           Amsterdam pin → LLM ideas positioned in-bbox. -->
- [x] 3.2 Street-density sanity check for a candidate bbox (Overpass or Mapbox
      tilequery) with clear "too sparse, try a denser area" error
      <!-- services/area.py Overpass way-count + POST /area/check; UA header (fixes
           406) + mirror fallback; fail-open on outage. Verified: Amsterdam 2415 ways
           ok, SF 7430; sparse→reject unit-tested. -->
- [x] 3.3 Frontend: geocoding search + pin-drop replaces NeighborhoodPicker; map
      flies to chosen area; existing modes work anywhere (verify: SF, Berlin, Prague)
      <!-- Shared area store (area.svelte.ts) is the single source: AreaPicker
           (geocoding search) + map click-to-drop both write it; density gate via
           /api/area/check refuses too-sparse pins before LLM spend. Both modes send
           `center`. Fixed a live bug: idea→route (+page handleIdeaSelected) dropped
           the center → auto-selected Prague. Live-verified: SF pin (3,419 streets)
           → SF ideas; Berlin search → generate → route "Mitte Metro Heart" 85% match
           on real Berlin streets (was 10% in Letná before the fix); map-click →
           reverse-geocoded Prague address. Also removed the broken cassowary
           ConstraintLayout demo that was 500-ing the page. -->
- [x] 3.4 Update Playwright specs for pin-drop flow
      <!-- map.spec: area-search/pin-drop UI + live geocoding→density→unlock (6 green).
           area.spec: /api/area/check bbox+density. generate/describe specs now assert
           control points & routed coords land at a Berlin pin, not Prague. Green;
           generate.spec bumped to 120s for Cerebras latency. -->

## 4. Multi-modal input

- [ ] 4.1 Image upload endpoint: raster → vtracer/skeletonize → principal polyline →
      existing `StreetMapper` pipeline; unit tests on `images-reference/` samples
- [ ] 4.2 Gemma vision assist: subject identification + stroke selection for
      multi-stroke extractions; unsuitable-image warning
- [ ] 4.3 SVG upload: parse + arc-length sample paths (svgpathtools) → same pipeline
- [ ] 4.4 Frontend: upload UI (drag-drop, preview of extracted shape before snapping)
      integrated into mode switcher
- [ ] 4.5 Canvas draw mode: freehand on map → simplify (existing Douglas-Peucker) →
      snap → preview. Sequenced last; may ship as v1.1 without blocking launch

## 5. Export monetization

- [ ] 5.1 Polar account + product setup (credit packs); sandbox keys in `.env.example`
- [ ] 5.2 Credits service in SvelteKit server routes: license-key validate/decrement
      via Polar API; free-tier N exports via signed session cookie
- [ ] 5.3 Gate GPX download behind credit check; export allowed only when validator
      score ≥ threshold (never charge for a failing route)
- [ ] 5.4 Checkout + key-entry UI; per-session generation rate limit on preview
- [ ] 5.5 E2E: preview free → export decrements → exhausted key blocks with buy CTA

## 6. Docs handbook + launch pass

- [ ] 6.1 mdsvex setup; `/docs` route rendering handbook pages
- [ ] 6.2 Handbook content: pipeline architecture, scoring math + thresholds, API
      contracts, env-key manifest, modality guides
- [ ] 6.3 Rewrite README to describe the real system (no sheaf-theory/Gemini claims)
- [ ] 6.4 Archive stale `architecture-refactor` change
- [ ] 6.5 Full local launch checklist: doctor green, CI green, Playwright green,
      pytest green, one paid-path dry run with Polar sandbox

Dependencies: 1 → 2 → (3 ∥ 4) → 5 → 6. Within 4: 4.1 → 4.2/4.3/4.4 → 4.5.
Parallelizable: 3 and 4 are independent once 2 lands; 6.1–6.2 can start anytime.
