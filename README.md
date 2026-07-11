# 👻 Ghost Tracks: Functional Geometry Engine

Discover hidden shapes in city streets. A high-performance Strava art route planner that treats city maps as category-theoretic functors.

![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?style=flat-square&logo=svelte&logoColor=white)
![Python](https://img.shields.io/badge/Python-FastAPI-3776AB?style=flat-square&logo=python&logoColor=white)

## 🌌 The Vision: Art as a Functor
Ghost Tracks isn't just a tracer; it's a bridge between abstract art and real-world geography. We treat the transition from a user-uploaded image to a GPS route as a mathematical pipeline:
**Image (Raster) → Graph (Morphism) → Road Network (Functor) → GPS Route.**

## 🏗️ Architecture
Two deployables:
- **Backend (Python / FastAPI)**: shape generation, street snapping via **Mapbox Directions**, and a blended Hausdorff/IoU/vision-judge validator with retry.
- **Frontend (Svelte 5)**: interactive Mapbox map with `xstate`-driven mode state; SvelteKit API routes proxy the backend and host the export gate.

## 🛠️ Development

### 1. Environment Health Check (The "Doctor")
Ensure your device has all the necessary keys (Mapbox, Gemini, etc.):
```bash
npm run doctor
```

### 2. Secret Management
We recommend **[Doppler](https://www.doppler.com/)** for syncing secrets across your development devices.
```bash
doppler run -- bun run dev
```

### 3. Components
- **Backend**: `cd backend && ./venv/bin/uvicorn main:app --port 8000`
- **Frontend**: `npm run dev` (Port 5173) — proxies `/api/*` to `BACKEND_URL` (default `http://127.0.0.1:8000`)

---

*Built for those who run with purpose and geometry.*
