# PRD CREATED BY GROK 4.1

PROMPT:

```
anything to add? anything to fill in? GPT 5.2 what do you think - by many you're considered the most-intelligent model yet how'd you execute this, any helpful tips, exact problems/details to handle, blind spots, etc. that we've not thought of?
```

RESPONSE:
## **STRAVA-ART-WORK-PLANNER: Principal Engineer's Final Architecture**

I'm cutting through the abstraction. Here's the **minimal, resilient, traffic-ready stack** that ships **tonight** and scales to 10k users without breaking:

***

## **DECISION MATRIX: What you're actually building**

| Dimension | Decision | Why |
|-----------|----------|-----|
| **Primary UX** | Mobile web (SvelteKit SSR) | No app store friction, instant link-sharing for Instagram, PWA-capable for offline caching |
| **Map engine** | Mapbox GL JS (vector tiles) | Pre-rendered tiles = O(1) render, no server load for display |
| **Database** | PostgreSQL + PostGIS (single instance) | Handles 10k users with simple queries; no sharding needed for MVP; portable (migrate later) |
| **Backend** | Minimal Node.js/Hono or simple Go binary | Phoenix is brilliant but adds complexity; at this scale, a ~200-line Hono handler suffices |
| **Shape engine** | Pre-computed, zero runtime matching | All shapes baked into DB offline; discovery is a simple spatial query, not ML |
| **Route export** | GPX only (no Strava integration yet) | Decouples you from Strava API limits; users can copy-paste the link into Strava manually |
| **Naming convention** | "Creatures", "Letters", "Geometric" (3 categories) | Eliminates the "semantic correctness" problem; visual geometry speaks for itself |
| **Turn-by-turn** | None; "follow the white line" mode | Saves routing complexity; GPX import into any app handles the navigation |
| **Auth** | Cookie-based; no OAuth initially | Adds latency and failures; skip for v0, add favorites later |

***

## **The "1-Night MVP" Scope (Non-Negotiable)**

You ship this:

1. **Homepage**: Map of Prague, 3 zoom levels (city → district → street).
2. **Ghost routes**: 15–20 precomputed shapes (5 creatures, 5 letters, 5 geometric).
3. **Tap to reveal**: Click a shape → card slides up with:
   - Name, emoji, distance, time estimate (pace @ 5 min/km).
   - "Preview" button (highlights on map).
   - "Export GPX" (downloads `.gpx` file, ready to import into Strava).
   - "Copy link" (shareable URL pre-filtered to this shape for Instagram).
4. **Filters**: Distance slider (3k–20k), category tabs.
5. **Mobile UX**: Full-screen map, cards slide from bottom, no nav chrome.

You **don't ship** tonight:
- Turn-by-turn navigation.
- Creator mode / shape editing.
- Strava OAuth.
- Multiple cities.
- Leaderboards / galleries.
- Favorites / accounts.

***

## **Stack: Brutal Minimalism**

### **Frontend**
```
SvelteKit (SSR, static prerendering)
├─ TypeScript + Svelte components
├─ Mapbox GL JS (preloaded vector tiles)
├─ Tailwind CSS (zero custom CSS)
└─ pnpm workspaces (keep it tight)
```

**Why this wins:**
- Svelte's compiler-to-vanilla-JS means the shipped bundle is tiny (~50kb gzipped).
- SSR renders the initial map server-side so the first paint is instant even on 3G.
- Tailwind's JIT ensures zero dead CSS.
- Mapbox GL handles millions of vectors without JavaScript overhead; you're just creating a layer.

**Mobile optimization:**
- Use Mapbox `fitBounds` instead of manual pan/zoom listeners; it's hardware-accelerated.
- Render shapes as `GeoJSON` layers (not DOM), so a pan is just a viewport update, not DOM reflow.
- Service worker caches the map tiles, so revisits are instant.

### **Backend**
```
Hono (edge-friendly, 0-dep Node runtime)
├─ Single handler: GET /api/shapes?bbox=...&distance_min=...&distance_max=...
├─ Return GeoJSON + metadata (~2kb per shape)
├─ Cache responses at Cloudflare/edge (immutable, 24h TTL)
└─ SQLite or PostgreSQL (single-box, no replica needed)
```

**Why this wins:**
- Hono is 20x smaller than Express; deploys as a single binary.
- Edge caching (via Cloudflare Workers) means the backend handles maybe 1 req/sec even with 10k users panning.
- No connection pooling headaches; SQLite for v0 (zero ops), Postgres later if you need transactions.

**Concrete endpoint:**

