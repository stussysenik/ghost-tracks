/**
 * Ghost Tracks - Type Definitions
 * Core interfaces for shapes, routes, and map interactions
 */

// ============================================================================
// SHAPE TYPES
// ============================================================================

/** Categories of Strava art shapes */
export type ShapeCategory = 'creature' | 'letter' | 'geometric';

/** Difficulty levels for routes */
export type Difficulty = 'easy' | 'moderate' | 'hard';

/** GeoJSON LineString geometry for route paths */
export interface LineStringGeometry {
	type: 'LineString';
	coordinates: [number, number][]; // [longitude, latitude] pairs
}

/** Bounding box: [minLng, minLat, maxLng, maxLat] */
export type BoundingBox = [number, number, number, number];

/**
 * Shape - A pre-computed route that forms a recognizable pattern
 * These are the "ghost routes" users discover on the map
 */
export interface Shape {
	/** Unique identifier (e.g., "prague-fox-1") */
	id: string;

	/** Human-readable name (e.g., "Fox Across Staré Město") */
	name: string;

	/** Emoji representation for quick visual identification */
	emoji: string;

	/** Category for filtering */
	category: ShapeCategory;

	/** Total route distance in kilometers */
	distance_km: number;

	/** Route difficulty based on terrain and complexity */
	difficulty: Difficulty;

	/** Estimated completion time in minutes (at 5:30/km pace) */
	estimated_minutes: number;

	/** GeoJSON geometry of the route path */
	geometry: LineStringGeometry;

	/** Bounding box for spatial queries [minLng, minLat, maxLng, maxLat] */
	bbox: BoundingBox;

	/** Location area (e.g., "Staré Město, Prague") */
	area: string;

	/** Optional description or fun fact about the shape */
	description?: string;

	/** Tags for search (e.g., ["animal", "large", "detailed"]) */
	tags?: string[];

	/** Creation timestamp */
	created_at?: string;

	/** Routed geometry (snapped to actual streets) */
	routed_geometry?: LineStringGeometry;

	/** Actual routed distance (may differ from estimated) */
	routed_distance_km?: number;

	/** Actual routed duration in minutes */
	routed_duration_minutes?: number;

	/** Routing method used */
	routing_method?: 'directions' | 'matching' | 'original';

	/** Whether this shape has been routed to actual streets */
	is_routed?: boolean;
}

/**
 * ShapeCollection - GeoJSON FeatureCollection of shapes
 * Used for API responses and map rendering
 */
export interface ShapeFeature {
	type: 'Feature';
	id: string;
	properties: Omit<Shape, 'geometry' | 'bbox'>;
	geometry: LineStringGeometry;
	bbox?: BoundingBox;
}

export interface ShapeFeatureCollection {
	type: 'FeatureCollection';
	features: ShapeFeature[];
}

// ============================================================================
// MAP TYPES
// ============================================================================

/** Map viewport state */
export interface MapViewport {
	center: [number, number]; // [longitude, latitude]
	zoom: number;
	bounds?: BoundingBox;
}

/** Map interaction events */
export interface MapClickEvent {
	lngLat: { lng: number; lat: number };
	features?: ShapeFeature[];
}

// ============================================================================
// API TYPES
// ============================================================================

/** Query parameters for /api/shapes endpoint */
export interface ShapesQueryParams {
	bbox?: string; // "minLng,minLat,maxLng,maxLat"
	distance_min?: number;
	distance_max?: number;
	category?: ShapeCategory;
	limit?: number;
}

/** Response from /api/shapes */
export interface ShapesResponse {
	shapes: Shape[];
	count: number;
	bbox?: BoundingBox;
}

/** Request body for /api/suggest */
export interface SuggestRequest {
	prompt: string;
	viewport?: MapViewport;
	preferences?: {
		distance_min?: number;
		distance_max?: number;
		categories?: ShapeCategory[];
	};
}

/** Response from /api/suggest */
export interface SuggestResponse {
	suggestion: Shape | null;
	message: string;
	alternatives?: Shape[];
	creativity_note?: string; // "Remember: these are just suggestions!"
}

// ============================================================================
// AI PROVIDER TYPES
// ============================================================================

/** Context passed to AI providers for route suggestions */
export interface AIContext {
	viewport: MapViewport;
	availableShapes: Shape[];
	userPrompt: string;
}

