# Ghost Tracks - Technical Documentation

## Architecture Overview

```
Browser (SvelteKit)
  |
  |-- /api/describe  -->  SvelteKit proxy  -->  FastAPI :8000/describe
  |-- /api/generate  -->  SvelteKit proxy  -->  FastAPI :8000/generate
  |
  v
Mapbox GL JS (map rendering, route overlay, waypoint markers)
```

The frontend is a SvelteKit 2 app using Svelte 5 runes for state management. API requests are proxied through SvelteKit server routes to the Python FastAPI backend. The backend orchestrates shape generation, street mapping, and validation.

## Shape Generation Pipeline

When a user describes a shape (e.g. "a heart shape"), the following pipeline executes:

### 1. Shape Interpretation (backend/services/shape_generator.py)

The DSPy framework with ZhipuAI GLM-4-plus interprets the description:
- Extracts shape name, emoji, difficulty, and category
- Maps to a parametric template if one exists (heart, star, circle, triangle, arrow, square, letters)
- Falls back to circle for unrecognized shapes

### 2. Neighborhood Selection (backend/services/neighborhood.py)

Selects the best Prague neighborhood for the shape:
- 12 neighborhoods with metadata: center, bbox, street layout (grid/organic/mixed/radial), good-for tags
- Normalized keyword matching (strips plurals and noise words)
- Layout preference map (hearts prefer mixed streets, stars prefer grid, etc.)
- Hash-based tiebreaking to avoid ordering bias
- Returns top alternatives for user re-routing

### 3. Template Generation (backend/services/shape_templates.py)

Generates control points from parametric equations:
- Heart: 64 points using the standard parametric heart curve
- Star: 21 points (5 outer tips + 5 inner valleys + midpoints)
- Circle: 48 points around circumference
- Letters: Point-based definitions for A-Z
- Points are generated in normalized [-1, 1] space

### 4. Street Mapping (backend/services/street_mapper.py)

Transforms abstract control points to real street coordinates:

1. **Scale to bbox**: Maps normalized points into the neighborhood's geographic bounding box
2. **Densify** (80m max segment): Inserts intermediate points so Mapbox doesn't shortcut between distant waypoints
3. **Deduplicate** (12m min distance): Removes points too close together, but preserves points where bearing changes >20 degrees (curvature-aware)
4. **Snap to streets**: Sends waypoints to Mapbox Directions API (walking profile) which returns a route following real streets
5. **Extract waypoints**: Generates numbered turn-by-turn instructions from the Mapbox response

### 5. Shape Validation (backend/services/shape_validator.py)

Scores how well the street-snapped route matches the intended shape using three metrics:

| Component | Weight | Method |
|-----------|--------|--------|
| Modified Hausdorff | 55% | 90th-percentile directed distance (robust to single-point outliers from routing detours) |
| Ordered Sampling | 35% | Resample both curves to 50 equal points, compute mean distance between corresponding pairs |
| Raster IoU | 10% | Rasterize both to 128x128 with thick lines (width=12), compute pixel intersection-over-union |

Scores are normalized against the shape's diameter. A score of 85%+ indicates a good match.

Optional vision model validation (GLM-4v) is supported but not required.

### 6. Retry Logic

If validation score is below threshold (45%):
- **Deviation-targeted tightening**: Identifies segments where the route deviates most from target
- Inserts extra control points at the worst 50% of segments
- Re-routes through Mapbox Directions
- Up to 2 retry attempts

## API Endpoints

### POST /describe

Generate a route from a shape description.

**Request:**
```json
{
  "description": "a heart shape",
  "neighborhood": "Letna",
  "max_distance_km": 10.0
}
```

**Response:**
```json
{
  "shape": {
    "name": "A Heart Shape",
    "emoji": "...",
    "difficulty": "moderate",
    "description": "A heart shape route through Letna",
    "category": "geometric"
  },
  "routed_coordinates": [[14.42, 50.10], ...],
  "distance_km": 7.6,
  "duration_minutes": 92,
  "waypoints": [
    {"index": 1, "lat": 50.10, "lng": 14.42, "instruction": "Head north on ..."}
  ],
  "similarity_score": 87,
  "neighborhood": "Letna",
  "bbox": {"min_lng": 14.41, "min_lat": 50.09, "max_lng": 14.44, "max_lat": 50.11},
  "alternative_neighborhoods": ["Smichov", "Zizkov", "Nove Mesto"]
}
```

### POST /generate

Generate shape ideas for a neighborhood.

**Request:**
```json
{
  "neighborhood": "Karlin",
  "count": 3
}
```

**Response:**
```json
{
  "ideas": [
    {
      "name": "A Heart Shape",
      "emoji": "...",
      "difficulty": "moderate",
      "description": "..."
    }
  ],
  "neighborhood": "Karlin",
  "bbox": [14.44, 50.08, 14.46, 50.10]
}
```

## Frontend Architecture

### State Management

Svelte 5 runes (`$state`, `$derived`, `$effect`) manage all reactive state. No external state library.

Key state in `+page.svelte`:
- `mode`: 'generate' | 'describe'
- `generatedRoute`: The current route result (or null)
- `showWaypoints`: Toggle for waypoint marker visibility
- `isRoutingIdea`: Loading state for routing operations

### Components

| Component | Role |
|-----------|------|
| Map.svelte | Mapbox GL map, route line layer, waypoint markers with popups |
| ModeSwitcher.svelte | Generate/Describe tab toggle |
| GeneratePanel.svelte | Neighborhood picker, idea cards, skeleton loaders |
| DescribePanel.svelte | Text input, neighborhood preference, 4-step progress |
| RouteInstructions.svelte | Route details, GPX export, alternative neighborhoods, path-only toggle |
| Toast.svelte | Toast notification rendering |

### Session Persistence

Routes are saved to `sessionStorage` under `ghost-tracks-last-route`. On mount, if a saved route exists, it's restored and the map flies to its bounds.

## Prague Neighborhoods

| Name | Layout | Good For |
|------|--------|----------|
| Stare Mesto | organic | creatures, complex shapes |
| Mala Strana | organic | creatures, curves |
| Vinohrady | grid | letters, geometric, pixel art |
| Zizkov | mixed | stars, abstract |
| Karlin | grid | letters, geometric, modern |
| Letna | mixed | hearts, loops, mixed |
| Holesovice | mixed | stars, abstract, modern |
| Hradcany | organic | creatures, complex |
| Nove Mesto | grid | letters, geometric |
| Josefov | organic | small shapes, simple |
| Vrsovice | grid | letters, geometric |
| Smichov | mixed | loops, abstract |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| VITE_MAPBOX_ACCESS_TOKEN | Yes | Mapbox token for frontend map rendering |
| MAPBOX_ACCESS_TOKEN | Yes | Mapbox token for backend Directions API |
| GLM_API_KEY | Yes | ZhipuAI API key for GLM-4-plus LLM |
| SHAPE_VALIDATION_THRESHOLD | No | Min similarity score to pass (default: 45) |
