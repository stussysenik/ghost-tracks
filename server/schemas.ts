/**
 * Ghost Tracks gateway — shared zod schemas.
 *
 * Mirrors SPEC §6.3 types. These are the TS leg of the three-runtime type
 * mirror (zod here, pydantic in the Python brain, case classes in the Scala
 * kernel). Every stage of the pipeline is a total function over these types:
 *
 *   parse → Intent → compose → ArtPlan → place → Placement
 *         → solve → SolveResult → ArtRoute
 *
 * Teaching note: zod gives us *runtime* validation at the trust boundary
 * (HTTP) and *compile-time* types via `z.infer` — one source of truth, no
 * drift between validation and typings.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Geometry primitives
// ---------------------------------------------------------------------------

/** Point in unit design space ([x, y], typically 0..1). No geographic meaning. */
export const UnitPointSchema = z.tuple([z.number(), z.number()])

/** Geographic coordinate as [lng, lat] (GeoJSON axis order), range-checked. */
export const LngLatSchema = z.tuple([
  z.number().gte(-180).lte(180), // longitude
  z.number().gte(-90).lte(90), // latitude
])

// ---------------------------------------------------------------------------
// SPEC §6.3 — StrokeSet IR and downstream types
// ---------------------------------------------------------------------------

/** Provenance of a piece of ink: real design (glyph/shape) vs connector glue. */
export const StrokeKindSchema = z.enum(['glyph', 'shape', 'connector'])

/** One polyline in the StrokeSet IR — the ONLY format downstream stages see. */
export const StrokeSchema = z.object({
  points: z.array(UnitPointSchema).min(2),
  kind: StrokeKindSchema,
  retrace: z.boolean(),
})

/**
 * Per-segment provenance metadata. The spec guarantees `kind` (stroke vs
 * connector); a loose object lets the brain/kernel attach extra fields
 * (indices, stroke refs) without the gateway rejecting them.
 */
export const SegmentMetaSchema = z.looseObject({
  kind: StrokeKindSchema,
})

/** Composed plan: ordered strokes flattened into ONE continuous line. */
export const ArtPlanSchema = z.object({
  strokes: z.array(StrokeSchema).min(1),
  order: z.array(z.number().int().nonnegative()),
  continuous: z.array(UnitPointSchema),
  segments: z.array(SegmentMetaSchema).optional(),
})

/** Geographic bounding box the unit-space plan is projected into. */
export const BBoxSchema = z.object({
  min_lng: z.number().gte(-180).lte(180),
  min_lat: z.number().gte(-90).lte(90),
  max_lng: z.number().gte(-180).lte(180),
  max_lat: z.number().gte(-90).lte(90),
})

/** Where + how the plan sits on the map (state is a pure fn of plan ∘ placement). */
export const PlacementSchema = z.object({
  bbox: BBoxSchema,
  rotation_deg: z.number(),
  anchor: z.object({
    lng: z.number().gte(-180).lte(180),
    lat: z.number().gte(-90).lte(90),
  }),
})

/** Street-snapped result from the kernel solve + scoring loop. */
export const SolveResultSchema = z.object({
  coordinates: z.array(LngLatSchema),
  segments: z.array(SegmentMetaSchema),
  distance_km: z.number().nonnegative(),
  duration_min: z.number().nonnegative(),
  fidelity: z.number().min(0).max(100),
  success: z.boolean(),
  error: z.string().nullish(),
})

/** Parsed user intent. Loose: the brain may enrich it without breaking us. */
export const IntentSchema = z.looseObject({
  texts: z.array(z.string()).default([]),
  shapes: z.array(z.unknown()).default([]),
  occasion: z.string().nullish(),
  area: z.string().nullish(),
  distance_km: z.number().positive().nullish(),
  loop: z.boolean().default(false),
})

/** The full shareable artifact: everything needed to re-render a route. */
export const ArtRouteSchema = z.object({
  intent: IntentSchema,
  plan: ArtPlanSchema,
  placement: PlacementSchema,
  solve: SolveResultSchema,
  gpx_url: z.string().nullish(),
  share_id: z.string().nullish(),
})

// ---------------------------------------------------------------------------
// Gateway request schemas (one per POST route)
// ---------------------------------------------------------------------------

export const GenerateRequestSchema = z.object({
  shape: z.string().optional(),
  neighborhood: z.string(),
  constraints: z.array(z.string()).optional(),
  count: z.number().optional(),
})

export const DescribeRequestSchema = z.object({
  description: z.string().min(1),
  max_distance_km: z.number().positive().optional(),
  neighborhood: z.string().optional(),
})

export const RouteRequestSchema = z.object({
  waypoints: z.array(LngLatSchema).min(2),
  profile: z.enum(['walking', 'cycling']).optional(),
})

export const ComposeRequestSchema = z.object({
  prompt: z.string().min(1),
  area: z.string().optional(),
  distance_km: z.number().positive().optional(),
})

export const SolveRequestSchema = z.object({
  plan: ArtPlanSchema,
  placement: PlacementSchema,
  opts: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Share ids are exactly 10 base36 chars ([0-9a-z]). Format-validating the
 * path param means `GET /api/route/:share_id` can never be confused with any
 * other route shape.
 */
export const ShareIdSchema = z.string().regex(/^[0-9a-z]{10}$/)

// ---------------------------------------------------------------------------
// Inferred TS types — single source of truth, derived from the schemas above.
// ---------------------------------------------------------------------------

export type UnitPoint = z.infer<typeof UnitPointSchema>
export type LngLat = z.infer<typeof LngLatSchema>
export type StrokeKind = z.infer<typeof StrokeKindSchema>
export type Stroke = z.infer<typeof StrokeSchema>
export type SegmentMeta = z.infer<typeof SegmentMetaSchema>
export type ArtPlan = z.infer<typeof ArtPlanSchema>
export type BBox = z.infer<typeof BBoxSchema>
export type Placement = z.infer<typeof PlacementSchema>
export type SolveResult = z.infer<typeof SolveResultSchema>
export type Intent = z.infer<typeof IntentSchema>
export type ArtRoute = z.infer<typeof ArtRouteSchema>
export type RouteRequest = z.infer<typeof RouteRequestSchema>
