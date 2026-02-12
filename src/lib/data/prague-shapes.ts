/**
 * Ghost Tracks - Prague Shape Data
 *
 * Pre-computed running routes in Prague that form recognizable shapes.
 * These routes follow actual streets and are runnable IRL.
 *
 * IMPORTANT: These are suggestions to inspire creativity.
 * When it comes to Strava art, the sky's the limit!
 *
 * Routes are snapped to actual streets using Mapbox Directions API.
 * Run `bun run tools/generate-routes.ts` to regenerate routed shapes.
 */
import type { Shape } from '$types';
import routedShapesData from './prague-shapes-routed.json';

/**
 * Prague Shapes Dataset
 *
 * Categories:
 * - Creatures: Organic shapes following Old Town's winding streets
 * - Letters: Grid patterns from Vinohrady/Žižkov neighborhoods
 * - Geometric: Classic shapes across various areas
 */
export const pragueShapes: Shape[] = [
	// =========================================================================
	// CREATURES - Staré Město & Malá Strana (organic street patterns)
	// =========================================================================
	{
		id: 'prague-fox-1',
		name: 'Fox Across Staré Město',
		emoji: '🦊',
		category: 'creature',
		distance_km: 7.2,
		difficulty: 'moderate',
		estimated_minutes: 40,
		area: 'Staré Město, Prague',
		description: 'A cunning fox emerges from the winding streets of Old Town. Follow the medieval paths where merchants once walked.',
		tags: ['animal', 'detailed', 'historic'],
		geometry: {
			type: 'LineString',
			coordinates: [
				// Fox head (starting near Old Town Square)
				[14.4205, 50.0878], [14.4218, 50.0892], [14.4235, 50.0899],
				[14.4252, 50.0895], [14.4268, 50.0888], [14.4275, 50.0875],
				// Ear
				[14.4282, 50.0885], [14.4295, 50.0895], [14.4285, 50.0880],
				// Back to head, down neck
				[14.4268, 50.0865], [14.4255, 50.0852], [14.4240, 50.0842],
				// Body
				[14.4225, 50.0835], [14.4208, 50.0828], [14.4192, 50.0822],
				[14.4175, 50.0818], [14.4158, 50.0815], [14.4142, 50.0812],
				// Legs
				[14.4135, 50.0798], [14.4128, 50.0785], [14.4138, 50.0795],
				[14.4125, 50.0808], [14.4118, 50.0795], [14.4112, 50.0782],
				[14.4120, 50.0792], [14.4108, 50.0805],
				// Tail
				[14.4095, 50.0812], [14.4078, 50.0820], [14.4065, 50.0832],
				[14.4058, 50.0845], [14.4068, 50.0838], [14.4082, 50.0825],
				// Back to body
				[14.4095, 50.0815]
			]
		},
		bbox: [14.4058, 50.0782, 14.4295, 50.0899],
		created_at: '2024-01-15'
	},
	{
		id: 'prague-cat-1',
		name: 'Cat in Malá Strana',
		emoji: '🐱',
		category: 'creature',
		distance_km: 5.5,
		difficulty: 'easy',
		estimated_minutes: 30,
		area: 'Malá Strana, Prague',
		description: 'A playful cat lounging below Prague Castle. Perfect for a relaxed morning run through charming cobblestone streets.',
		tags: ['animal', 'scenic', 'easy'],
		geometry: {
			type: 'LineString',
			coordinates: [
				// Cat head
				[14.4035, 50.0882], [14.4048, 50.0895], [14.4065, 50.0898],
				[14.4082, 50.0892], [14.4088, 50.0878],
				// Ears
				[14.4075, 50.0905], [14.4082, 50.0915], [14.4078, 50.0900],
				[14.4058, 50.0905], [14.4052, 50.0915], [14.4055, 50.0898],
				// Face back to body
				[14.4068, 50.0878], [14.4055, 50.0862], [14.4042, 50.0848],
				// Body (curled)
				[14.4028, 50.0838], [14.4015, 50.0832], [14.4002, 50.0838],
				[14.3995, 50.0852], [14.4005, 50.0865], [14.4018, 50.0872],
				// Tail
				[14.4025, 50.0878], [14.4032, 50.0888], [14.4042, 50.0895],
				[14.4055, 50.0892], [14.4048, 50.0882], [14.4035, 50.0882]
			]
		},
		bbox: [14.3995, 50.0832, 14.4088, 50.0915],
		created_at: '2024-01-15'
	},
	{
		id: 'prague-bird-1',
		name: 'Bird Over Josefov',
		emoji: '🐦',
		category: 'creature',
		distance_km: 4.0,
		difficulty: 'easy',
		estimated_minutes: 22,
		area: 'Josefov, Prague',
		description: 'A bird in flight over the historic Jewish Quarter. Wings spread across narrow streets steeped in history.',
		tags: ['animal', 'historic', 'quick'],
		geometry: {
			type: 'LineString',
			coordinates: [
				// Bird body (center)
				[14.4178, 50.0905], [14.4185, 50.0912], [14.4192, 50.0905],
				// Left wing
				[14.4175, 50.0915], [14.4158, 50.0925], [14.4142, 50.0932],
				[14.4128, 50.0935], [14.4142, 50.0928], [14.4158, 50.0918],
				// Back to body
				[14.4178, 50.0905],
				// Right wing
				[14.4198, 50.0915], [14.4215, 50.0925], [14.4232, 50.0932],
				[14.4248, 50.0935], [14.4232, 50.0928], [14.4215, 50.0918],
				// Back to body
				[14.4192, 50.0905],
				// Tail
				[14.4185, 50.0895], [14.4178, 50.0882], [14.4172, 50.0868],
				[14.4185, 50.0878], [14.4192, 50.0892], [14.4185, 50.0905],
				// Head
				[14.4192, 50.0912], [14.4198, 50.0918], [14.4205, 50.0912],
				[14.4198, 50.0905]
			]
		},
		bbox: [14.4128, 50.0868, 14.4248, 50.0935],
		created_at: '2024-01-15'
	},
	{
		id: 'prague-dog-1',
		name: 'Dog in Nové Město',
		emoji: '🐕',
		category: 'creature',
		distance_km: 6.8,
		difficulty: 'moderate',
		estimated_minutes: 38,
		area: 'Nové Město, Prague',
		description: 'A loyal companion traced through the New Town. Follows the wider boulevards perfect for a steady pace.',
		tags: ['animal', 'urban', 'popular'],
		geometry: {
			type: 'LineString',
			coordinates: [
				// Dog head
				[14.4298, 50.0752], [14.4312, 50.0765], [14.4328, 50.0772],
				[14.4342, 50.0768], [14.4348, 50.0755], [14.4342, 50.0742],
				// Ear
				[14.4335, 50.0778], [14.4342, 50.0792], [14.4338, 50.0775],
				// Neck and body
				[14.4325, 50.0738], [14.4308, 50.0725], [14.4288, 50.0715],
				[14.4268, 50.0708], [14.4248, 50.0705], [14.4228, 50.0702],
				// Front leg
				[14.4218, 50.0688], [14.4212, 50.0672], [14.4218, 50.0685],
				[14.4228, 50.0698],
				// Back leg
				[14.4258, 50.0695], [14.4252, 50.0678], [14.4248, 50.0662],
				[14.4252, 50.0675], [14.4258, 50.0692],
				// Tail
				[14.4208, 50.0708], [14.4192, 50.0718], [14.4178, 50.0732],
				[14.4188, 50.0725], [14.4202, 50.0712]
			]
		},
		bbox: [14.4178, 50.0662, 14.4348, 50.0792],
		created_at: '2024-01-15'
	},
	{
		id: 'prague-rabbit-1',
		name: 'Rabbit at Hradčany',
		emoji: '🐰',
		category: 'creature',
		distance_km: 5.0,
		difficulty: 'moderate',
		estimated_minutes: 28,
		area: 'Hradčany, Prague',
		description: 'A curious rabbit near Prague Castle. Includes some elevation as you hop up the castle district!',
		tags: ['animal', 'castle', 'hilly'],
		geometry: {
			type: 'LineString',
			coordinates: [
				// Rabbit body
				[14.3965, 50.0905], [14.3952, 50.0918], [14.3945, 50.0935],
				[14.3948, 50.0952], [14.3958, 50.0965],
				// Head
				[14.3972, 50.0972], [14.3988, 50.0978], [14.4002, 50.0975],
				[14.4008, 50.0962],
				// Ear 1
				[14.4015, 50.0985], [14.4022, 50.1002], [14.4018, 50.0982],
				// Ear 2
				[14.4002, 50.0985], [14.3995, 50.1002], [14.3998, 50.0978],
				// Back to body
				[14.3985, 50.0962], [14.3972, 50.0952],
				// Legs
				[14.3962, 50.0938], [14.3955, 50.0922], [14.3962, 50.0935],
				[14.3975, 50.0928], [14.3968, 50.0912], [14.3975, 50.0925],
				// Tail
				[14.3938, 50.0932], [14.3928, 50.0938], [14.3935, 50.0928],
				[14.3945, 50.0922]
			]
		},
		bbox: [14.3928, 50.0905, 14.4022, 50.1002],
		created_at: '2024-01-15'
	},

	// =========================================================================
	// LETTERS - Vinohrady & Žižkov (grid street patterns)
	// =========================================================================
	{
		id: 'prague-letter-p',
		name: 'Letter P',
		emoji: '🔤',
		category: 'letter',
		distance_km: 3.5,
		difficulty: 'easy',
		estimated_minutes: 20,
		area: 'Vinohrady, Prague',
		description: 'P for Prague! A crisp letter traced through the elegant Vinohrady grid.',
		tags: ['letter', 'grid', 'beginner'],
		geometry: {
			type: 'LineString',
			coordinates: [
				// Vertical stem
				[14.4425, 50.0748], [14.4425, 50.0758], [14.4425, 50.0768],
				[14.4425, 50.0778], [14.4425, 50.0788], [14.4425, 50.0798],
				// Loop of P
				[14.4435, 50.0798], [14.4448, 50.0795], [14.4458, 50.0788],
				[14.4462, 50.0778], [14.4458, 50.0768], [14.4448, 50.0762],
				[14.4435, 50.0758], [14.4425, 50.0758]
			]
		},
		bbox: [14.4425, 50.0748, 14.4462, 50.0798],
		created_at: '2024-01-15'
	},
	{
		id: 'prague-letter-r',
		name: 'Letter R',
		emoji: '🔤',
		category: 'letter',
		distance_km: 4.2,
		difficulty: 'easy',
		estimated_minutes: 23,
		area: 'Vinohrady, Prague',
		description: 'R stands for Run! Follow the grid for this classic letter.',
		tags: ['letter', 'grid', 'popular'],
		geometry: {
			type: 'LineString',
			coordinates: [
				// Vertical stem
				[14.4485, 50.0748], [14.4485, 50.0758], [14.4485, 50.0768],
				[14.4485, 50.0778], [14.4485, 50.0788], [14.4485, 50.0798],
				// Loop of R
				[14.4495, 50.0798], [14.4508, 50.0795], [14.4518, 50.0788],
				[14.4522, 50.0778], [14.4518, 50.0768], [14.4508, 50.0762],
				[14.4495, 50.0758], [14.4485, 50.0758],
				// Leg of R
				[14.4495, 50.0758], [14.4508, 50.0752], [14.4522, 50.0748]
			]
		},
		bbox: [14.4485, 50.0748, 14.4522, 50.0798],
		created_at: '2024-01-15'
	},
	{
		id: 'prague-letter-a',
		name: 'Letter A',
		emoji: '🔤',
		category: 'letter',
		distance_km: 4.0,
		difficulty: 'easy',
		estimated_minutes: 22,
		area: 'Žižkov, Prague',
		description: 'A for Art! Traced through the quirky streets of Žižkov.',
		tags: ['letter', 'urban', 'creative'],
		geometry: {
			type: 'LineString',
			coordinates: [
				// Left leg
				[14.4545, 50.0748], [14.4552, 50.0758], [14.4558, 50.0768],
				[14.4565, 50.0778], [14.4572, 50.0788], [14.4578, 50.0798],
				// Top
				[14.4585, 50.0802], [14.4592, 50.0798],
				// Right leg
				[14.4598, 50.0788], [14.4605, 50.0778], [14.4612, 50.0768],
				[14.4618, 50.0758], [14.4625, 50.0748],
				// Crossbar
				[14.4608, 50.0768], [14.4598, 50.0768], [14.4588, 50.0768],
				[14.4578, 50.0768], [14.4568, 50.0768], [14.4562, 50.0768]
			]
		},
		bbox: [14.4545, 50.0748, 14.4625, 50.0802],
		created_at: '2024-01-15'
	},
	{
		id: 'prague-letter-g',
		name: 'Letter G',
		emoji: '🔤',
		category: 'letter',
		distance_km: 3.8,
		difficulty: 'easy',
		estimated_minutes: 21,
		area: 'Vinohrady, Prague',
		description: 'G for Ghost Tracks! A smooth curve through Vinohrady.',
		tags: ['letter', 'curved', 'smooth'],
		geometry: {
			type: 'LineString',
			coordinates: [
				// Top curve
				[14.4688, 50.0792], [14.4678, 50.0798], [14.4665, 50.0800],
				[14.4652, 50.0798], [14.4642, 50.0792],
				// Left side down
				[14.4638, 50.0782], [14.4638, 50.0772], [14.4638, 50.0762],
				// Bottom curve
				[14.4642, 50.0752], [14.4652, 50.0748], [14.4665, 50.0748],
				[14.4678, 50.0752], [14.4688, 50.0758],
				// Crossbar
				[14.4688, 50.0768], [14.4678, 50.0768], [14.4668, 50.0768]
			]
		},
		bbox: [14.4638, 50.0748, 14.4688, 50.0800],
		created_at: '2024-01-15'
	},
	{
		id: 'prague-letter-e',
		name: 'Letter E',
		emoji: '🔤',
		category: 'letter',
		distance_km: 3.2,
		difficulty: 'easy',
		estimated_minutes: 18,
		area: 'Žižkov, Prague',
		description: 'E for Explore! Three clean bars traced through Žižkov.',
		tags: ['letter', 'simple', 'quick'],
		geometry: {
			type: 'LineString',
			coordinates: [
				// Vertical
				[14.4715, 50.0748], [14.4715, 50.0758], [14.4715, 50.0768],
				[14.4715, 50.0778], [14.4715, 50.0788], [14.4715, 50.0798],
				// Top bar
				[14.4725, 50.0798], [14.4738, 50.0798], [14.4748, 50.0798],
				// Back and middle bar
				[14.4715, 50.0798], [14.4715, 50.0772],
				[14.4725, 50.0772], [14.4738, 50.0772],
				// Back and bottom bar
				[14.4715, 50.0772], [14.4715, 50.0748],
				[14.4725, 50.0748], [14.4738, 50.0748], [14.4748, 50.0748]
			]
		},
		bbox: [14.4715, 50.0748, 14.4748, 50.0798],
		created_at: '2024-01-15'
	},

	// =========================================================================
	// GEOMETRIC - Various areas
	// =========================================================================
	{
		id: 'prague-heart-1',
		name: 'Heart at Letná',
		emoji: '❤️',
		category: 'geometric',
		distance_km: 6.0,
		difficulty: 'moderate',
		estimated_minutes: 33,
		area: 'Letná Park, Prague',
		description: 'Spread the love! A heart shape traced through beautiful Letná Park with stunning city views.',
		tags: ['romantic', 'scenic', 'park'],
		geometry: {
			type: 'LineString',
			coordinates: [
				// Bottom point
				[14.4218, 50.0968],
				// Right side up
				[14.4232, 50.0982], [14.4248, 50.0998], [14.4262, 50.1012],
				[14.4275, 50.1022], [14.4285, 50.1028],
				// Right curve top
				[14.4292, 50.1032], [14.4295, 50.1028], [14.4292, 50.1018],
				[14.4282, 50.1008], [14.4268, 50.1002],
				// Dip in middle
				[14.4252, 50.0998], [14.4238, 50.0995], [14.4218, 50.0992],
				[14.4198, 50.0995], [14.4182, 50.0998],
				// Left curve top
				[14.4168, 50.1002], [14.4155, 50.1008], [14.4145, 50.1018],
				[14.4142, 50.1028], [14.4145, 50.1032],
				// Left side down
				[14.4155, 50.1028], [14.4168, 50.1022], [14.4182, 50.1012],
				[14.4195, 50.0998], [14.4208, 50.0982],
				// Back to bottom
				[14.4218, 50.0968]
			]
		},
		bbox: [14.4142, 50.0968, 14.4295, 50.1032],
		created_at: '2024-01-15'
	},
	{
		id: 'prague-star-1',
		name: 'Star at Stromovka',
		emoji: '⭐',
		category: 'geometric',
		distance_km: 8.5,
		difficulty: 'hard',
		estimated_minutes: 47,
		area: 'Stromovka Park, Prague',
		description: 'Reach for the stars! A challenging five-pointed star through Prague\'s largest park.',
		tags: ['challenging', 'park', 'impressive'],
		geometry: {
			type: 'LineString',
			coordinates: [
				// Top point
				[14.4132, 50.1095],
				// Down to bottom right
				[14.4118, 50.1072], [14.4108, 50.1052], [14.4102, 50.1032],
				// Out to right point
				[14.4125, 50.1038], [14.4148, 50.1045], [14.4172, 50.1052],
				// Back in and down to bottom left point
				[14.4148, 50.1042], [14.4125, 50.1032], [14.4108, 50.1018],
				[14.4095, 50.1002], [14.4082, 50.0988],
				// Up to upper left point
				[14.4092, 50.1005], [14.4098, 50.1022], [14.4092, 50.1042],
				[14.4078, 50.1058], [14.4062, 50.1072],
				// Back in and to upper right point
				[14.4085, 50.1065], [14.4105, 50.1062], [14.4118, 50.1068],
				[14.4142, 50.1075], [14.4168, 50.1082], [14.4192, 50.1088],
				// Back to top
				[14.4165, 50.1078], [14.4142, 50.1072], [14.4132, 50.1082],
				[14.4132, 50.1095]
			]
		},
		bbox: [14.4062, 50.0988, 14.4192, 50.1095],
		created_at: '2024-01-15'
	},
	{
		id: 'prague-triangle-1',
		name: 'Triangle in Karlín',
		emoji: '🔺',
		category: 'geometric',
		distance_km: 4.5,
		difficulty: 'easy',
		estimated_minutes: 25,
		area: 'Karlín, Prague',
		description: 'A perfect triangle through the modern Karlín district. Great for beginners!',
		tags: ['simple', 'modern', 'beginner'],
		geometry: {
			type: 'LineString',
			coordinates: [
				// Top point
				[14.4485, 50.0932],
				// Down to bottom right
				[14.4498, 50.0918], [14.4512, 50.0902], [14.4525, 50.0888],
				[14.4538, 50.0872],
				// Across bottom
				[14.4518, 50.0872], [14.4498, 50.0872], [14.4478, 50.0872],
				[14.4458, 50.0872], [14.4438, 50.0872],
				// Back up to top
				[14.4448, 50.0888], [14.4458, 50.0902], [14.4468, 50.0918],
				[14.4478, 50.0932], [14.4485, 50.0932]
			]
		},
		bbox: [14.4438, 50.0872, 14.4538, 50.0932],
		created_at: '2024-01-15'
	},
	{
		id: 'prague-circle-1',
		name: 'Circle in Vršovice',
		emoji: '⭕',
		category: 'geometric',
		distance_km: 5.0,
		difficulty: 'easy',
		estimated_minutes: 28,
		area: 'Vršovice, Prague',
		description: 'What goes around comes around. A satisfying loop through residential Vršovice.',
		tags: ['loop', 'smooth', 'residential'],
		geometry: {
			type: 'LineString',
			coordinates: [
				// Start at top
				[14.4582, 50.0715],
				// Clockwise around
				[14.4598, 50.0712], [14.4612, 50.0705], [14.4622, 50.0695],
				[14.4628, 50.0682], [14.4628, 50.0668], [14.4622, 50.0655],
				[14.4612, 50.0645], [14.4598, 50.0638], [14.4582, 50.0635],
				[14.4565, 50.0638], [14.4552, 50.0645], [14.4542, 50.0655],
				[14.4535, 50.0668], [14.4535, 50.0682], [14.4542, 50.0695],
				[14.4552, 50.0705], [14.4565, 50.0712],
				// Complete the circle
				[14.4582, 50.0715]
			]
		},
		bbox: [14.4535, 50.0635, 14.4628, 50.0715],
		created_at: '2024-01-15'
	},
	{
		id: 'prague-arrow-1',
		name: 'Arrow at Holešovice',
		emoji: '➡️',
		category: 'geometric',
		distance_km: 5.5,
		difficulty: 'moderate',
		estimated_minutes: 30,
		area: 'Holešovice, Prague',
		description: 'Point the way forward! An arrow through the artsy Holešovice district.',
		tags: ['dynamic', 'artsy', 'urban'],
		geometry: {
			type: 'LineString',
			coordinates: [
				// Tail (left side)
				[14.4328, 50.1055], [14.4348, 50.1055], [14.4368, 50.1055],
				[14.4388, 50.1055], [14.4408, 50.1055],
				// Arrow head top
				[14.4408, 50.1068], [14.4418, 50.1078], [14.4432, 50.1088],
				// Arrow point
				[14.4445, 50.1055],
				// Arrow head bottom
				[14.4432, 50.1022], [14.4418, 50.1032], [14.4408, 50.1042],
				// Back to tail
				[14.4408, 50.1055]
			]
		},
		bbox: [14.4328, 50.1022, 14.4445, 50.1088],
		created_at: '2024-01-15'
	}
];

