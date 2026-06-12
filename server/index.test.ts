/**
 * Gateway tests — run with `bun test`.
 *
 * Strategy: the app factory takes explicit config, so every test builds its
 * own gateway instance via Hono's in-process `app.request()` helper (no port
 * binding for the gateway itself). The only real socket is ONE mock upstream
 * Bun.serve on a random port (port: 0) that plays both brain and kernel;
 * "dead" upstreams point at unused localhost ports.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createApp } from './app.ts'
import { newShareId, openSharesDb } from './db.ts'
import type { SharesStore } from './db.ts'
import {
  ArtPlanSchema,
  ArtRouteSchema,
  StrokeSchema,
  UnitPointSchema,
} from './schemas.ts'

const DEAD_BRAIN = 'http://127.0.0.1:59996'
const DEAD_KERNEL = 'http://127.0.0.1:59995'

const KERNEL_MATCH_RESPONSE = {
  success: true,
  coordinates: [
    [14.4, 50.07],
    [14.42, 50.08],
    [14.45, 50.09],
  ],
  distance_km: 2.5,
  duration_minutes: 30,
}

// --- fixtures ---------------------------------------------------------------

const artRouteFixture = {
  intent: { texts: ['ANNA', 'TOM'], shapes: [], occasion: 'valentines', loop: true },
  plan: {
    strokes: [
      { points: [[0, 0], [0.5, 1], [1, 0]], kind: 'glyph', retrace: false },
      { points: [[1, 0], [0.2, 0.4]], kind: 'connector', retrace: true },
    ],
    order: [0, 1],
    continuous: [[0, 0], [0.5, 1], [1, 0], [0.2, 0.4]],
    segments: [{ kind: 'glyph' }, { kind: 'connector' }],
  },
  placement: {
    bbox: { min_lng: 14.4, min_lat: 50.07, max_lng: 14.45, max_lat: 50.09 },
    rotation_deg: 12.5,
    anchor: { lng: 14.42, lat: 50.08 },
  },
  solve: {
    coordinates: [[14.4, 50.07], [14.42, 50.08], [14.45, 50.09]],
    segments: [{ kind: 'glyph', start: 0, end: 2 }],
    distance_km: 5.2,
    duration_min: 62,
    fidelity: 84,
    success: true,
  },
  gpx_url: null,
  share_id: null,
}

function postJsonReq(path: string, body: unknown) {
  return new Request(`http://gateway${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// --- shared setup -----------------------------------------------------------

let tmpDir: string
let db: SharesStore
let mockUpstream: ReturnType<typeof Bun.serve>
let liveApp: ReturnType<typeof createApp>
let deadApp: ReturnType<typeof createApp>

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'gateway-test-'))
  db = openSharesDb(join(tmpDir, 'shares.sqlite'))

  // One mock upstream playing brain AND kernel.
  mockUpstream = Bun.serve({
    port: 0,
    fetch: async (req) => {
      const path = new URL(req.url).pathname
      switch (path) {
        case '/health':
          return Response.json({ status: 'ok' })
        case '/generate/':
          // Deliberately slower than the test's generate timeout → 504 path.
          await new Promise((r) => setTimeout(r, 300))
          return Response.json({ routes: [] })
        case '/describe/':
          return Response.json({ echoed: await req.json() })
        case '/match':
          return Response.json(KERNEL_MATCH_RESPONSE)
        default:
          return Response.json({ error: 'not found' }, { status: 404 })
      }
    },
  })
  const mockUrl = `http://127.0.0.1:${mockUpstream.port}`

  liveApp = createApp({
    brainUrl: mockUrl,
    kernelUrl: mockUrl,
    db,
    timeouts: { generate: 50 },
  })
  deadApp = createApp({ brainUrl: DEAD_BRAIN, kernelUrl: DEAD_KERNEL, db })
})

afterAll(() => {
  mockUpstream.stop(true)
  db.close()
  rmSync(tmpDir, { recursive: true, force: true })
})

// --- schema unit tests --------------------------------------------------------

describe('schemas', () => {
  test('UnitPoint must be a [number, number] tuple', () => {
    expect(UnitPointSchema.safeParse([0.1, 0.9]).success).toBe(true)
    expect(UnitPointSchema.safeParse([0.1]).success).toBe(false)
    expect(UnitPointSchema.safeParse([0.1, 0.2, 0.3]).success).toBe(false)
    expect(UnitPointSchema.safeParse(['0.1', 0.2]).success).toBe(false)
  })

  test('Stroke rejects unknown kind and short point lists', () => {
    const ok = { points: [[0, 0], [1, 1]], kind: 'shape', retrace: false }
    expect(StrokeSchema.safeParse(ok).success).toBe(true)
    expect(
      StrokeSchema.safeParse({ ...ok, kind: 'squiggle' }).success,
    ).toBe(false)
    expect(
      StrokeSchema.safeParse({ ...ok, points: [[0, 0]] }).success,
    ).toBe(false)
  })

  test('ArtPlan requires strokes, order, continuous', () => {
    expect(ArtPlanSchema.safeParse({ strokes: [] }).success).toBe(false)
    expect(ArtPlanSchema.safeParse(artRouteFixture.plan).success).toBe(true)
  })

  test('ArtRoute fixture parses; corrupt placement is rejected', () => {
    expect(ArtRouteSchema.safeParse(artRouteFixture).success).toBe(true)
    const bad = {
      ...artRouteFixture,
      placement: { ...artRouteFixture.placement, anchor: { lng: 999, lat: 0 } },
    }
    expect(ArtRouteSchema.safeParse(bad).success).toBe(false)
  })
})

// --- request validation -------------------------------------------------------

describe('request validation (400 + flattened errors)', () => {
  test('POST /api/route rejects empty body', async () => {
    const res = await deadApp.request(postJsonReq('/api/route', {}))
    expect(res.status).toBe(400)
    const body = (await res.json()) as any
    expect(body.error).toBe('Invalid request body')
    expect(body.details.fieldErrors).toHaveProperty('waypoints')
  })

  test('POST /api/route rejects a single waypoint', async () => {
    const res = await deadApp.request(
      postJsonReq('/api/route', { waypoints: [[14.4, 50.07]] }),
    )
    expect(res.status).toBe(400)
  })

  test('POST /api/route rejects out-of-range coordinates and bad profile', async () => {
    const badLng = await deadApp.request(
      postJsonReq('/api/route', { waypoints: [[200, 50], [14.4, 50.07]] }),
    )
    expect(badLng.status).toBe(400)

    const badProfile = await deadApp.request(
      postJsonReq('/api/route', {
        waypoints: [[14.4, 50.07], [14.45, 50.09]],
        profile: 'driving',
      }),
    )
    expect(badProfile.status).toBe(400)
  })

  test('POST /api/describe requires description', async () => {
    const res = await deadApp.request(
      postJsonReq('/api/describe', { neighborhood: 'Vinohrady' }),
    )
    expect(res.status).toBe(400)
  })

  test('POST /api/art/compose requires prompt', async () => {
    const res = await deadApp.request(postJsonReq('/api/art/compose', {}))
    expect(res.status).toBe(400)
  })

  test('POST /api/art/share rejects malformed ArtRoute', async () => {
    const bad = structuredClone(artRouteFixture) as any
    bad.plan.strokes[0].kind = 'squiggle'
    const res = await deadApp.request(postJsonReq('/api/art/share', bad))
    expect(res.status).toBe(400)
    const body = (await res.json()) as any
    expect(body.details).toBeDefined()
  })
})

// --- health -------------------------------------------------------------------

describe('GET /health', () => {
  test('reports unreachable upstreams as false', async () => {
    const res = await deadApp.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      status: 'ok',
      service: 'gateway',
      upstreams: { brain: false, kernel: false },
    })
  })

  test('reports live upstreams as true', async () => {
    const res = await liveApp.request('/health')
    expect(await res.json()).toEqual({
      status: 'ok',
      service: 'gateway',
      upstreams: { brain: true, kernel: true },
    })
  })
})

// --- kernel proxy: /api/route ---------------------------------------------------

describe('POST /api/route', () => {
  const waypoints = [
    [14.4, 50.07],
    [14.45, 50.09],
  ]

  test('soft-fallback (HTTP 200) when kernel is down', async () => {
    const res = await deadApp.request(postJsonReq('/api/route', { waypoints }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: false,
      error: 'kernel unreachable',
      coordinates: waypoints,
      distance_km: 0,
      duration_minutes: 0,
      waypoint_count: 2,
      coordinate_count: 2,
    })
  })

  test('passes through kernel match in the legacy response shape', async () => {
    const res = await liveApp.request(
      postJsonReq('/api/route', { waypoints, profile: 'cycling' }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      coordinates: KERNEL_MATCH_RESPONSE.coordinates,
      distance_km: 2.5,
      duration_minutes: 30,
      waypoint_count: 2,
      coordinate_count: 3,
    })
  })
})

// --- brain proxies: transport failure mapping -----------------------------------

describe('brain proxy failure mapping', () => {
  test('502 when brain is unreachable', async () => {
    const res = await deadApp.request(
      postJsonReq('/api/generate', { neighborhood: 'Vinohrady' }),
    )
    expect(res.status).toBe(502)
    const body = (await res.json()) as any
    expect(body.error).toBe('Upstream unreachable')
  })

  test('504 when brain exceeds the timeout budget', async () => {
    // liveApp's generate timeout is 50 ms; the mock /generate/ sleeps 300 ms.
    const res = await liveApp.request(
      postJsonReq('/api/generate', { neighborhood: 'Vinohrady' }),
    )
    expect(res.status).toBe(504)
    const body = (await res.json()) as any
    expect(body.error).toBe('Upstream timeout')
  })

  test('describe passes the validated body through to the brain', async () => {
    const res = await liveApp.request(
      postJsonReq('/api/describe', {
        description: 'a heart in Vinohrady',
        max_distance_km: 8,
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.echoed.description).toBe('a heart in Vinohrady')
  })
})

// --- share round-trip ------------------------------------------------------------

describe('share links', () => {
  test('newShareId emits 10-char base36 ids', () => {
    for (let i = 0; i < 50; i++) {
      expect(newShareId()).toMatch(/^[0-9a-z]{10}$/)
    }
  })

  test('POST /api/art/share → GET /api/route/:share_id round-trip', async () => {
    const post = await deadApp.request(
      postJsonReq('/api/art/share', artRouteFixture),
    )
    expect(post.status).toBe(201)
    const { share_id } = (await post.json()) as { share_id: string }
    expect(share_id).toMatch(/^[0-9a-z]{10}$/)

    const get = await deadApp.request(`/api/route/${share_id}`)
    expect(get.status).toBe(200)
    const stored = (await get.json()) as any
    expect(stored.share_id).toBe(share_id)
    expect(stored.plan).toEqual(artRouteFixture.plan)
    expect(stored.placement).toEqual(artRouteFixture.placement)
    expect(stored.solve).toEqual(artRouteFixture.solve)
    expect(stored.intent.texts).toEqual(['ANNA', 'TOM'])
  })

  test('share persists across store re-open (same sqlite file)', async () => {
    const path = join(tmpDir, 'reopen.sqlite')
    const first = openSharesDb(path)
    const id = newShareId()
    first.insert(id, { hello: 'world' })
    first.close()

    const second = openSharesDb(path)
    expect(second.get(id)).toEqual({ hello: 'world' })
    second.close()
  })

  test('GET unknown (but well-formed) id → 404', async () => {
    const res = await deadApp.request('/api/route/zzzzzzzzzz')
    expect(res.status).toBe(404)
  })

  test('GET malformed id → 400 (never collides with POST /api/route)', async () => {
    const short = await deadApp.request('/api/route/abc')
    expect(short.status).toBe(400)
    const uppercase = await deadApp.request('/api/route/ABCDEFGHIJ')
    expect(uppercase.status).toBe(400)
  })
})
