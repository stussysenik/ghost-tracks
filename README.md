# Ghost Tracks

AI-powered Strava art route planner for Prague. Describe a shape, get a runnable route that traces it through real streets.

## What It Does

Ghost Tracks generates running routes that draw shapes on the map when viewed in Strava or similar GPS apps. It uses AI to interpret shape descriptions, parametric templates to create control points, and the Mapbox Directions API to snap routes to real walkable/runnable streets.

**Two modes:**

- **Generate** -- Pick a Prague neighborhood, get AI-generated shape ideas (e.g. "A Heart Shape", "Letter K", "A Star") with emojis, difficulty ratings, and descriptions. Click one to route it.
- **Describe** -- Type any shape description (e.g. "a cat", "letter M", "a pentagon") and get a validated, street-snapped route with similarity scoring.

**Features:**

- Routes snapped to real streets via Mapbox Directions API
- Shape similarity scoring (blended Modified Hausdorff + Ordered Sampling + Raster IoU)
- Smart neighborhood selection based on street layout compatibility
- Alternative neighborhood suggestions for re-routing
- GPX export for import into Strava, Garmin, etc.
- Turn-by-turn waypoint directions
- "Path only" toggle to see just the route shape without markers
- Session persistence (routes survive page reloads)
- Toast notifications and multi-step progress feedback
- Mobile-responsive with PWA support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | SvelteKit 2 + Svelte 5 (runes) |
| Styling | Tailwind CSS v4 |
| Map | Mapbox GL JS v3 |
| Backend | Python FastAPI |
| AI/LLM | DSPy + ZhipuAI GLM-4-plus |
| Route Snapping | Mapbox Directions API |
| Shape Validation | NumPy + Pillow (algorithmic scoring) |
| Testing | Playwright (E2E) + pytest (backend) |

## Prerequisites

- Node.js 20+
- Python 3.12+
- Mapbox access token
- ZhipuAI API key (for GLM-4-plus)

## Setup

```bash
# Clone
git clone https://github.com/s3nik/strava-art-work-planner.git
cd strava-art-work-planner

# Frontend
npm install

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..

# Environment
cp .env.example .env
# Edit .env with your VITE_MAPBOX_ACCESS_TOKEN, MAPBOX_ACCESS_TOKEN, and GLM_API_KEY
```

## Running

```bash
# Terminal 1: Backend (port 8000)
cd backend
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 2: Frontend (port 5173)
npm run dev
```

Open http://localhost:5173

## Testing

```bash
# Backend tests (50 tests)
cd backend && python -m pytest tests/ -v

# E2E tests (13 tests) -- requires both servers running
npx playwright test
```

## Project Structure

```
strava-art-work-planner/
  backend/
    main.py                          # FastAPI app entry point
    routers/                         # API endpoints (describe, generate)
    services/
      shape_generator.py             # Orchestrates the full pipeline
      shape_templates.py             # Parametric shape definitions (heart, star, etc.)
      street_mapper.py               # Scales, densifies, deduplicates, snaps to streets
      shape_validator.py             # Blended similarity scoring
      neighborhood.py                # Prague neighborhood data + selection
      gpx_service.py                 # GPX file generation
    models/schemas.py                # Pydantic request/response models
    tests/                           # pytest unit tests
  src/
    routes/+page.svelte              # Main page (map + panels)
    lib/components/
      Map.svelte                     # Mapbox GL map with route overlay
      GeneratePanel.svelte           # Neighborhood picker + idea cards
      DescribePanel.svelte           # Text input + progress steps
      RouteInstructions.svelte       # Route details + GPX export
      Toast.svelte                   # Toast notifications
    lib/stores/toasts.svelte.ts      # Toast state management
    lib/types/index.ts               # TypeScript type definitions
    routes/api/                      # SvelteKit API proxies to backend
  tests/e2e/                         # Playwright E2E tests
```

## Acknowledgments

- [Mapbox](https://mapbox.com) for maps and the Directions API
- [OpenStreetMap](https://openstreetmap.org) contributors for map data
- [ZhipuAI](https://zhipuai.cn) for the GLM-4-plus language model
- The Strava art community for inspiration

## License

MIT
