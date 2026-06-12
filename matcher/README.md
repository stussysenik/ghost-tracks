# matcher — deterministic road-matching service

A small Scala/Play service that snaps a drawn/described shape onto **real streets**, deterministically.

It wraps [GraphHopper](https://www.graphhopper.com/) map-matching over a **local OpenStreetMap
extract**. Ghost Tracks previously snapped routes with the Mapbox Directions API — a remote,
non-deterministic black box. This service replaces that step with a local graph so the same input
always yields the same road-snapped route, and so we can tune the shape-fidelity ↔ road-snapping
tradeoff that defines "Strava art."

It is a **drop-in** for the existing Mapbox routing call: same request/response JSON shape, so the
frontend needs no changes (see *Integration* below).

```
shape → Python StreetMapper (densify to ~80m) → POST /match → GraphHopper map-matching → road-snapped [lng,lat]
```

## Run

Requires a JDK (17+) and sbt.

```bash
# 1. Get the road data (Prague extract → matcher/data/Prague.osm.pbf)
./scripts/fetch-osm.sh

# 2. Build + run on :8080. First boot imports the .pbf into a routing graph (minutes);
#    later boots load the cached graph from data/graph-cache (fast).
sbt run
```

## API

### `POST /match`

Request — a densified trace, GeoJSON `[lng, lat]` order:

```json
{ "waypoints": [[14.420, 50.080], [14.425, 50.081], [14.430, 50.079]], "profile": "foot" }
```

Response — mirrors the existing Ghost Tracks routing contract:

```json
{
  "coordinates": [[14.420, 50.080], ...],
  "distance_km": 1.2,
  "duration_minutes": 14,
  "success": true,
  "error": null
}
```

Failures (e.g. a trace that can't be matched to roads) return `200` with `success:false` and an
`error` message, mirroring Mapbox's soft-failure so callers can fall back.

### `GET /health`

`{ "status": "ok" }`.

## Determinism

Identical input ⇒ byte-identical output, guaranteed by:

- a **pinned** GraphHopper version (`8.0`, in `build.sbt`),
- a **snapshotted** OSM extract (`data/Prague.osm.pbf`),
- a **fixed** `matcher.measurementErrorSigma` and routing profile (`conf/application.conf`).

To change the city, point `MATCHER_OSM_FILE` at another `.pbf` and delete `data/graph-cache`.

## Configuration (`conf/application.conf`)

| Key | Default | Meaning |
|-----|---------|---------|
| `matcher.osmFile` | `data/Prague.osm.pbf` | OSM extract (env `MATCHER_OSM_FILE`) |
| `matcher.graphCache` | `data/graph-cache` | where the built graph is cached |
| `matcher.profile` | `foot` | routing profile |
| `matcher.measurementErrorSigma` | `40` | map-match tolerance (m); larger = snap harder to roads |

## Integration with Ghost Tracks

`src/routes/api/route/+server.ts` calls this service instead of Mapbox when:

```bash
ROUTING_BACKEND=graphhopper
MATCHER_URL=http://localhost:8080
```

The response shape is identical, so nothing else changes. Default (unset) stays on Mapbox.
