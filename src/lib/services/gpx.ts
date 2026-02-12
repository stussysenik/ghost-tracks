/**
 * Ghost Tracks - GPX Service
 *
 * Generates GPX 1.1 compatible files from shape geometry.
 * These files can be imported into Strava, Garmin, Komoot, etc.
 */
import { buildGPX, BaseBuilder } from 'gpx-builder';
import type { Shape } from '$types';

const { Point, Segment, Track } = BaseBuilder.MODELS;

/**
 * Generate a GPX file from a shape
 */
export function generateGPX(shape: Shape, coordinates?: [number, number][]): string {
	// Create track points from coordinates
	const routeCoords = coordinates ?? shape.geometry.coordinates;
	const points = routeCoords.map(([lng, lat]) => {
		return new Point(lat, lng);
	});

	// Create track segment
	const segment = new Segment(points);

	// Create track
	const track = new Track([segment], {
		name: shape.name
	});

	const baseBuilder = new BaseBuilder();
	baseBuilder.setTracks([track]);
	return buildGPX(baseBuilder.toObject());
}

/**
 * Generate a safe filename for the GPX file
 */
export function getGPXFilename(shape: Shape): string {
	// Convert name to lowercase, replace spaces with hyphens, remove special chars
	const safeName = shape.name
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.slice(0, 50);

	return `ghost-tracks-${safeName}.gpx`;
}

/**
 * Calculate route statistics from coordinates
 */
export function calculateRouteStats(coordinates: [number, number][]): {
	distance_km: number;
	points: number;
} {
	let totalDistance = 0;

	for (let i = 1; i < coordinates.length; i++) {
		const [lng1, lat1] = coordinates[i - 1];
		const [lng2, lat2] = coordinates[i];
		totalDistance += haversineDistance(lat1, lng1, lat2, lng2);
	}

	return {
		distance_km: Math.round(totalDistance * 100) / 100,
		points: coordinates.length
	};
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6371; // Earth's radius in km
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);

	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c;
}

function toRad(deg: number): number {
	return deg * (Math.PI / 180);
}
