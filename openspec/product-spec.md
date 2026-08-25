# Ghost Tracks — Product Specification (haxe experiment)

> **Experimental repository.** Built using the haxe methodology: openspec-driven, atomic,
> two-deployable, LLM-assisted deterministic CV. This document defines the full product
> — what it is, how it works, and where it's going.

---

## 1. Product Vision

### 1.1 Elevator Pitch

Ghost Tracks is a **functional geometry engine** that turns words, images, and doodles into
GPS routes that form recognizable shapes on city streets. You describe what you want to run
("a heart in Paris", "letter M", upload a sketch of a fox") — it returns a turn-by-turn
route snapped to real roads, ready to export as GPX and import into Strava/Garmin/Komoot.

### 1.2 Core Loop

```
Describe/Upload → Shape Extraction → Street Mapping → Validator → Export GPX
```

The user never waits for the algorithm. The pipeline is:

1. **Input**: text description, image upload, SVG file, or freehand canvas drawing
2. **Extraction**: deterministic CV (vtracer/skeletonize) produces a polyline control path
3. **Mapping**: control points → scale to bbox → densify (80m max) → deduplicate (12m min,
   curvature-aware) → snap via Mapbox Directions API
4. **Validation**: blended 3-component score — Modified Hausdorff (55%), Ordered Sampling
   (35%), Raster IoU (10%) — with deviation-targeted retry (up to 2 iterations)
5. **Export**: GPX file download (free preview, quality-gated paid export)

### 1.3 Target Users

- **Strava artists** who already run/bike GPS art and want to discover or design new routes
- **Travel runners** who want a playful route in a new city
- **Social creators** who want shareable content (Instagram, TikTok, Strava)

### 1.4 Product Principles

| Principle | Meaning |
|-----------|---------|
| **Deterministic CV > AI** | The LLM assists (subject identification, stroke selection) but never draws the path |
| **Stateless by default** | No database. No auth. No user accounts. Routes are ephemeral — generate, export, done |
| **Quality-gated monetization** | Free on-map previews. GPX export costs a credit. Never charge for a failing route |
| **Global from day one** | Any pin on the globe. No city lock-in. Density sanity check prevents wasted generation |
| **Two deployables, one gateway** | SvelteKit is the user-facing gateway. FastAPI is the geometry backend. No third runtime |

---

## 2. Architecture

### 2.1 Topology

```
Browser (SvelteKit SSR)
  │
  ├── /api/describe  ──►  SvelteKit proxy  ──►  FastAPI :8000/describe
  ├── /api/generate  ──►  SvelteKit proxy  ──►  FastAPI :8000/generate
  ├── /api/route     ──►  Mapbox Directions (direct)
  ├── /api/area/check──►  FastAPI :8000/area/check (Overpass density)
  └── /api/export    ──►  Polar API (license key validation + decrement)
```

**SvelteKit (port 5173)**
- SSR + client hydration
- Mapbox GL JS map rendering
- xstate v5 state machines for generation workflow
- API proxy layer + export gate
- PWA service worker (static + Mapbox tile caching)

**FastAPI (port 8000)**
- DSPy + Cerebras Gemma 4 31B (text→shape, area reasoning, vision judge)
- Parametric template fallback (6 shapes + 26 letters)
- CV extraction pipeline (vtracer → skeletonize → principal polyline)
- Street mapper (scale → densify → deduplicate → Mapbox Directions snap)
- Blended 3-component validator with retry logic

### 2.2 Shape Generation Pipeline

```
Input
  │
  ├── Text ──► DSPy (Cerebras) interprets description
  │            └── Falls back to parametric template if LLM fails
  │
  ├── Image ──► vtracer vectorization → skeletonize → principal polyline
  │            └── Gemma vision assists: subject ID, stroke selection
  │
  ├── SVG  ───► Parse paths → arc-length sample → polyline
  │
  └── Canvas ─► Douglas-Peucker simplify → polyline
                     │
                     v
              Control Point Generation
                     │
                     v
              Street Mapping Pipeline
                1. Scale control points to bbox
                2. Densify (80m max spacing)
                3. Deduplicate (12m min, curvature-aware)
                4. Snap via Mapbox Directions API
                     │
                     v
              Blended Validator (3-component)
                ├── Modified Hausdorff (55%) — 90th percentile
                ├── Ordered Sampling (35%) — 50 resampled pairs
                └── Raster IoU (10%) — 128x128 grid
                     │
                     v
              Pass? ──yes──► GPX Export
               │
               no
               │
               v
          Retry (max 2):
          Insert control points at
          worst 50% of deviating segments
               │
               v
          Final route (pass or fail)
```

### 2.3 Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Svelte 5 (runes) + SvelteKit 2, Mapbox GL JS v3, xstate v5, Tailwind v4 |
| **Backend** | Python 3.12+ FastAPI, DSPy, numpy, Pillow, Shapely, opencv-python-headless, vtracer |
| **LLM** | Cerebras Gemma 4 31B (OpenAI-compatible) — text→shape, area reasoning, vision judge |
| **Map** | Mapbox GL JS (rendering) + Directions API (snapping) + Geocoding API (search) |
| **Payments** | Polar (merchant-of-record, license keys) |
| **Export** | GPX (gpx-builder) |
| **CI** | GitHub Actions — oxlint + svelte-check + pytest + Playwright |
| **Deploy** | Vercel (SvelteKit), Fly.io/Railway (FastAPI) |

---

## 3. Current State

### 3.1 Shipped (v2.1)

- [x] Text→shape generation via DSPy + Cerebras (parametric template fallback)
- [x] 6 parametric shapes (heart, star, circle, triangle, arrow, square) + 26 letters
- [x] Global area selection (geocoding search + pin-drop, dynamic bbox sizing)
- [x] Overpass-based street density gate
- [x] Street mapping pipeline (scale → densify → deduplicate → Mapbox Directions snap)
- [x] Blended 3-component validator (Hausdorff + Ordered Sampling + Raster IoU)
- [x] Deviation-targeted retry (up to 2 iterations, worst-50% segment splitting)
- [x] GPX export (gpx-builder)
- [x] Route waypoint extraction (bearing-change detection)
- [x] PWA support (service worker, Mapbox tile caching)
- [x] Toast notification system (info/success/error/warning)
- [x] Session persistence (sessionStorage)
- [x] 50+ pytest (hermetic, CI-safe with mocked LLM)
- [x] 13 Playwright E2E tests (map, generate, describe, area flows)
- [x] CI pipeline (oxlint + svelte-check + pytest)

### 3.2 In Progress (launch-multimodal-v1, ~70%)

- [ ] Image upload → vtracer → skeletonize → polyline → street mapper (4.1)
- [ ] Gemma vision assist for multi-stroke extraction (4.2)
- [ ] SVG upload → arc-length sampling → street mapper (4.3)
- [ ] Upload UI with drag-drop + shape preview (4.4)
- [ ] Canvas freehand draw → Douglas-Peucker → snap (4.5)
- [ ] Polar account + license key infrastructure (5.1-5.2)
- [ ] GPX export gate with credit check (5.3)
- [ ] Checkout UI + key entry (5.4)
- [ ] Monetization E2E tests (5.5)
- [ ] mdsvex docs route + handbook content (6.1-6.2)
- [ ] README rewrite to match real system (6.3)
- [ ] Archive stale architecture-refactor change (6.4)
- [ ] Full launch checklist: doctor + CI + Playwright + pytest + paid dry run (6.5)

### 3.3 Future (post-launch)

- [ ] Multi-stroke / multi-segment routes (complex art: tiger-grade)
- [ ] Strava OAuth integration (auto-upload planned routes)
- [ ] User accounts + saved routes gallery
- [ ] Paretoid engine mode: "find me a shape in this area" (pre-indexed street graph matching)
- [ ] Turn-by-turn directions (not just "follow the line")
- [ ] Route difficulty classification (avoid highways, prefer parks)
- [ ] Shareable route links with embedded preview images

---

## 4. API Contracts

### POST /api/generate

Generate shape ideas for an area.

```
Request:
{
  "center": {"lat": 50.088, "lng": 14.421},
  "route_length_km": 7.0,
  "count": 3
}

Response:
{
  "ideas": [
    {
      "id": "heart-vinohrady",
      "name": "Heart in Vinohrady",
      "emoji": "❤️",
      "distance_km": 6.8,
      "difficulty": "moderate",
      "control_points": [[14.42, 50.08], ...],
      "bbox": [14.41, 50.07, 14.43, 50.09]
    }
  ]
}
```

### POST /api/describe

Describe a shape and get a route.

```
Request:
{
  "center": {"lat": 50.088, "lng": 14.421},
  "description": "a cat stretching",
  "route_length_km": 8.0
}

Response:
{
  "id": "cat-stretching-1",
  "name": "Stretching Cat",
  "control_points": [[14.42, 50.08], ...],
  "routed_points": [[14.4201, 50.0801], ...],
  "distance_km": 8.2,
  "waypoints": [
    {"lat": 14.4201, "lng": 50.0801, "instruction": "Turn left onto Karlova"},
    ...
  ],
  "validation": {
    "score": 0.82,
    "hausdorff": 0.85,
    "ordered_sampling": 0.78,
    "raster_iou": 0.88,
    "passed": true
  }
}
```

### POST /api/area/check

Check if an area is dense enough for shape generation.

```
Request:
{
  "center": {"lat": 50.088, "lng": 14.421},
  "route_length_km": 7.0
}

Response:
{
  "bbox": [14.41, 50.07, 14.43, 50.09],
  "street_count": 2415,
  "density_ok": true,
  "message": null
}
```

### POST /api/export

Validate license key and serve GPX download.

```
Request:
{
  "route_id": "cat-stretching-1",
  "license_key": "polar-xxx-yyy" // optional
}

Response:
{
  "gpx": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>...",
  "credits_remaining": 4 // if license_key provided
}
```

---

## 5. Validation Math

### Blended Score

```
final_score = 0.55 * hausdorff + 0.35 * ordered_sampling + 0.10 * raster_iou
```

| Component | Weight | Method | Threshold |
|-----------|--------|--------|-----------|
| **Modified Hausdorff** | 55% | 90th percentile of control-point-to-routed distances | ≥ 0.70 |
| **Ordered Sampling** | 35% | 50 resampled point pairs, proportional distance | ≥ 0.60 |
| **Raster IoU** | 10% | 128x128 raster grid intersection-over-union | ≥ 0.50 |

**Pass condition:** `final_score ≥ 0.65` OR `hausdorff ≥ 0.80` (dominant component override).

### Retry Strategy

When validation fails:
1. Identify the worst 50% of segments (highest deviation from control points)
2. Insert a control point at the midpoint of each failing segment
3. Re-run the street mapper pipeline (scale → densify → deduplicate → snap)
4. Re-validate
5. Max 2 retries. After that, return the best attempt regardless of score.

---

## 6. Monetization

### Model

| Action | Cost |
|--------|------|
| On-map preview (generate → browse ideas) | Free, unlimited |
| Route detail view + map preview | Free, unlimited |
| GPX export | 1 credit |
| Failed route (validator score < threshold) | Free (not charged) |

### Credit System

- **License keys**: Polar-issued credit packs (e.g., 10 exports / $5)
- **Free tier**: N exports per session tracked via signed cookie (best-effort, no auth)
- **Validation**: SvelteKit server route calls Polar API to validate + decrement
- **Quality gate**: Export button only works when validator score ≥ threshold

### Why Polar (not Stripe)

- Merchant-of-record: Polar handles EU VAT, US sales tax globally
- No user DB needed: license keys are the identity primitive
- Sandbox mode for development: `POLAR_ACCESS_TOKEN` in `.env`
- Migration path: credits logic lives behind one service module — swap to Stripe + accounts later

---

## 7. UI States & Flows

### Main Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Generate** | Default on load | Shows area picker → generate ideas → browse cards → preview on map |
| **Describe** | Tab switch | Text input → submit → 4-step progress → route preview → export |
| **Upload** | Tab switch (post-launch) | Drag-drop image/SVG → preview extracted shape → snap → export |
| **Canvas** | Tab switch (v1.1) | Freehand draw on map → simplify → snap → export |

### State Machine (xstate v5)

```
IDLE → AREA_PICKING → GENERATING → VALIDATING → READY → EXPORTING
                        ↑              |                     |
                        └── RETRY ──────┘                     └── DONE
```

Each transition emits:
- Loading skeleton (GeneratePanel)
- Progress steps (DescribePanel — interpretation → area → mapping → validation)
- Toast notifications on errors

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| < 640px | Full-screen map, bottom sheet cards |
| 640-1024px | Split: map 60% / panel 40% |
| > 1024px | Split with sidebar history |

---

## 8. Experimental Boundaries

This repo is for building and testing. Some things are explicitly **in** and **out** of scope
for the experimental phase:

### In scope
- Proving the text/image→route pipeline works globally
- Finding the right validator thresholds through real use
- Testing Polar as a zero-auth payment model
- Iterating on the UI flow (what do users actually do?)
- Adding multi-stroke support incrementally

### Not in scope (yet)
- Production deployment (Vercel Hobby is enough for now)
- Strava OAuth integration (adds auth complexity with no product proof)
- User accounts, saved routes, leaderboards (prove the core loop first)
- Mobile app (PWA covers it)
- Real-time turn-by-turn navigation (GPX import handles it)
- Pareidolia engine (pre-indexed street graph matching — needs traction to justify compute)

---

## 9. Key Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Gemma 4 31B preview instability (rate limits, reshuffles) | Medium | DSPy abstraction keeps provider swap to config change. GLM-5.1 on Modal as manual fallback |
| CV extraction quality variance on photos vs line art | High | UI guides toward high-contrast drawings. Gemma vision pre-check warns on unsuitable images |
| Mapbox cost exposure on free previews | Low | Per-session generation rate limit. Directions free tier (100k req/mo) ample pre-traction |
| Complex multi-stroke art produces poor routes | Medium | v1 targets single-continuous-stroke fidelity. Multi-stroke is explicit non-goal for validator gate |
| Polar API availability/breaking changes | Low | Credits logic behind one service module. Can swap to Stripe + accounts later |
| Low user traction / no product-market fit | Medium | No DB, no auth, no infrastructure cost. Experiment cost is just API bills |

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **Control point** | A point in the ideal shape (user's drawn/intended path), not yet snapped to streets |
| **Routed point** | A point on the actual street network after Mapbox Directions snapping |
| **Bbox** | Bounding box — the geographic rectangle defining the generation area |
| **Density gate** | Street network sanity check before LLM spend (Overpass way count) |
| **Parametric template** | A hardcoded mathematical shape (heart, star, letter) used as fallback when LLM fails |
| **Modified Hausdorff** | Shape similarity metric — 90th percentile of point-to-line distances |
| **Ordered Sampling** | Proportional-distance resampling for ordered point comparison |
| **Raster IoU** | Intersection-over-union of two shapes rasterized to a 128x128 grid |
| **MoR** | Merchant of Record — handles tax compliance (Polar's role) |
| **GPX** | GPS Exchange Format — XML file format for GPS routes/tracks |
