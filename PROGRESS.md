# Ghost Tracks - Development Progress

## Project Status: MVP Complete ✅

### Completed Milestones

#### Phase 1: Project Setup ✅
- [x] Initialize SvelteKit 2 project with TypeScript
- [x] Configure Tailwind CSS v4
- [x] Set up Mapbox GL JS integration
- [x] Configure Vercel deployment adapter

#### Phase 2: Data Layer ✅
- [x] Define Shape TypeScript interfaces
- [x] Create 15 pre-computed Prague shapes:
  - 5 Creatures (fox, cat, bird, dog, rabbit)
  - 5 Letters (P, R, A, G, E)
  - 5 Geometric (heart, star, triangle, circle, arrow)
- [x] Implement `/api/shapes` endpoint with bbox filtering
- [x] Implement `/api/shapes/:id` endpoint

#### Phase 3: Map Integration ✅
- [x] Create Map.svelte component with Mapbox GL JS
- [x] Add GeoJSON layer for ghost routes
- [x] Implement viewport-based shape loading
- [x] Add click handlers for shape selection
- [x] Style ghost routes with faint orange overlay

#### Phase 4: Mobile UI ✅
- [x] Create ShapeDrawer.svelte (iOS-style bottom sheet)
- [x] Create FilterBar.svelte (distance slider, category tabs)
- [x] Create SearchBar.svelte with AI prompt input
- [x] Responsive design (mobile-first)

#### Phase 5: GPX Export ✅
- [x] Integrate gpx-builder library
- [x] Create `/api/shapes/:id/gpx` endpoint
- [x] Generate valid GPX 1.1 files with route geometry
- [x] Add download functionality

#### Phase 6: AI Suggestions ✅
- [x] Create AI service abstraction (swappable providers)
- [x] Implement GLM, Gemini, Kimi, Claude provider support
- [x] Create `/api/suggest` endpoint
- [x] Connect SearchBar to AI suggestions

#### Phase 7: Share & Social ✅
- [x] Create `/shape/:id` shareable pages
- [x] Add Open Graph meta tags for rich previews
- [x] Add "Copy Link" functionality

#### Phase 8: PWA & Polish ✅
- [x] Add service worker for offline support
- [x] Add PWA manifest
- [x] Performance optimization
- [x] Add OSM attribution
- [x] Add safety disclaimer

#### Phase 9: E2E Testing ✅
- [x] Set up Playwright
- [x] Write map loading tests
- [x] Write GPX export tests
- [x] Write shareable link tests

#### Phase 10: Route Snapping ✅ (Latest)
- [x] Create routing service with Mapbox Directions API
- [x] Implement Douglas-Peucker waypoint simplification
- [x] Create route generation script (`tools/generate-routes.ts`)
- [x] Pre-compute routed geometries for all 15 shapes
- [x] Add on-demand route API endpoint (`/api/route`)
- [x] Add per-shape route endpoint (`/api/shapes/:id/route`)
- [x] Update Map component to display routed shapes
- [x] Add "Routable preview" toggle

---

## Route Statistics

| Shape | Original | Routed | Coordinates |
|-------|----------|--------|-------------|
| Fox | 7.2 km | 7.91 km | 622 |
| Cat | 5.5 km | 8.71 km | 717 |
| Bird | 4.0 km | 4.16 km | 265 |
| Dog | 6.8 km | 8.44 km | 608 |
| Rabbit | 5.0 km | 5.35 km | 358 |
| Letter P | 3.5 km | 2.52 km | 251 |
| Letter R | 4.2 km | 3.47 km | 371 |
| Letter A | 4.0 km | 3.89 km | 384 |
| Letter G | 3.8 km | 2.62 km | 286 |
| Letter E | 3.2 km | 2.54 km | 279 |
| Heart | 6.0 km | 7.58 km | 451 |
| Star | 8.5 km | 8.51 km | 680 |
| Triangle | 4.5 km | 5.53 km | 379 |
| Circle | 5.0 km | 5.12 km | 400 |
| Arrow | 5.5 km | 5.26 km | 350 |

---

## Future Enhancements

### Potential Features
- [ ] User accounts and saved routes
- [ ] Custom route creation tool
- [ ] Multi-city expansion (beyond Prague)
- [ ] Strava integration for direct upload
- [ ] Route difficulty ratings based on elevation
- [ ] Community-submitted shapes
- [ ] Leaderboards for completed routes

### Technical Improvements
- [ ] Migrate to PostgreSQL + PostGIS for scalability
- [ ] Add Redis caching layer
- [ ] Implement rate limiting for API
- [ ] Add comprehensive unit tests
- [ ] Set up CI/CD pipeline

---

## Commits History

```
5daa2bd feat: add route snapping to real streets via Mapbox Directions API
ecc2e12 fix: update gpx generation for gpx-builder v6 api
7129242 feat: add playwright e2e tests
feae81e feat: add pwa support and final polish
65ae899 feat: add shareable links and social features
867edfe feat: add claude ai route suggestions
...
```

---

## Resources

- [Mapbox Directions API](https://docs.mapbox.com/api/navigation/directions/)
- [SvelteKit Docs](https://kit.svelte.dev/docs)
- [Svelte 5 Runes](https://svelte.dev/docs/svelte/overview)
- [GPX 1.1 Schema](https://www.topografix.com/gpx.asp)
