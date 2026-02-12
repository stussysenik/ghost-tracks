#!/usr/bin/env bun
/**
 * Ghost Tracks - Route Generation Script
 *
 * Pre-computes snapped routes for all Prague shapes using Mapbox Directions API.
 * Run this at build time to generate actual walkable routes.
 *
 * Usage:
 *   bun run tools/generate-routes.ts
 *
 * Requires:
 *   MAPBOX_ACCESS_TOKEN or VITE_MAPBOX_ACCESS_TOKEN in .env.local
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || process.env.VITE_MAPBOX_ACCESS_TOKEN;
const MAPBOX_DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/walking';
const MAX_WAYPOINTS = 25;

type Coord = [number, number];

interface Shape {
	id: string;
	name: string;
	emoji: string;
	category: string;
	distance_km: number;
	difficulty: string;
	estimated_minutes: number;
	area: string;
	description?: string;
	tags?: string[];
	geometry: {
		type: 'LineString';
		coordinates: Coord[];
	};
	bbox: [number, number, number, number];
	created_at?: string;
}

interface RoutedShape extends Shape {
	routed_geometry?: {
		type: 'LineString';
		coordinates: Coord[];
	};
	routed_distance_km?: number;
	routed_duration_minutes?: number;
	routing_method?: 'directions' | 'original';
	routing_error?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
	const icons = { info: '📍', success: '✅', error: '❌', warn: '⚠️' };
	console.log(`${icons[type]} ${message}`);
}

/**
 * Simplify coordinates to key waypoints using Douglas-Peucker algorithm
 */
function simplifyToWaypoints(coords: Coord[], tolerance: number = 0.0008): Coord[] {
	if (coords.length <= 3) return coords;

	let maxDistance = 0;
	let maxIndex = 0;

	const [startLng, startLat] = coords[0];
	const [endLng, endLat] = coords[coords.length - 1];

	for (let i = 1; i < coords.length - 1; i++) {
		const [lng, lat] = coords[i];
		const distance = perpendicularDistance(lng, lat, startLng, startLat, endLng, endLat);

		if (distance > maxDistance) {
			maxDistance = distance;
			maxIndex = i;
		}
	}

	if (maxDistance > tolerance) {
		const left = simplifyToWaypoints(coords.slice(0, maxIndex + 1), tolerance);
		const right = simplifyToWaypoints(coords.slice(maxIndex), tolerance);
		return [...left.slice(0, -1), ...right];
	}

	return [coords[0], coords[coords.length - 1]];
}

function perpendicularDistance(
	px: number, py: number,
	x1: number, y1: number,
	x2: number, y2: number
): number {
	const dx = x2 - x1;
	const dy = y2 - y1;

	if (dx === 0 && dy === 0) {
		return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
	}

	const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
	const nearestX = x1 + t * dx;
	const nearestY = y1 + t * dy;

	return Math.sqrt((px - nearestX) ** 2 + (py - nearestY) ** 2);
}

/**
 * Fetch route from Mapbox Directions API
 */
async function fetchDirections(waypoints: Coord[]): Promise<{
	coordinates: Coord[];
	distance_km: number;
	duration_minutes: number;
} | null> {
	const coordsString = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(';');

	const url = `${MAPBOX_DIRECTIONS_URL}/${coordsString}?geometries=geojson&overview=full&steps=false&access_token=${MAPBOX_TOKEN}`;

	try {
		const response = await fetch(url);

		if (!response.ok) {
			const text = await response.text();
			log(`API error: ${response.status} - ${text}`, 'error');
			return null;
		}

		const data = await response.json();

		if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
			log(`No route found: ${data.message || 'Unknown error'}`, 'error');
			return null;
		}

		const route = data.routes[0];
		return {
			coordinates: route.geometry.coordinates,
			distance_km: Math.round((route.distance / 1000) * 100) / 100,
			duration_minutes: Math.round(route.duration / 60)
		};
	} catch (error) {
		log(`Fetch error: ${error}`, 'error');
		return null;
	}
}

/**
 * Route a shape with chunking support for > 25 waypoints
 */
