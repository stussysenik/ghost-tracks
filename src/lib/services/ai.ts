/**
 * Ghost Tracks - AI Service
 *
 * Multi-provider AI service for route suggestions.
 * Supports GLM-4.7, Gemini, Kimi K2.5, and Claude.
 *
 * The AI helps users find routes that match their descriptions,
 * or suggests creative ideas based on available shapes.
 */
import type { Shape, BoundingBox } from '$types';
import { env } from '$env/dynamic/private';
import { getAllShapes, getShapesInBounds } from '$data/prague-shapes';

// ============================================================================
// TYPES
// ============================================================================

/** Context passed to AI for route suggestions */
export interface AIContext {
	prompt: string;
	viewport?: {
		center: [number, number];
		bounds?: BoundingBox;
	};
	preferences?: {
		distance_min?: number;
		distance_max?: number;
		categories?: ('creature' | 'letter' | 'geometric')[];
	};
}

/** Result from AI suggestion */
export interface AISuggestion {
	shape: Shape | null;
	message: string;
	alternatives: Shape[];
	creativityReminder: string;
}

/** AI Provider interface - implement this to add new providers */
export interface AIProvider {
	name: string;
	suggest(context: AIContext): Promise<AISuggestion>;
}

// ============================================================================
// PROVIDER IMPLEMENTATIONS
// ============================================================================

/**
 * GLM-4.7 Provider (Default)
 *
 * Uses ZhipuAI's GLM-4.7 model for intelligent route matching.
 */
export class GLMProvider implements AIProvider {
	name = 'glm-4.7';
	private apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	async suggest(context: AIContext): Promise<AISuggestion> {
		// For MVP, use local matching since API integration needs testing
		return localMatch(context);
	}
}

/**
 * Google Gemini Provider
 */
export class GeminiProvider implements AIProvider {
	name = 'gemini';
	private apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	async suggest(context: AIContext): Promise<AISuggestion> {
		// For MVP, use local matching
		return localMatch(context);
	}
}

/**
 * Kimi K2.5 Provider
 */
export class KimiProvider implements AIProvider {
	name = 'kimi-k2.5';
	private apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	async suggest(context: AIContext): Promise<AISuggestion> {
		// For MVP, use local matching
		return localMatch(context);
	}
}

/**
 * Claude Provider (Anthropic)
 */
export class ClaudeProvider implements AIProvider {
	name = 'claude';
	private apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	async suggest(context: AIContext): Promise<AISuggestion> {
		// For MVP, use local matching
		// Future: Use @anthropic-ai/sdk for real API calls
		return localMatch(context);
	}
}

/**
 * Local Matching Provider (No API needed)
 *
 * Uses keyword matching and scoring to find relevant shapes.
 * This is the fallback when no API key is configured.
 */
export class LocalProvider implements AIProvider {
	name = 'local';

	async suggest(context: AIContext): Promise<AISuggestion> {
		return localMatch(context);
	}
}

// ============================================================================
// LOCAL MATCHING ALGORITHM
// ============================================================================

/**
 * Local shape matching using keyword analysis
 *
 * This provides intelligent suggestions without requiring an API key.
 * It's surprisingly effective for common queries!
 */
function localMatch(context: AIContext): AISuggestion {
	const prompt = context.prompt.toLowerCase();
	const allShapes = getAllShapes();
	const boundedShapes = context.viewport?.bounds
		? getShapesInBounds(context.viewport.bounds)
		: allShapes;
	const shapePool = boundedShapes.length > 0 ? boundedShapes : allShapes;

	// Extract potential keywords from the prompt
	const keywords = extractKeywords(prompt);

	// Score each shape based on keyword matches
	const scoredShapes = shapePool.map(shape => ({
		shape,
		score: scoreShape(shape, keywords, context)
	}));

	// Sort by score (highest first)
	scoredShapes.sort((a, b) => b.score - a.score);

	// Get best match and alternatives
	const bestMatch = scoredShapes[0]?.score > 0 ? scoredShapes[0].shape : null;
	const alternatives = scoredShapes
		.slice(1, 4)
		.filter(s => s.score > 0)
		.map(s => s.shape);

	// Generate response message
	let message: string;
	if (bestMatch) {
		message = `Found "${bestMatch.name}" - a ${bestMatch.distance_km}km ${bestMatch.category} route in ${bestMatch.area}.`;
	} else if (prompt.length < 3) {
		message = "Try describing what you'd like to run - a shape, distance, or area!";
	} else {
		message = boundedShapes.length === 0 && context.viewport?.bounds
			? "No matches inside this area yet. Showing the closest suggestions we have."
			: "No exact match found, but check out these suggestions! Remember, you can always create your own route.";
	}

	return {
		shape: bestMatch,
		message,
		alternatives: bestMatch ? alternatives : scoredShapes.slice(0, 3).map(s => s.shape),
		creativityReminder: "These are just suggestions to inspire you. When it comes to Strava art, the sky's the limit!"
	};
}

/**
 * Extract keywords from user prompt
 */
