# 👻 Ghost Tracks: Functional Geometry Engine

Discover hidden shapes in city streets. A high-performance Strava art route planner that treats city maps as category-theoretic functors.

![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?style=flat-square&logo=svelte&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-WASM_Engine-DEA584?style=flat-square&logo=rust&logoColor=white)
![Python](https://img.shields.io/badge/Python-Computer_Vision-3776AB?style=flat-square&logo=python&logoColor=white)
![Category Theory](https://img.shields.io/badge/Math-Category_Theory-blue?style=flat-square)

## 🌌 The Vision: Art as a Functor
Ghost Tracks isn't just a tracer; it's a bridge between abstract art and real-world geography. We treat the transition from a user-uploaded image to a GPS route as a mathematical pipeline:
**Image (Raster) → Graph (Morphism) → Road Network (Functor) → GPS Route.**

## 🏗️ Architecture
- **Engine (Rust WASM)**: High-performance geometry math using `geo-rust` and `lyon`. Implements **Sheaf Theory** logic to resolve local street constraints against global shape fidelity.
- **Vision (Python)**: Multimodal pipeline using **Gemini 1.5 Pro** for topological extraction, and `vtracer`/`potrace` for raster-to-vector conversion.
- **Gateway (Hono/Bun)**: Sub-ms orchestration and Zod-based validation.
- **Frontend (Svelte 5)**: Interactive map state management via **xstate** and high-fidelity overlays using **Deck.gl** and **D3-geo**.

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
- **Gateway**: `cd server && bun run index.ts` (Port 3000)
- **Intelligence**: `cd backend && ./venv/bin/uvicorn main:app` (Port 8000)
- **Geometry**: `cd native/geometry && cargo build` (WASM via wasm-pack)
- **Frontend**: `bun run dev` (Port 5173)

---

*Built for those who run with purpose and geometry.*