async function routeShape(shape: Shape): Promise<RoutedShape> {
	log(`Routing: ${shape.emoji} ${shape.name}...`);

	// Simplify to waypoints
	const waypoints = simplifyToWaypoints(shape.geometry.coordinates);
	log(`  Simplified ${shape.geometry.coordinates.length} coords → ${waypoints.length} waypoints`);

	if (waypoints.length < 2) {
		return {
			...shape,
			routing_method: 'original',
			routing_error: 'Not enough waypoints'
		};
	}

	// Handle chunking if needed
	if (waypoints.length > MAX_WAYPOINTS) {
		log(`  Chunking: ${Math.ceil(waypoints.length / (MAX_WAYPOINTS - 1))} requests needed`);

		const chunks: Coord[][] = [];
		for (let i = 0; i < waypoints.length; i += MAX_WAYPOINTS - 1) {
			const chunk = waypoints.slice(i, i + MAX_WAYPOINTS);
			if (chunk.length >= 2) chunks.push(chunk);
		}

		const allCoords: Coord[] = [];
		let totalDistance = 0;
		let totalDuration = 0;

		for (let i = 0; i < chunks.length; i++) {
			const result = await fetchDirections(chunks[i]);
			if (!result) {
				return {
					...shape,
					routing_method: 'original',
					routing_error: `Chunk ${i + 1} failed`
				};
			}

			if (i === 0) {
				allCoords.push(...result.coordinates);
			} else {
				allCoords.push(...result.coordinates.slice(1));
			}
			totalDistance += result.distance_km;
			totalDuration += result.duration_minutes;

			// Rate limiting
			await new Promise((r) => setTimeout(r, 200));
		}

		log(`  ✓ Routed: ${allCoords.length} coords, ${totalDistance}km, ${totalDuration}min`, 'success');

		return {
			...shape,
			routed_geometry: {
				type: 'LineString',
				coordinates: allCoords
			},
			routed_distance_km: totalDistance,
			routed_duration_minutes: totalDuration,
			routing_method: 'directions'
		};
	}

	// Single request
	const result = await fetchDirections(waypoints);

	if (!result) {
		return {
			...shape,
			routing_method: 'original',
			routing_error: 'Directions API failed'
		};
	}

	log(`  ✓ Routed: ${result.coordinates.length} coords, ${result.distance_km}km, ${result.duration_minutes}min`, 'success');

	return {
		...shape,
		routed_geometry: {
			type: 'LineString',
			coordinates: result.coordinates
		},
		routed_distance_km: result.distance_km,
		routed_duration_minutes: result.duration_minutes,
		routing_method: 'directions'
	};
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
	console.log('\n🚀 Ghost Tracks Route Generator\n');

	if (!MAPBOX_TOKEN) {
		log('No Mapbox token found! Set MAPBOX_ACCESS_TOKEN or VITE_MAPBOX_ACCESS_TOKEN', 'error');
		process.exit(1);
	}

	log(`Using Mapbox token: ${MAPBOX_TOKEN.slice(0, 10)}...`);

	// Read the shapes data
	const shapesPath = path.join(process.cwd(), 'src/lib/data/prague-shapes.ts');
	const shapesContent = fs.readFileSync(shapesPath, 'utf-8');

	// Extract the shapes array using regex (simple parsing)
	// This is a bit hacky but works for our structure
	const match = shapesContent.match(/export const pragueShapes: Shape\[\] = \[([\s\S]*?)\];/);
	if (!match) {
		log('Could not parse prague-shapes.ts', 'error');
		process.exit(1);
	}

	// Use a simpler approach: import the file dynamically
	// Since this is a build script, we can use ts-node/bun to import
	log('Loading shapes from prague-shapes.ts...');

	// Create a temporary module to export shapes
	const tempPath = path.join(process.cwd(), 'tools/temp-shapes.ts');
	const importContent = `
import { pragueShapes } from '../src/lib/data/prague-shapes';
export { pragueShapes };
`;
	fs.writeFileSync(tempPath, importContent);

	try {
		const { pragueShapes } = await import('./temp-shapes');
		log(`Found ${pragueShapes.length} shapes to route`);

		// Route each shape
		const routedShapes: RoutedShape[] = [];
		let successCount = 0;
		let failCount = 0;

		for (const shape of pragueShapes) {
			const routed = await routeShape(shape);
			routedShapes.push(routed);

			if (routed.routing_method === 'directions') {
				successCount++;
			} else {
				failCount++;
			}

			// Rate limiting between shapes
			await new Promise((r) => setTimeout(r, 500));
		}

		// Write output
		const outputPath = path.join(process.cwd(), 'src/lib/data/prague-shapes-routed.json');
		fs.writeFileSync(outputPath, JSON.stringify(routedShapes, null, 2));

		console.log('\n' + '='.repeat(50));
		log(`Routing complete!`, 'success');
		log(`  ✓ Success: ${successCount} shapes`);
		if (failCount > 0) {
			log(`  ✗ Failed: ${failCount} shapes`, 'warn');
		}
		log(`  📁 Output: ${outputPath}`);
		console.log('='.repeat(50) + '\n');
	} finally {
		// Cleanup temp file
		if (fs.existsSync(tempPath)) {
			fs.unlinkSync(tempPath);
		}
	}
}

main().catch((err) => {
	log(`Fatal error: ${err}`, 'error');
	process.exit(1);
});