```typescript
// GET /api/shapes?bbox=-74.01,40.71,-74.00,40.72&distance_min=3&distance_max=10
// Returns:
{
  shapes: [
    {
      id: "prague-fox-1",
      name: "Fox Across Staré Město",
      emoji: "🦊",
      category: "creature",
      distance_km: 7.2,
      geometry: { type: "LineString", coordinates: [[14.42, 50.08], ...] },
      bbox: [14.41, 50.07, 14.43, 50.09]
    }
  ],
  count: 5
}
```

### **Database Schema (PostgreSQL + PostGIS)**
```sql
CREATE TABLE shapes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'creature', 'letter', 'geometric'
  emoji TEXT,
  distance_km NUMERIC,
  difficulty TEXT, -- 'easy', 'moderate', 'hard'
  geometry GEOMETRY(LineString, 4326),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_shapes_geometry ON shapes USING GIST(geometry);
CREATE INDEX idx_shapes_distance ON shapes(distance_km);
```

**Why PostGIS:**
- `ST_Contains`, `ST_Intersects`, `ST_Distance` are exact and battle-tested.
- Later, if you go multi-city, spatial indexes scale.
- But for tonight: a simple `SELECT * FROM shapes WHERE ST_Intersects(geometry, ST_GeomFromGeoJSON(...))` returns results in <10ms.

***

## **The "Generator" (Runs Offline, Once)**

You don't need a real algorithm tonight. Here's what I'd do:

```python
# tools/gen_prague.py (runs once, output goes to DB)
import osmnx as ox
import shapely.geometry as geom

# 1. Load Prague street graph
G = ox.graph_from_place("Prague, Czech Republic", network_type="all")

# 2. Manually curate 15 shapes (or use simple heuristics):
#    - Load a "fox outline" as GeoJSON, snap it to nearest streets.
#    - Compute distance using ST_Length in PostGIS.
#    - Insert into DB.

# 3. For v0, I'd actually just:
#    - Draw shapes in GeoJSON by hand (5 min in geojson.io).
#    - Load them into the DB with INSERT.
#    - Ship it.

shapes = [
  {"name": "Fox Across Staré Město", "emoji": "🦊", "geojson": "...", "distance": 7.2},
  {"name": "Letter A (Vinohrady)", "emoji": "🔤", "geojson": "...", "distance": 5.1},
  ...
]

for shape in shapes:
  insert_into_db(shape)
```

**Why manual?**
- Automatic shape-matching is a PhD thesis; you don't need it tonight.
- Hand-drawing 15 shapes takes 90 minutes and feels magical because users know *humans* curated them.
- Later, you can add ML to auto-generate more.

***

## **Deployment: "Works Everywhere" (Tonight)**

### **Local dev (NixOS flake)**
```nix
# flake.nix
{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShell = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_20
            pnpm
            postgresql_16
            postgis
            sqlite
            playwright
          ];
        };
      }
    );
}

# Run: nix flake update && nix develop
```

### **Production (Fly.io or Render, single container)**
```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Build frontend
COPY apps/frontend /app/frontend
WORKDIR /app/frontend
RUN pnpm install && pnpm build

# Build backend
WORKDIR /app
COPY apps/backend /app/backend
WORKDIR /app/backend
RUN npm install

# Start
CMD ["node", "apps/backend/dist/index.js"]
```

**Why this wins:**
- Single container = single deploy command, single billing line, no "orchestration" headaches.
- Fly.io auto-scales instances if traffic spikes (free tier covers 10k users easily).
- If traffic explodes, you just change `fly.toml` to add more instances (no code change).

***

## **The Mobile Experience (Why It'll Go Viral)**

Here's the UX flow that makes users *want* to share:

```
1. Open link from Instagram story.
   → SvelteKit SSR renders map + initial shapes instantly (no loading screen).
   
2. Map shows Prague; 3 ghost routes visible ("🦊 Fox", "🏔️ Mountain", "💙 Heart").
   → Users see instantly: "Oh cool, these are places I can run."
   
3. Tap the fox.
   → Card slides up (iOS-style), shows:
     - Big emoji + name
     - "7.2 km • 36 min @ 5:15 pace"
     - Static preview image (pre-rendered)
     - Two buttons: "PREVIEW ON MAP" + "EXPORT GPX"
   
4. Hit "EXPORT GPX".
   → Browser downloads `fox-across-stare-mesto.gpx` instantly.
   → In Strava app, user does "Add Route" → imports GPX → runs it.
   → Completes, posts to Insta with your app link in bio comment.
```

**The "Mario Superflower" moment:**
The user discovers a route they *never* would've thought to run. It's geometrically playful, fits their fitness level, and when they complete it, they feel clever. They screenshot the route preview, share it. Repeat.

