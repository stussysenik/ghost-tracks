# Ghost Tracks - Developer Documentation

## Architecture Overview

Ghost Tracks is a SvelteKit application that helps runners discover shapes hidden in city streets. Routes are pre-computed and snapped to actual walkable paths using the Mapbox Directions API.

### Tech Stack

- **Frontend**: SvelteKit 2 + Svelte 5 (runes)
- **Maps**: Mapbox GL JS v3
- **Styling**: Tailwind CSS v4
- **GPX Export**: gpx-builder v6
- **Deployment**: Vercel (Edge Functions)

### Project Structure

```
src/
├── routes/
│   ├── +page.svelte              # Main map interface
│   ├── api/
│   │   ├── shapes/+server.ts     # GET /api/shapes - list shapes
│   │   ├── shapes/[id]/
│   │   │   ├── +server.ts        # GET /api/shapes/:id - shape details
│   │   │   ├── gpx/+server.ts    # GET /api/shapes/:id/gpx - GPX export
│   │   │   └── route/+server.ts  # GET /api/shapes/:id/route - routed geometry
│   │   ├── route/+server.ts      # POST /api/route - on-demand routing
│   │   └── suggest/+server.ts    # POST /api/suggest - AI suggestions
│   └── shape/[id]/
│       ├── +page.svelte          # Shareable shape page
│       └── +page.server.ts       # SSR data loading
├── lib/
│   ├── components/
│   │   ├── Map.svelte            # Mapbox GL wrapper
│   │   ├── ShapeDrawer.svelte    # Bottom sheet for shape details
│   │   ├── FilterBar.svelte      # Category/distance filters
│   │   └── SearchBar.svelte      # AI-powered search
│   ├── data/
│   │   ├── prague-shapes.ts      # Shape definitions & helpers
│   │   └── prague-shapes-routed.json  # Pre-computed routed geometries
│   ├── services/
│   │   ├── routing.ts            # Mapbox Directions API wrapper
│   │   ├── gpx.ts                # GPX file generation
│   │   └── ai.ts                 # AI provider abstraction
│   └── types/
│       └── index.ts              # TypeScript interfaces
└── app.css                       # Global styles + Tailwind
```

---

## API Reference

### GET /api/shapes

Returns shapes filtered by viewport and preferences.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `bbox` | string | Bounding box: `minLng,minLat,maxLng,maxLat` |
| `category` | string | Filter by category: `creature`, `letter`, `geometric` |
| `distance_min` | number | Minimum distance in km |
| `distance_max` | number | Maximum distance in km |
| `limit` | number | Max shapes to return (default: 50) |

**Response:**
```json
{
  "shapes": [
    {
      "id": "prague-fox-1",
      "name": "Fox Across Staré Město",
      "emoji": "🦊",
      "category": "creature",
      "distance_km": 7.91,
      "difficulty": "moderate",
      "estimated_minutes": 40,
      "area": "Staré Město, Prague",
      "geometry": { "type": "LineString", "coordinates": [...] },
      "bbox": [14.4058, 50.0782, 14.4295, 50.0899]
    }
  ],
  "count": 15
}
```

### GET /api/shapes/:id

Returns a single shape by ID.

### GET /api/shapes/:id/gpx

Returns a downloadable GPX file for the shape.

**Response Headers:**
```
Content-Type: application/gpx+xml
Content-Disposition: attachment; filename="ghost-tracks-fox-across-stare-mesto.gpx"
```

### GET /api/shapes/:id/route

Returns the routed geometry (snapped to streets) for a shape.

**Response:**
```json
{
  "id": "prague-fox-1",
  "geometry": { "type": "LineString", "coordinates": [...] },
  "distance_km": 7.91,
  "duration_minutes": 95
}
```

### POST /api/route

On-demand route snapping for custom waypoints.

**Request Body:**
```json
{
  "waypoints": [[14.42, 50.08], [14.43, 50.09], ...],
  "profile": "walking"
}
```

**Response:**
```json
{
  "success": true,
  "coordinates": [[14.42, 50.08], ...],
  "distance_km": 5.2,
  "duration_minutes": 62
}
```

### POST /api/suggest

AI-powered shape suggestions based on natural language.

**Request Body:**
```json
{
  "prompt": "I want to run a fox shape",
  "viewport": {
    "center": [14.4378, 50.0755],
    "bounds": [14.3, 49.9, 14.6, 50.2]
  },
  "preferences": {
    "distance_min": 3,
    "distance_max": 10,
    "categories": ["creature"]
  }
}
```

---

## Route Snapping

Routes are snapped to actual streets using the Mapbox Directions API (walking profile).

### How It Works

1. **Waypoint Simplification**: Shape coordinates are simplified to key control points using Douglas-Peucker algorithm
2. **Directions API**: Waypoints are sent to Mapbox Directions API which returns actual street paths
3. **Chunking**: Routes with >25 waypoints are chunked into multiple API calls
4. **Caching**: Results are pre-computed at build time and stored in `prague-shapes-routed.json`

### Generate Routes

```bash
# Requires MAPBOX_ACCESS_TOKEN in .env.local
bun run tools/generate-routes.ts
```

---

## Shape Data Format

```typescript
interface Shape {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  emoji: string;                 // Visual icon
  category: 'creature' | 'letter' | 'geometric';
  distance_km: number;           // Route distance
  difficulty: 'easy' | 'moderate' | 'hard';
  estimated_minutes: number;     // Walking time
  area: string;                  // Location description
  geometry: LineStringGeometry;  // GeoJSON LineString
  bbox: [minLng, minLat, maxLng, maxLat];

  // Routed properties (optional)
  routed_geometry?: LineStringGeometry;
  routed_distance_km?: number;
  routed_duration_minutes?: number;
  routing_method?: 'directions' | 'original';
}
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_MAPBOX_ACCESS_TOKEN` | Yes | Mapbox GL JS token (public, ok to expose) |
| `MAPBOX_ACCESS_TOKEN` | Build | Server-side token for route generation |
| `AI_PROVIDER` | No | AI provider: `glm`, `gemini`, `kimi`, `claude` |
| `GLM_API_KEY` | No | GLM-4.7 API key |
| `ANTHROPIC_API_KEY` | No | Claude API key |

---

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Type check
npm run check

# Build
npm run build

# Run E2E tests
npm run test:e2e
```

---

## Deployment

Configured for Vercel with automatic deployments from `main` branch.

```bash
# Manual deploy
vercel

# Production deploy
vercel --prod
```
