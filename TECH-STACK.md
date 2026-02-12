PROMPT:
Summarize the entire tech stack, system architecture, code architecture and what toolings and things need to be setup to enable this!

RESPONSE:
The **Strava-Art-Work-Planner** is an MVP web application designed for high performance, ease of use, and instant discovery of run/ride art. The architecture prioritizes pre-computation (O(1) lookups) over real-time algorithms to handle traffic scaling effortlessly.

### 1. Technology Stack ("Elite Minimalism")

| Component | Choice | Justification |
| :--- | :--- | :--- |
| **Frontend Framework** | **SvelteKit** (TypeScript) | Compiler-based for tiny bundles (<50kb), SSR for instant first load, excellent DX. |
| **Map Rendering** | **Mapbox GL JS** | Hardware-accelerated vector tiles for O(1) rendering performance on mobile. |
| **Backend Runtime** | **Node.js** with **Hono** | Hono is a lightweight, edge-ready web framework (sub-ms routing), deployed as a single binary/container. |
| **Database** | **PostgreSQL** + **PostGIS** | Industry standard for spatial queries (`ST_Intersects`); portable, reliable, and scalable for millions of rows. |
| **Development Envrionment** | **Nix** (via Nix Flakes) | Reproducible dev environment ensuring all engineers use identical versions of Node, Postgres, and native deps. |
| **Deployment** | **Docker** (Fly.io / Render) | Single-container deployment for simplicity; easy horizontal scaling if traffic spikes. |

### 2. System Architecture

The system follows a **Three-Tier Architecture** optimized for read-heavy workloads (99% reads, 1% writes).

*   **Client (Browser)**:
    *   Connects to CDN/Edge for static assets and cached API responses.
    *   Renders the interactive map using WebGL (Mapbox).
    *   Handles UI state (selected shape, filters) locally.
*   **API Layer (Backend)**:
    *   Stateless REST endpoint (`GET /api/shapes`).
    *   Performs spatial lookups in PostGIS based on the user's viewport bounding box.
    *   caches responses heavily (via `Cache-Control` headers) to minimize DB load.
*   **Data Layer (Database)**:
    *   Stores shape definitions (GeoJSON geometry, metadata like name/distance).
    *   Uses **Spatial Indices (GiST)** to make searching millions of shapes instant.
    *   *Note:* The "Generator" (Python/Elixir scripts) runs **offline** to populate this DB, not during user requests.

### 3. Code Architecture (Monorepo)

A single Git repository utilizing **pnpm workspaces** to manage dependencies efficiently.

```text
/
├── apps/
│   ├── frontend/          # SvelteKit Application
│   │   ├── src/routes/    # Pages (+page.svelte) and API proxies
│   │   ├── src/lib/       # Shared UI components (ShapeCard.svelte, MapView.svelte)
│   │   └── static/        # Static assets (icons, manifest.json)
│   │
│   └── backend/           # Hono API Server
│       ├── src/           # Route handlers and DB logic
│       └── dist/          # Compiled output for Docker
│
├── tools/                 # Offline Data Processing
│   ├── gen_prague.py      # Python script to process OSM data/GeoJSON
│   └── load_shapes.sql    # SQL script to seed the database
│
├── infra/                 # Infrastructure as Code
│   ├── Dockerfile         # Multi-stage build for the production container
│   ├── docker-compose.yml # Local dev stack (Frontend + Backend + DB)
│   └── flake.nix          # Nix environment definition
│
├── package.json           # Root workspace config
└── pnpm-workspace.yaml    # Workspace definitions
```

### 4. Required Tooling & Setup

To enable this workflow ("Concept to Production"), you need the following correctly configured:

#### Development Environment
*   **Nix Flake**: Define `devShell` containing `nodejs_20`, `pnpm`, `postgresql`, `postgis`, `playwright`, and `python3`.
*   **Husky + Lint-Staged**:
    *   **Pre-commit**: Run `eslint` (code quality) and `prettier` (formatting) on changed files.
    *   **Pre-push**: Run `pnpm test:e2e` to ensure no regressions before deployment.
*   **VS Code**: Extensions for Svelte, Tailwind CSS, and ESLint.

#### Testing Strategy
*   **Unit Tests**: **Vitest** for testing pure logic (distance calculations, simple components).
*   **E2E Tests**: **Playwright** integration.
    *   *Critical Test*: `tests/e2e.spec.ts` loads the map, simulates a pan gesture, clicks a shape, and asserts the "Export GPX" button appears.

#### Data Pipeline (The "Generator")
*   **OSM Tooling**: `osmnx` (Python) for network graph analysis and `shapely` for geometry manipulation.
*   **GeoJSON.io**: For rapid manual curation/prototyping of initial shapes to seed the DB tonight.

#### DevOps / CI
*   **GitHub Actions**:
    *   On PR: Run lint + tests + build check.
    *   On Merge to Main: Build Docker image and push to registry (e.g., GHCR).
*   **Observability**: Basic structured logging (JSON format) in the backend to track request latency and "shapes returned count."

This architecture is **"boring" in the best way possible**: it uses standard, battle-tested components to solve the complex problem of spatial discovery, ensuring you can sleep while the app handles 10k users.
