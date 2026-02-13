# Ghost Tracks - Development Progress

## v1.0 - Initial SvelteKit App

Static data approach with pre-computed routes.

- SvelteKit 2 project with Mapbox GL JS map
- 15 pre-computed Prague shapes stored as static JSON
- Shape categories: creatures (fox, cat, bird, dog, rabbit), letters (P, R, A, G, E), geometric (heart, star, triangle, circle, arrow)
- Route snapping to streets via Mapbox Directions API (batch pre-computed)
- Bottom sheet UI with shape details, distance, difficulty
- GPX export using gpx-builder
- AI suggestions via Claude/GLM/Gemini/Kimi providers
- Shareable links with Open Graph previews
- Distance and category filtering
- Playwright E2E tests
- PWA support with service worker

## v2.0 - Dynamic AI-Powered Generation

Complete architecture rewrite: static JSON replaced with dynamic AI pipeline.

- **Python FastAPI backend** -- new backend service handling all shape generation
- **DSPy + ZhipuAI GLM-4-plus** -- LLM interprets shape descriptions, generates ideas
- **Parametric shape templates** -- mathematical definitions for heart, star, circle, triangle, arrow, square, and all 26 letters
- **Street mapping pipeline** -- scale to neighborhood bbox, densify waypoints, deduplicate, snap to streets via Mapbox Directions API
- **Hausdorff distance validation** -- scores how well the street route matches intended shape
- **Prague neighborhood system** -- 12 neighborhoods with metadata (center, bbox, street layout, shape compatibility tags)
- **Two UI modes**: Generate (neighborhood picker + AI idea cards) and Describe (free-text input)
- **SvelteKit API proxy layer** -- frontend proxies to Python backend
- **50 pytest backend tests** + **13 Playwright E2E tests**
- Removed: static JSON data, old AI service, old shape/filter components, shareable link pages

## v2.1 - Shape Quality + UX Refinement

Major improvements to shape accuracy (67% to 87%+) and user experience.

### Shape Similarity Improvements

- **Higher template density**: Heart 25->64 pts, Star 11->21, Circle 21->48, Triangle 4->16, Arrow 7->14, Square 5->17
- **Reduced street mapping distortion**: Densify 200m->80m, dedup 30m->12m
- **Curvature-aware deduplication**: Preserves points where bearing changes >20 degrees
- **Blended 3-component scoring** replacing single Hausdorff:
  - 55% Modified Hausdorff (90th percentile, robust to outliers)
  - 35% Ordered Sampling (mean distance between 50 resampled pairs)
  - 10% Raster IoU (pixel intersection-over-union)
- **Deviation-targeted tightening**: Retries add control points only where route deviates most
- **Fixed validation bug**: Was comparing raw template vs routed coords (different geographic positions); now compares scaled waypoints vs routed

### Neighborhood Selection Fix

- **Fixed keyword matching**: `"hearts" in "a heart shape"` is `False` in Python; added `_normalize_shape_term()` to strip plurals and noise words
- **Layout preference map**: heart->mixed, star->grid, circle->mixed, etc.
- **Hash-based tiebreaker**: Eliminates list-order bias (was always picking Stare Mesto)
- **Neighborhood passthrough**: Users can specify preferred neighborhood
- **Alternative neighborhoods**: Top 3 alternatives returned for re-routing

### Frontend UX Overhaul

- Toast notifications (info/success/error/warning) with auto-dismiss
- 4-step progress indicator for describe mode
- Skeleton loaders during generate mode
- Alternative neighborhood chips ("Try in: Smichov, Zizkov, Nove Mesto")
- "Path only" toggle to hide markers and see just the route shape
- Session persistence via sessionStorage
- Similarity-based toasts (85%+: success, 50-84%: info, <50%: warning)
- Better API error handling (timeout 504 vs connection 502)
- Fly transitions for panel animations

### Shape Scores (v2.1)

| Shape | Score |
|-------|-------|
| Heart | 87% |
| Star | 88% |
| Circle | 87% |
| Triangle | 81% |
| Square | 78% |

All 50 backend tests + 13 E2E tests passing.