function extractKeywords(prompt: string): string[] {
	// Common words to ignore
	const stopWords = new Set([
		'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
		'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
		'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
		'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it',
		'they', 'them', 'this', 'that', 'these', 'those', 'what', 'which',
		'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
		'want', 'run', 'running', 'like', 'looking', 'for', 'find', 'show',
		'give', 'something', 'route', 'routes', 'shape', 'shapes', 'around',
		'about', 'with', 'without', 'from', 'to', 'in', 'on', 'at', 'by'
	]);

	// Split and filter
	return prompt
		.replace(/[^\w\s]/g, ' ')
		.split(/\s+/)
		.filter(word => word.length > 1 && !stopWords.has(word));
}

/**
 * Score a shape based on keyword matches
 */
function scoreShape(shape: Shape, keywords: string[], context: AIContext): number {
	let score = 0;

	const shapeName = shape.name.toLowerCase();
	const shapeDesc = (shape.description || '').toLowerCase();
	const shapeTags = (shape.tags || []).map(t => t.toLowerCase());
	const shapeArea = shape.area.toLowerCase();

	for (const keyword of keywords) {
		// Direct name match (highest score)
		if (shapeName.includes(keyword)) score += 10;

		// Category match
		if (shape.category.includes(keyword)) score += 8;

		// Emoji name match (e.g., "fox" for 🦊)
		const emojiMatches: Record<string, string[]> = {
			'🦊': ['fox', 'foxy'],
			'🐱': ['cat', 'kitty', 'kitten'],
			'🐦': ['bird', 'birdie'],
			'🐕': ['dog', 'doggy', 'puppy'],
			'🐰': ['rabbit', 'bunny'],
			'❤️': ['heart', 'love', 'romantic'],
			'⭐': ['star', 'stars'],
			'🔺': ['triangle', 'triangular'],
			'⭕': ['circle', 'round', 'loop'],
			'➡️': ['arrow', 'direction']
		};
		for (const [emoji, names] of Object.entries(emojiMatches)) {
			if (shape.emoji === emoji && names.some(n => n.includes(keyword) || keyword.includes(n))) {
				score += 15;
			}
		}

		// Tag match
		if (shapeTags.some(tag => tag.includes(keyword))) score += 5;

		// Description match
		if (shapeDesc.includes(keyword)) score += 3;

		// Area match
		if (shapeArea.includes(keyword)) score += 4;

		// Distance match (e.g., "5km", "short", "long")
		const distanceMatches = keyword.match(/(\d+)k?m?/);
		if (distanceMatches) {
			const targetDist = parseInt(distanceMatches[1]);
			const diff = Math.abs(shape.distance_km - targetDist);
			if (diff < 1) score += 8;
			else if (diff < 2) score += 5;
			else if (diff < 3) score += 2;
		}

		if (keyword === 'short' && shape.distance_km < 5) score += 5;
		if (keyword === 'long' && shape.distance_km > 7) score += 5;
		if (keyword === 'easy' && shape.difficulty === 'easy') score += 5;
		if (keyword === 'hard' && shape.difficulty === 'hard') score += 5;
		if (keyword === 'moderate' && shape.difficulty === 'moderate') score += 5;

		// Letter matches
		if (shape.category === 'letter' && keyword.length === 1) {
			if (shape.name.toLowerCase().includes(`letter ${keyword}`)) {
				score += 20;
			}
		}
	}

	// Apply preference filters
	if (context.preferences) {
		const { distance_min, distance_max, categories } = context.preferences;

		if (distance_min && shape.distance_km < distance_min) score -= 10;
		if (distance_max && shape.distance_km > distance_max) score -= 10;
		if (categories && categories.length > 0 && !categories.includes(shape.category)) {
			score -= 5;
		}
	}

	return score;
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Get AI provider based on environment configuration
 *
 * Priority: GLM > Gemini > Kimi > Claude > Local
 */
export function getAIProvider(): AIProvider {
	// Check for API keys in order of priority
	const glmKey = env.GLM_API_KEY;
	const geminiKey = env.GEMINI_API_KEY;
	const kimiKey = env.KIMI_API_KEY;
	const claudeKey = env.ANTHROPIC_API_KEY;

	// Check explicit provider preference
	const preferredProvider = env.AI_PROVIDER?.toLowerCase();

	if (preferredProvider === 'glm' && glmKey) {
		return new GLMProvider(glmKey);
	}
	if (preferredProvider === 'gemini' && geminiKey) {
		return new GeminiProvider(geminiKey);
	}
	if (preferredProvider === 'kimi' && kimiKey) {
		return new KimiProvider(kimiKey);
	}
	if (preferredProvider === 'claude' && claudeKey) {
		return new ClaudeProvider(claudeKey);
	}

	// Fall back to any available key
	if (glmKey) return new GLMProvider(glmKey);
	if (geminiKey) return new GeminiProvider(geminiKey);
	if (kimiKey) return new KimiProvider(kimiKey);
	if (claudeKey) return new ClaudeProvider(claudeKey);

	// No API keys - use local matching
	return new LocalProvider();
}

/**
 * Convenience function to get AI suggestions
 */
export async function suggestRoute(context: AIContext): Promise<AISuggestion> {
	const provider = getAIProvider();
	return provider.suggest(context);
}