/**
 * Backward-compatible aliases for older route IDs.
 * This keeps old links functional after data refreshes.
 */
const shapeIdAliases: Record<string, string> = {
	'fox-stare-mesto': 'prague-fox-1',
	'cat-mala-strana': 'prague-cat-1',
	'bird-josefov': 'prague-bird-1',
	'dog-nove-mesto': 'prague-dog-1',
	'rabbit-hradcany': 'prague-rabbit-1'
};

/**
 * Resolve a user-provided or legacy ID to the canonical shape ID.
 */
export function resolveShapeId(id: string): string {
	return shapeIdAliases[id] ?? id;
}

/**
 * Get all shapes (for initial load)
 */
export function getAllShapes(): Shape[] {
	return pragueShapes;
}

/**
 * Get shape by ID
 */
export function getShapeById(id: string): Shape | undefined {
	const resolvedId = resolveShapeId(id);
	return pragueShapes.find(shape => shape.id === resolvedId);
}

/**
 * Filter shapes by bounding box
 * Returns shapes whose bbox intersects with the given viewport
 */
export function getShapesInBounds(bounds: [number, number, number, number]): Shape[] {
	const [minLng, minLat, maxLng, maxLat] = bounds;

	return pragueShapes.filter(shape => {
		const [shapeMinLng, shapeMinLat, shapeMaxLng, shapeMaxLat] = shape.bbox;

		// Check if bounding boxes intersect
		return !(
			shapeMaxLng < minLng ||
			shapeMinLng > maxLng ||
			shapeMaxLat < minLat ||
			shapeMinLat > maxLat
		);
	});
}

