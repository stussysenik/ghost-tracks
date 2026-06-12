/**
 * API client — fetch is mocked; verifies wrappers and error normalization.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, composeArt, getSharedRoute, solveArt } from './api';
import { artRoute, composeResponse, placement, plan } from './test/fixtures';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(impl: typeof fetch) {
  const spy = vi.fn(impl);
  vi.stubGlobal('fetch', spy);
  return spy;
}

describe('composeArt', () => {
  it('POSTs the prompt and returns the parsed response', async () => {
    const spy = stubFetch(async () => new Response(JSON.stringify(composeResponse), { status: 200 }));

    const out = await composeArt({ prompt: 'heart please', distance_km: 8 });
    expect(out.plan.continuous).toHaveLength(4);

    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/art/compose');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ prompt: 'heart please', distance_km: 8 });
  });

  it('normalizes HTTP errors into ApiError with server detail', async () => {
    stubFetch(
      async () => new Response(JSON.stringify({ error: 'prompt too vague' }), { status: 422 })
    );

    const err = await composeArt({ prompt: 'x' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(422);
    expect((err as ApiError).message).toBe('prompt too vague');
  });

  it('normalizes network failures into ApiError(status 0)', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const err = await composeArt({ prompt: 'x' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(0);
    expect((err as ApiError).message).toMatch(/gateway/i);
  });

  it('re-throws aborts untouched so callers can ignore them', async () => {
    stubFetch(async () => {
      throw new DOMException('The operation was aborted.', 'AbortError');
    });

    const err = await composeArt({ prompt: 'x' }, new AbortController().signal).catch(
      (e: unknown) => e
    );
    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe('AbortError');
  });
});

describe('solveArt / getSharedRoute', () => {
  it('solveArt POSTs plan + placement + opts', async () => {
    const spy = stubFetch(async () => new Response(JSON.stringify(artRoute), { status: 200 }));

    const out = await solveArt({ plan, placement, opts: { close_loop: true } });
    expect(out.solve.fidelity).toBe(84);
    expect((spy.mock.calls[0] as [string, RequestInit])[0]).toBe('/api/art/solve');
  });

  it('getSharedRoute encodes the id and GETs', async () => {
    const spy = stubFetch(async () => new Response(JSON.stringify(artRoute), { status: 200 }));

    await getSharedRoute('abc 123');
    expect((spy.mock.calls[0] as [string, RequestInit])[0]).toBe('/api/route/abc%20123');
  });
});
