/**
 * Ghost Tracks — typed API client for the Hono gateway (`/api/*`).
 *
 * Every wrapper:
 *  - is abortable (pass an AbortSignal; in-flight solves are cancelled when
 *    the placement changes again),
 *  - normalizes failures into `ApiError` so UI error states render one shape.
 */
import type { ArtPlan, ArtRoute, Diagnostic, Intent, Placement } from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly detail?: string;

  constructor(message: string, status = 0, detail?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      headers: { 'content-type': 'application/json', ...init.headers },
      ...init,
      signal
    });
  } catch (err) {
    // Re-throw aborts untouched so callers can distinguish cancellation.
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(
      'Could not reach Ghost Tracks. Is the gateway running on :3000?',
      0,
      err instanceof Error ? err.message : String(err)
    );
  }

  if (!res.ok) {
    let detail: string | undefined;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      detail = body.error ?? body.message;
    } catch {
      /* non-JSON error body — keep generic message */
    }
    throw new ApiError(detail ?? `Request failed (${res.status})`, res.status, detail);
  }

  return (await res.json()) as T;
}

function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) }, signal);
}

// ---------------------------------------------------------------------------
// Contracts (SPEC §7)
// ---------------------------------------------------------------------------

export interface ComposeRequest {
  prompt: string;
  area?: string;
  distance_km?: number;
}

export interface ComposeResponse {
  intent: Intent;
  plan: ArtPlan;
  placement: Placement;
  preview_svg?: string;
  diagnostics?: Diagnostic[];
}

export interface SolveOpts {
  profile?: 'foot';
  close_loop?: boolean;
  distance_km?: number;
}

export interface SolveRequest {
  plan: ArtPlan;
  placement: Placement;
  opts: SolveOpts;
}

/** POST /api/art/compose — NL prompt → composed plan + initial placement. */
export function composeArt(req: ComposeRequest, signal?: AbortSignal) {
  return post<ComposeResponse>('/api/art/compose', req, signal);
}

/** POST /api/art/solve — (plan, placement) → street-snapped ArtRoute. */
export function solveArt(req: SolveRequest, signal?: AbortSignal) {
  return post<ArtRoute>('/api/art/solve', req, signal);
}

/** POST /api/art/share — persist an ArtRoute, get a share id for /r/:id. */
export function shareArt(route: ArtRoute, signal?: AbortSignal) {
  return post<{ share_id: string }>('/api/art/share', route, signal);
}

/** GET /api/route/:share_id — read-only fetch for the share page. */
export function getSharedRoute(shareId: string, signal?: AbortSignal) {
  return request<ArtRoute>(`/api/route/${encodeURIComponent(shareId)}`, {}, signal);
}

/** POST /api/describe — legacy describe-flow parity (P0 gate). */
export function describeLegacy(req: { prompt: string }, signal?: AbortSignal) {
  return post<unknown>('/api/describe', req, signal);
}
