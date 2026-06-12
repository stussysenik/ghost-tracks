/**
 * Ghost Tracks gateway — Hono app factory (the BFF).
 *
 * SPEC §5/§7: `server/` is the single origin the React app talks to. It owns
 * routing, zod validation, timeouts, CORS, and share-link persistence — and
 * nothing else. Brain (Python :8000) and kernel (Scala :8080) stay private.
 *
 * Teaching note: the app is built by a *factory* taking explicit config
 * (upstream URLs, db handle, timeouts) instead of reading globals. That makes
 * the whole gateway a pure function of its config — tests construct throwaway
 * instances with temp databases and fake upstream ports, no env mutation.
 */
import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import logfire from 'logfire'

import {
  ArtRouteSchema,
  ComposeRequestSchema,
  DescribeRequestSchema,
  GenerateRequestSchema,
  RouteRequestSchema,
  ShareIdSchema,
  SolveRequestSchema,
} from './schemas.ts'
import type { LngLat } from './schemas.ts'
import type { SharesStore } from './db.ts'
import { newShareId } from './db.ts'
import { isReachable, postJson } from './upstream.ts'

// Logfire emits via the OpenTelemetry API; with no exporter configured
// (local dev / tests) spans are no-ops, so nothing leaves the process.
logfire.configureLogfireApi({ errorFingerprinting: false })

/** Per-upstream-call timeout budget (ms). Overridable for tests. */
export interface Timeouts {
  generate: number
  describe: number
  route: number
  compose: number
  solve: number
  health: number
}

const DEFAULT_TIMEOUTS: Timeouts = {
  generate: 60_000, // brain LLM shape generation
  describe: 90_000, // brain describe flow (LLM + validation loop)
  route: 30_000, // kernel map-matching is fast; generous ceiling
  compose: 90_000, // brain intent parse + glyph/shape layout
  solve: 90_000, // brain-driven kernel solve + tighten loop
  health: 1_000, // reachability probes must never block /health
}

export interface GatewayConfig {
  brainUrl: string
  kernelUrl: string
  db: SharesStore
  timeouts?: Partial<Timeouts>
}

const ALLOWED_ORIGINS = ['http://localhost:5180', 'http://localhost:5173']

/**
 * zod-validated JSON body middleware with flattened error payloads.
 * 400 responses carry `details.fieldErrors` keyed by path — directly
 * renderable as form errors by the React app.
 */
const jsonValidator = <T extends z.ZodType>(schema: T) =>
  zValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: 'Invalid request body',
          details: z.flattenError(result.error as unknown as z.ZodError),
        },
        400,
      )
    }
  })

const ShareIdParamSchema = z.object({ share_id: ShareIdSchema })

/** Legacy SvelteKit /api/route response shape, preserved verbatim (P0 parity). */
function routeResponse(
  waypoints: LngLat[],
  coordinates: LngLat[],
  opts: {
    success: boolean
    distance_km: number
    duration_minutes: number
    error?: string
  },
) {
  return {
    success: opts.success,
    ...(opts.error !== undefined ? { error: opts.error } : {}),
    coordinates,
    distance_km: opts.distance_km,
    duration_minutes: opts.duration_minutes,
    waypoint_count: waypoints.length,
    coordinate_count: coordinates.length,
  }
}