***

## **Performance Budget (Tonight's MVP)**

| Metric | Target | How achieved |
|--------|--------|--------------|
| FCP (First Contentful Paint) | <1.5s | SSR + inline critical CSS |
| TTI (Time to Interactive) | <2.5s | Hydration only, minimal JS |
| Map pan/zoom latency | <50ms | Mapbox GL hardware acceleration |
| Shape query (API) | <20ms | Spatial index + edge cache |
| Bundle size (shipped JS) | <80kb | Svelte compiler, tree-shake |

**How you hit these:**
1. Use Lighthouse CI in GitHub Actions; fail PRs if FCP > 2s.
2. Test on real 3G (Chrome DevTools "Slow 3G") before commits.
3. Use `pnpm audit` for dep bloat; cut anything >100kb.

***

## **The "Honest" Blind Spots & Mitigations**

| Blind Spot | Mitigation | Timeline |
|------------|------------|----------|
| "User runs the route and it's actually unsafe (highway)" | Add disclaimer + "report" button in export card; curate shapes by hand | v0 |
| "Strava's ToS forbids 'artificial' routes" | Contact Strava directly; their "Featured Routes" exist, so precedent is there | Pre-launch |
| "What if the OSM data for a shape is wrong?" | Manual curation + user feedback loop; iterate shapes weekly | v1 |
| "Mobile app doesn't exist; Android/iOS users expect native" | Ship PWA that installs to home screen; looks/feels native | v0.5 |
| "Users want to create their own shapes" | Creator mode is v2; for now, close the loop with "Suggest a shape" form | v1 |
| "Database gets huge with more cities" | PostGIS handles millions of rows; shard by city later if needed | v3+ |

***

## **Build Checklist (Tonight: 12 AM → 6 AM)**

```makefile
## SETUP (45 min)
nix develop                    # Enter reproducible shell
pnpm install                   # Install deps
createdb strava_art_test       # Create test DB
```

```makefile
## FRONTEND (90 min)
pnpm create svelte@latest apps/frontend -- --template minimal
cd apps/frontend && pnpm add mapbox-gl tailwindcss
# apps/frontend/src/routes/+page.svelte: Map + shape cards
# apps/frontend/src/routes/api/shapes/+server.ts: Proxy to backend
```

```makefile
## BACKEND (60 min)
npm init -y -w apps/backend
npm install hono @hono/node-server pg geojson-types
# apps/backend/index.ts: Single GET /api/shapes handler
```

```makefile
## DATA (45 min)
# tools/load-shapes.sql: INSERT 15 hand-drawn shapes into PostgreSQL
# Run: psql -U postgres strava_art_test < tools/load-shapes.sql
```

```makefile
## TESTING (30 min)
pnpm add -D playwright
npx playwright install chromium
# tests/e2e.spec.ts: 
#   - Open page, pan map, tap shape, export GPX
pnpm test:e2e
```

```makefile
## VIDEO (30 min)
# Screen record on iPhone:
# - Open web app link
# - Pan Prague
# - Tap shape, show card
# - Export GPX
# - Show in Strava app
```

**Total: ~5 hours**. Publish link + video by 6 AM CET.

***

## **Post-Launch (Week 1–2): The Real Moves**

- **Day 2**: Add analytics (Plausible or Fathom); watch where users get stuck.
- **Day 3**: 2–3 user interviews; ask: "What shape would make you run tomorrow?"
- **Week 1**: Expand to 2–3 more cities (same model, different hand-drawn shapes).
- **Week 2**: Simple favorites (localStorage → backend); users save their top 5.

***

## **The "Shoot for the Moon" Reality Check**

Can this catch Strava's eye? **Yes**, but not because it's technically novel. Because:

1. **It's opinionated**: "Run art" is a 2D constraint, not a general routing app. Strava could acquire this and bundle it.
2. **It's frictionless**: No signup, no Strava API dependency, works offline.
3. **It goes viral**: The Instagram loop is clean (map → route → story → link in bio).
4. **It's defensible**: The shape curation (human creativity) is the moat, not the algorithm.

But tonight? **Ignore the moon.** Focus on: map renders, shape card slides up smoothly, GPX downloads, and a video you're proud to post.

***

## **Final Call: Ship This**

You have everything. Build the checklist above, commit to the scope, and by 6 AM you'll have a working app. The details (native apps, ML shape-gen, Strava integration, monetization) can wait—they distract from the core loop: *"Discover a route. Run it. Share it."*

That's the product. Everything else is noise.

**Go ship. The best time to get feedback is launch day, not launch week.** 🚀
