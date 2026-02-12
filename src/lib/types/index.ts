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
