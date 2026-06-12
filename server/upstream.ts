/**
 * Ghost Tracks gateway — upstream HTTP helpers.
 *
 * The gateway talks to two upstreams (Python brain, Scala kernel). All calls
 * share the same failure taxonomy so routes can map it to HTTP semantics:
 *
 *   timeout      → 504 Gateway Timeout   (upstream alive but too slow)
 *   unreachable  → 502 Bad Gateway       (connection refused / DNS / reset)
 *
 * Teaching note: `AbortSignal.timeout(ms)` is the modern, leak-free way to
 * bound a fetch — no manual AbortController + setTimeout/clearTimeout dance.
 * It rejects with a DOMException named "TimeoutError", which is how we tell
 * slowness apart from connection failure.
 */

export type UpstreamResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; kind: 'timeout' | 'unreachable'; message: string }

function isTimeoutError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'TimeoutError' ||
      (err.name === 'AbortError' && /time/i.test(err.message)))
  )
}

/** POST a JSON body to an upstream and parse the JSON reply, bounded by a timeout. */
export async function postJson(
  url: string,
  body: unknown,
  timeoutMs: number,
): Promise<UpstreamResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const data: unknown = await res
      .json()
      .catch(() => ({ error: 'upstream returned non-JSON response' }))
    return { ok: true, status: res.status, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      kind: isTimeoutError(err) ? 'timeout' : 'unreachable',
      message,
    }
  }
}

/**
 * Liveness probe for /health: any HTTP response (even 404) proves the
 * process is up and accepting connections; only connect errors / timeouts
 * count as unreachable.
 */
export async function isReachable(
  baseUrl: string,
  timeoutMs = 1000,
): Promise<boolean> {
  try {
    await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    return true
  } catch {
    return false
  }
}