export function createApp(config: GatewayConfig) {
  const { brainUrl, kernelUrl, db } = config
  const timeouts: Timeouts = { ...DEFAULT_TIMEOUTS, ...config.timeouts }

  const app = new Hono()

  app.use('*', cors({ origin: ALLOWED_ORIGINS }))
  app.use('*', async (c, next) => {
    logfire.info(`${c.req.method} ${c.req.path} started`)
    await next()
    logfire.info(`${c.req.method} ${c.req.path} finished`)
  })

  /**
   * Shared proxy: forward a validated body to an upstream, pass the JSON
   * reply through, and map transport failures to 502/504.
   */
  async function proxy(
    c: Context,
    url: string,
    body: unknown,
    timeoutMs: number,
  ) {
    const result = await postJson(url, body, timeoutMs)
    if (!result.ok) {
      logfire.error('Upstream call failed', {
        url,
        kind: result.kind,
        message: result.message,
      })
      if (result.kind === 'timeout') {
        return c.json({ error: 'Upstream timeout', upstream: url }, 504)
      }
      return c.json({ error: 'Upstream unreachable', upstream: url }, 502)
    }
    return c.json(result.data as object, result.status as ContentfulStatusCode)
  }

  // -------------------------------------------------------------------------
  // Health — gateway status plus live upstream reachability (1 s budget each)
  // -------------------------------------------------------------------------
  app.get('/health', async (c) => {
    const [brain, kernel] = await Promise.all([
      isReachable(brainUrl, timeouts.health),
      isReachable(kernelUrl, timeouts.health),
    ])
    return c.json({
      status: 'ok',
      service: 'gateway',
      upstreams: { brain, kernel },
    })
  })

  // -------------------------------------------------------------------------
  // Brain proxies
  // -------------------------------------------------------------------------
  app.post('/api/generate', jsonValidator(GenerateRequestSchema), (c) =>
    proxy(c, `${brainUrl}/generate/`, c.req.valid('json'), timeouts.generate),
  )

  app.post('/api/describe', jsonValidator(DescribeRequestSchema), (c) =>
    proxy(c, `${brainUrl}/describe/`, c.req.valid('json'), timeouts.describe),
  )

  app.post('/api/art/compose', jsonValidator(ComposeRequestSchema), (c) =>
    proxy(c, `${brainUrl}/art/compose`, c.req.valid('json'), timeouts.compose),
  )

  app.post('/api/art/solve', jsonValidator(SolveRequestSchema), (c) =>
    proxy(c, `${brainUrl}/art/solve`, c.req.valid('json'), timeouts.solve),
  )

  // -------------------------------------------------------------------------
  // Kernel proxy — waypoint snapping with the legacy soft-fallback contract:
  // when the kernel is down we degrade gracefully (HTTP 200, success:false,
  // original waypoints echoed back) so the map can still draw a ghost line.
  // -------------------------------------------------------------------------
  app.post('/api/route', jsonValidator(RouteRequestSchema), async (c) => {
    const { waypoints, profile = 'walking' } = c.req.valid('json')

    const result = await postJson(
      `${kernelUrl}/match`,
      { waypoints, profile },
      timeouts.route,
    )

    if (!result.ok) {
      logfire.error('Kernel /match failed', {
        kind: result.kind,
        message: result.message,
      })
      return c.json(
        routeResponse(waypoints, waypoints, {
          success: false,
          error: 'kernel unreachable',
          distance_km: 0,
          duration_minutes: 0,
        }),
        200,
      )
    }

    const data = result.data as Record<string, unknown>
    const coordinates = Array.isArray(data['coordinates'])
      ? (data['coordinates'] as LngLat[])
      : waypoints

    return c.json(
      routeResponse(waypoints, coordinates, {
        success: data['success'] === true,
        ...(typeof data['error'] === 'string' ? { error: data['error'] } : {}),
        distance_km:
          typeof data['distance_km'] === 'number' ? data['distance_km'] : 0,
        duration_minutes:
          typeof data['duration_minutes'] === 'number'
            ? data['duration_minutes']
            : 0,
      }),
      200,
    )
  })

  // -------------------------------------------------------------------------
  // Share links — persist a full ArtRoute, serve it back read-only.
  // The :share_id param is format-locked to 10 base36 chars, so this GET can
  // never shadow or collide with the POST /api/route waypoint endpoint.
  // -------------------------------------------------------------------------
  app.post('/api/art/share', jsonValidator(ArtRouteSchema), (c) => {
    const route = c.req.valid('json')
    const shareId = newShareId()
    db.insert(shareId, { ...route, share_id: shareId })
    return c.json({ share_id: shareId }, 201)
  })

  app.get(
    '/api/route/:share_id',
    zValidator('param', ShareIdParamSchema, (result, c) => {
      if (!result.success) {
        return c.json({ error: 'Invalid share id' }, 400)
      }
    }),
    (c) => {
      const { share_id } = c.req.valid('param')
      const route = db.get(share_id)
      if (route === null) {
        return c.json({ error: 'Share not found' }, 404)
      }
      return c.json(route as object)
    },
  )

  return app
}
