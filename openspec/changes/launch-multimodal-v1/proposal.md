# Proposal: launch-multimodal-v1

## Why

Ghost Tracks has a genuinely working core — text→shape via LLM, street snapping via
Mapbox Directions, a blended Hausdorff/IoU/vision-judge validator with retry, and GPX
export — but it cannot be sold in its current state:

1. **Prague-only.** Area selection is 12 hardcoded bboxes
   (`backend/data/prague_neighborhoods.json`), leaking into the frontend. A
   pay-per-export product needs every runner on Earth addressable.
2. **No image input.** `backend/services/vision.py` is a dead placeholder; the
   README's multimodal pipeline does not exist. Image upload is the marketing moment
   ("upload any drawing, run it").
3. **Three-provider LLM sprawl** (GLM-4-plus, NVIDIA NIM, OpenAI refs) with a
   separate zhipuai SDK path for the GLM-4V judge. Cerebras now serves **Gemma 4 31B**
   (multimodal, ~2,300 tok/s, OpenAI-compatible) — one provider covers text→shape,
   area reasoning, and the vision judge, and makes the validate-retry loop interactive.
4. **No payment path.** Nothing gates GPX export; no way to charge.
5. **Architecture debt that blocks even local dev:** the Hono gateway (port 3000) is
   an orphan — SvelteKit proxies default to it but it lacks `/describe`; the Rust
   WASM crate is a 41-line stub backing a false README claim; no `.env.example`
   exists and the repo has no committed key manifest.
6. **No programmer's handbook.** Pipeline logic (mapping, scoring math, contracts)
   lives only in code and scattered docs.

## What Changes

- **Multi-modal input** (new capability): image upload → deterministic CV
  vectorization (vtracer/skeletonize) → polyline → existing street mapper; SVG file
  upload → path sampling → same pipeline; draw-on-map canvas (sequenced last, may
  slip to v1.1). Gemma vision assists (subject/stroke selection) but never replaces
  the deterministic vectorizer.
- **Global pin-drop area selection** (replaces Prague neighborhoods): geocoding
  search + pin → dynamic bbox sized from target route length → computed street-density
  sanity check.
- **LLM consolidation on Cerebras** (`CEREBRAS_API_KEY`, net-new): Gemma 4 31B for
  text→shape, area reasoning, and vision judging. Delete zhipuai, NIM, and OpenAI
  config paths.
- **Pay-per-export credits**: free unlimited on-map previews; GPX export consumes a
  credit. Polar (merchant-of-record) license-key packs; backend validates/decrements
  via Polar API. No auth system at launch. Export is quality-gated: only
  validator-passing routes are chargeable.
- **Architecture cleanup**: delete `server/` (Hono gateway) — SvelteKit API routes
  are the gateway; delete `native/` (Rust stub); rewrite README to describe the real
  system; commit `.env.example`; `npm run doctor` passes green.
- **Docs handbook**: mdsvex-rendered `/docs` route — pipeline architecture, scoring
  math, API contracts, key manifest.

**Non-goals (deferred):** production deployment (local-first for now; Vercel Hobby
is non-commercial — revisit at payment-gate ship), Strava OAuth upload, user
accounts/saved routes, Rust/WASM (revisit only if canvas live-preview profiling
demands it).

## Impact

- Affected specs (all new): `multimodal-input`, `area-selection`, `llm-inference`,
  `export-monetization`, `docs-handbook`
- Affected code: `backend/services/*` (vision revival, llm.py rewrite, neighborhood
  removal), `src/routes/api/*` (proxy target, upload endpoints, export gate),
  `src/lib/components/*` (input modes, pin-drop UI, canvas), **deleted:** `server/`,
  `native/`, `backend/data/prague_neighborhoods.json` (as core abstraction)
- New external dependencies: Cerebras API (net-new key), Polar account, Mapbox
  Geocoding API (existing token)
- Supersedes the stale `architecture-refactor` change (recommend archiving it)
