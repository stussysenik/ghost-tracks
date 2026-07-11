# Design: launch-multimodal-v1

## Context

Decisions below were resolved in a design interview (2026-07-10). The system spans
four runtimes today (SvelteKit, Hono/Bun, FastAPI, Rust/WASM); this change collapses
it to two (SvelteKit + FastAPI) and adds payment and multi-modal surfaces.

## Decisions

### D1 — Topology: two deployables, SvelteKit is the gateway
Kill the Hono gateway (`server/`). It exposes only `/health` + `/api/generate`, yet
SvelteKit proxies default to it — `/describe` 404s. SvelteKit API routes already do
validation/proxying and will host the export gate and rate limiting.
`BACKEND_URL` points directly at FastAPI (default `http://127.0.0.1:8000`).
**Alternative rejected:** finishing the gateway — a third deployable with no unique
responsibility.

### D2 — No Rust kernel
Generation latency is network-bound (Mapbox + LLM round-trips), not compute-bound.
Validator math (Hausdorff, resampling, IoU) runs over ~10² route points; numpy does
this in milliseconds. Delete `native/`; strip the README claim. Revisit only if
canvas live snap-preview profiles poorly in JS (unlikely at these point counts).

### D3 — Extraction is deterministic CV; the LLM assists
Image → route uses `vtracer`/skeletonization (OpenCV, already in requirements) to
produce polylines: deterministic, free, testable. Gemma 4 31B (vision) is used for
(a) subject identification / principal-stroke selection when an image yields many
strokes, and (b) the existing judge role (replacing GLM-4V). The LLM never draws the
path. This keeps per-generation cost near zero and failure modes debuggable.

### D4 — Single LLM provider: Cerebras Gemma 4 31B
One OpenAI-compatible endpoint for all three roles (text→shape, area reasoning,
vision judge). DSPy re-points via `api_base`; the zhipuai SDK path in
`shape_validator.py` is replaced with an OpenAI-client vision call. Risk accepted
with eyes open: Gemma 4 31B is in public preview — rate limits/reshuffles are
possible; the DSPy abstraction keeps a provider swap to a config change.
`GLM_MODAL_KEY` (GLM-5.1 on Modal) exists as a manual fallback if Cerebras breaks.

### D5 — Area selection is computed, not curated
Pin/geocode → bbox sized from target route length (route_km → bbox diagonal
heuristic) → density check = count of routable ways in bbox (cheap Overpass query or
Mapbox tilequery); reject/expand sparse areas with user feedback. Deletes
`prague_neighborhoods.json` as the core abstraction (may survive as optional
"featured areas" seed data).

### D6 — Payments: Polar MoR license keys, no auth
Buy pack → license key emailed → paste in app → SvelteKit export route validates +
decrements via Polar API server-side. Zero user DB, zero EU VAT filings (MoR).
Export is the only paid action and is **quality-gated**: a route must pass the
validator threshold before it can consume a credit — never charge for a bad route.
Free tier: N free exports tracked per license-less session (signed cookie), best
effort. Migration path to Stripe + real accounts stays open (credits logic lives
behind one service module).

### D7 — Canvas mode is sequenced last
Freehand draw → Douglas-Peucker simplify (exists in `routing.ts`) → same snap
pipeline. Pure frontend; no AI cost. Explicitly allowed to slip to v1.1 without
blocking launch.

### D8 — Docs: mdsvex handbook in-app
`/docs` route rendering `docs/*.svx` — pipeline architecture, scoring math
(Hausdorff blend weights, thresholds), API contracts, env-key manifest. mdsvex is
the MDX-equivalent native to the Svelte stack.

## Risks

- **Gemma 4 31B preview instability** → mitigations in D4.
- **CV extraction quality variance** on photos (vs clean line art) → UI guides users
  toward high-contrast drawings; Gemma vision pre-check can warn on unsuitable images.
- **Mapbox cost exposure on free previews** → per-session generation rate limit at
  the SvelteKit layer; Directions free tier (100k req/mo) is ample pre-traction.
- **Complex multi-stroke art (tiger-grade)** requires multi-segment routes; v1
  targets single-continuous-stroke fidelity (heart/star/animal outline grade),
  multi-stroke is explicitly out of scope for the validator gate.