/**
 * Filter shapes by category
 */
export function getShapesByCategory(category: Shape['category']): Shape[] {
	return pragueShapes.filter(shape => shape.category === category);
}

/**
 * Filter shapes by distance range
 */
export function getShapesByDistance(minKm: number, maxKm: number): Shape[] {
	return pragueShapes.filter(
		shape => shape.distance_km >= minKm && shape.distance_km <= maxKm
	);
}

/**
 * Search shapes by name or tags
 */
export function searchShapes(query: string): Shape[] {
	const lowerQuery = query.toLowerCase();
	return pragueShapes.filter(shape =>
		shape.name.toLowerCase().includes(lowerQuery) ||
		shape.description?.toLowerCase().includes(lowerQuery) ||
		shape.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
	);
}

// ============================================================================
// ROUTED SHAPES - Snapped to actual streets
// ============================================================================

/** Routed shapes loaded from pre-computed JSON */
const routedShapes: Shape[] = (routedShapesData as Shape[]).map(shape => ({
	...shape,
	is_routed: shape.routing_method === 'directions'
}));

/**
 * Get all shapes with routed geometry (when available)
 * Falls back to original geometry if routing failed
 */
export function getRoutedShapes(): Shape[] {
	return routedShapes.map(shape => {
		if (shape.routed_geometry && shape.routing_method === 'directions') {
			return {
				...shape,
				// Use routed geometry as primary
				geometry: shape.routed_geometry,
				// Update distance and time with actual routed values
				distance_km: shape.routed_distance_km || shape.distance_km,
				estimated_minutes: shape.routed_duration_minutes || shape.estimated_minutes,
				is_routed: true
			};
		}
		return { ...shape, is_routed: false };
	});
}

/**
 * Get a single shape with routed geometry
 */
export function getRoutedShapeById(id: string): Shape | undefined {
	const resolvedId = resolveShapeId(id);
	const shapes = getRoutedShapes();
	return shapes.find(shape => shape.id === resolvedId);
}

/**
 * Get shapes with option to use routed or original geometry
 */
export function getShapesWithMode(useRoutedGeometry: boolean = true): Shape[] {
	if (useRoutedGeometry) {
		return getRoutedShapes();
	}
	return pragueShapes;
}