/** Result from AI shape suggestion */
export interface AISuggestion {
	matchedShape: Shape | null;
	confidence: number; // 0-1
	explanation: string;
	creativityReminder: string;
}

/** AI Provider configuration */
export interface AIProviderConfig {
	name: string;
	apiKey: string;
	model?: string;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

/** Filter state for the shape browser */
export interface FilterState {
	categories: ShapeCategory[];
	distanceRange: [number, number]; // [min, max] in km
	searchQuery: string;
}

/** Selected shape state */
export interface SelectedShapeState {
	shape: Shape | null;
	isDrawerOpen: boolean;
	isPreviewMode: boolean;
}

/** Application state */
export interface AppState {
	viewport: MapViewport;
	filters: FilterState;
	selectedShape: SelectedShapeState;
	isLoading: boolean;
	error: string | null;
}

// ============================================================================
// GPX TYPES
// ============================================================================

/** GPX export options */
export interface GPXExportOptions {
	name?: string;
	description?: string;
	author?: string;
}

// ============================================================================
// DYNAMIC GENERATION TYPES (v2)
// ============================================================================

/** App mode: generate from neighborhood or describe a shape */
export type AppMode = 'generate' | 'describe';

/** A shape idea returned by the generation backend */
export interface ShapeIdea {
	name: string;
	description: string;
	emoji: string;
	estimated_distance_km: number;
	difficulty: string;
	control_points: { lng: number; lat: number }[];
	target_area: string;
}

/** A numbered waypoint with turn instruction */
export interface WaypointMarker {
	index: number;
	lng: number;
	lat: number;
	instruction: string;
}

/**
 * What the router promises about a route's runnability (backend tasks 4.1-4.3).
 *
 * Declared once and shared by the response and the route the UI holds, so a field
 * cannot be added to one and silently forgotten in the other.
 */
export interface RouteContract {
	/** Requested length in km. `null` = no target given; the shape was sized to the area. */
	target_distance_km: number | null;
	/** True when the target was unreachable and `distance_km` is the closest achievable. */
	best_effort: boolean;
	/** Fraction of the route retracing ground it already covered (0 = none). */
	repeat_ratio: number;
	/** True when the route returns to its start. Only meaningful if `shape_is_closed`. */
	is_loop: boolean;
	/**
	 * Whether the drawn shape was a loop at all. A letter M is *meant* to end away
	 * from its start; without this, `is_loop: false` cannot be told apart from a
	 * circle that failed to close, and closure must be shown as ungraded, not failed.
	 */
	shape_is_closed: boolean;
}

/** A fully generated and routed route */
export interface GeneratedRoute extends RouteContract {
	shape: ShapeIdea;
	routed_coordinates: [number, number][];
	distance_km: number;
	duration_minutes: number;
	waypoints: WaypointMarker[];
	similarity_score: number;
	neighborhood: string;
	bbox: BoundingBox;
	alternative_neighborhoods?: string[];
}

/** Toast notification type */
export type ToastType = 'info' | 'success' | 'warning' | 'error';

/** Toast notification */
export interface Toast {
	id: string;
	type: ToastType;
	message: string;
}

/** Response from POST /api/generate */
export interface GenerateResponse {
	ideas: ShapeIdea[];
	neighborhood: string;
	bbox: { min_lng: number; min_lat: number; max_lng: number; max_lat: number };
}

/** Request body for POST /api/describe */
export interface DescribeRequest {
	description: string;
	/** Opt-in. Omit to size the shape to the area instead of a length. Backend clamps 1-30. */
	target_distance_km?: number;
	neighborhood?: string;
	center?: { lng: number; lat: number };
	area_name?: string;
}

/** Response from POST /api/describe */
export interface DescribeResponse extends RouteContract {
	shape: ShapeIdea;
	neighborhood: string;
	bbox: { min_lng: number; min_lat: number; max_lng: number; max_lat: number };
	similarity_score: number;
	routed_coordinates: [number, number][];
	distance_km: number;
	duration_minutes: number;
	waypoints: WaypointMarker[];
	alternative_neighborhoods?: string[];
}

/** Neighborhood option for the picker */
export interface NeighborhoodOption {
	value: string;
	label: string;
	icon: string;
}

/** A globally-selected generation area: a dropped pin + human label */
export interface SelectedArea {
	lng: number;
	lat: number;
	label: string;
}

/** Street-density gate status for the selected area */
export type DensityStatus = 'idle' | 'checking' | 'ok' | 'sparse' | 'error';

/** Response from POST /api/area/check */
export interface AreaCheckResponse {
	ok: boolean;
	bbox: { min_lng: number; min_lat: number; max_lng: number; max_lat: number };
	way_count: number | null;
	message: string;
}

// ============================================================================
// WORKOUT PLANNER TYPES (task 5)
// ============================================================================

/**
 * One requested run in a plan.
 *
 * A plan is *shape-per-run*: every run carries its own theme and is routed
 * independently, so it is judged by the same runnable-route contract as a
 * one-off route. There is deliberately no cross-run geometric invariant — the
 * runs share a start anchor and an order, nothing more.
 */
export interface PlanRunSpec {
	/** What to draw, in the same words `/api/describe` takes. */
	theme: string;
	/** Requested length in km. Omit to size the shape to the area (see `RouteContract`). */
	target_distance_km?: number;
	/**
	 * Requested climb in metres. **Currently rejected by `validatePlanSpec`.**
	 *
	 * 5.1 declared this expecting 5.2 to fill it from graph elevation. There is no
	 * graph elevation: the OSM walk extracts carry `x`/`y`/`street_count` on nodes
	 * and nothing vertical, and nothing in the pipeline calls osmnx's elevation
	 * helpers. Accepting a target the system cannot measure would be the silent
	 * form of the dishonesty `target_distance_km` refuses loudly, so it is
	 * refused. Kept in the model because the field is intended, not wrong — see
	 * `ELEVATION_UNSUPPORTED` for what has to exist before it is accepted.
	 */
	target_elevation_gain_m?: number;
	/**
	 * Requested pace in minutes per km. Unlike distance, this is never graded:
	 * the route has a measured distance to compare a target against, but no
	 * measured pace — pace belongs to the runner. It is a conversion factor,
	 * and its only effect is `duration_minutes`.
	 */
	target_pace_min_per_km?: number;
}

/** A plan: ordered runs from one shared start anchor. */
export interface PlanSpec {
	/** Optional plan name, e.g. "Marathon block week 3". */
	name?: string;
	/** Every run starts from here. */
	anchor: SelectedArea;
	/** Ordered; position in this array is the run order. */
	runs: PlanRunSpec[];
}

/** Whether a run's duration came from the user's pace or from a fixed assumption. */
export type DurationSource = 'pace_target' | 'default_estimate';

/** Where a `PlanSpec` is invalid, and why. `path` points at the offending field. */
export interface PlanIssue {
	/** e.g. `runs[2].target_distance_km`, or `anchor`. */
	path: string;
	message: string;
}

/**
 * A run that routed successfully.
 *
 * Extends `RouteContract`, which is the point of shape-per-run: a planned run is
 * gradeable by exactly the rule a standalone route is, so `contractBadges()`
 * applies to it with no planner-specific grading code.
 */
export interface PlannedRun extends RouteContract {
	/** Position in the plan, 0-based. */
	index: number;
	spec: PlanRunSpec;
	shape: ShapeIdea;
	routed_coordinates: [number, number][];
	distance_km: number;
	duration_minutes: number;
	/**
	 * Which claim `duration_minutes` is making.
	 *
	 * `pace_target` — distance at the pace the user asked for.
	 * `default_estimate` — the backend's fixed 5 km/h, which is a *walk*. Shown as
	 * an assumption, not a prediction, for the same reason `shape_is_closed` marks
	 * ungraded closure: a number the user supplied and a number the system made up
	 * are different claims, and collapsing them into one field hides which one is
	 * on screen.
	 */
	duration_source: DurationSource;
	waypoints: WaypointMarker[];
	similarity_score: number;
	bbox: BoundingBox;
}

/**
 * A run that failed to route.
 *
 * Kept in the plan rather than collapsing the whole request: one unroutable
 * theme should not discard six good runs, and a silently shortened plan would
 * misreport what the user asked for.
 */
export interface FailedRun {
	index: number;
	spec: PlanRunSpec;
	error: string;
}

/** Response from POST /api/plan. */
export interface PlanResponse {
	name?: string;
	anchor: SelectedArea;
	runs: PlannedRun[];
	failed: FailedRun[];
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/** API error response */
export interface APIError {
	error: string;
	message: string;
	code?: string;
}

/** Pagination info */
export interface PaginationInfo {
	page: number;
	limit: number;
	total: number;
	hasMore: boolean;
}
