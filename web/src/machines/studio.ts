/**
 * Studio machine — the ONE machine driving the three-stage progressive flow:
 *
 *   idle → composing → placing → solving → refined
 *                ↘ composeFailed      ↘ solveFailed   (retryable)
 *
 * Invariants (SPEC §6.3):
 *  - UI state is a pure function of (plan, placement, solve) in context.
 *  - Editing events RE-ENTER the pipeline at `place` or `compose`;
 *    they never mutate downstream state in-place — downstream is recomputed.
 *  - Undo/redo is a history of {placement} snapshots (≥ 20 steps) with
 *    explicit UNDO/REDO events; gizmo gestures stream SET_PLACEMENT (live,
 *    no history) and finish with COMMIT_PLACEMENT (one snapshot/gesture).
 *
 * Ported from the legacy Svelte generation machine
 * (src/lib/machines/generation.ts) and extended for the art pipeline.
 */
import { assign, fromPromise, setup } from 'xstate';
import {
  composeArt,
  solveArt,
  type ComposeResponse,
  ApiError
} from '../api';
import type {
  ArtPlan,
  ArtRoute,
  Diagnostic,
  Intent,
  Placement,
  SolveResult
} from '../types';

const HISTORY_LIMIT = 50; // spec requires ≥ 20

/** Boot input — lets the machine self-start composing from a ?prompt= URL.
 *  Booting via input (not an external send() from a React effect) is what
 *  keeps StrictMode's double-mount from racing the actor lifecycle. */
export interface StudioInput {
  prompt?: string;
  area?: string;
  distance_km?: number;
}

export interface StudioContext {
  // inputs
  prompt: string;
  /** true once the boot prompt has been consumed — the idle `always` fires at most once */
  booted: boolean;
  area: string | null;
  distanceKm: number | null;
  loop: boolean;
  // pipeline artifacts — state is a function of these three
  intent: Intent | null;
  plan: ArtPlan | null;
  placement: Placement | null;
  solve: SolveResult | null;
  // presentation extras
  previewSvg: string | null;
  diagnostics: Diagnostic[];
  route: ArtRoute | null;
  error: string | null;
  // undo/redo
  history: Placement[];
  historyIndex: number;
}

export type StudioEvent =
  | { type: 'COMPOSE'; prompt: string; area?: string; distance_km?: number }
  | { type: 'SET_PLACEMENT'; placement: Placement }
  | { type: 'COMMIT_PLACEMENT'; placement: Placement }
  | { type: 'SOLVE' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'EDIT_PLACEMENT' }
  | { type: 'SET_LOOP'; loop: boolean }
  | { type: 'SET_DISTANCE'; distance_km: number }
  | { type: 'SET_AREA'; area: string }
  | { type: 'RETRY' };

export interface ComposeInput {
  prompt: string;
  area?: string;
  distance_km?: number;
}

export interface SolveInput {
  plan: ArtPlan;
  placement: Placement;
  loop: boolean;
  distance_km?: number;
}

function pushHistory(ctx: StudioContext, placement: Placement) {
  // Truncate any redo branch, append, cap length.
  const base = ctx.history.slice(0, ctx.historyIndex + 1);
  const next = [...base, placement].slice(-HISTORY_LIMIT);
  return { history: next, historyIndex: next.length - 1 };
}

export const studioMachine = setup({
  types: {
    context: {} as StudioContext,
    events: {} as StudioEvent,
    input: {} as StudioInput | undefined
  },
  actors: {
    compose: fromPromise<ComposeResponse, ComposeInput>(({ input, signal }) =>
      composeArt(
        {
          prompt: input.prompt,
          area: input.area,
          distance_km: input.distance_km
        },
        signal
      )
    ),
    solve: fromPromise<ArtRoute, SolveInput>(({ input, signal }) =>
      solveArt(
        {
          plan: input.plan,
          placement: input.placement,
          opts: {
            profile: 'foot',
            close_loop: input.loop,
            distance_km: input.distance_km
          }
        },
        signal
      )
    )
  },
  actions: {
    assignComposeRequest: assign(({ event }) => {
      if (event.type !== 'COMPOSE') return {};
      return {
        prompt: event.prompt,
        booted: true,
        area: event.area ?? null,
        distanceKm: event.distance_km ?? null,
        // re-entering at compose: downstream state is invalidated, not mutated
        intent: null,
        plan: null,
        placement: null,
        solve: null,
        route: null,
        previewSvg: null,
        diagnostics: [],
        error: null,
        history: [],
        historyIndex: -1
      };
    }),
    assignLivePlacement: assign(({ event }) =>
      event.type === 'SET_PLACEMENT' ? { placement: event.placement } : {}
    ),
    commitPlacement: assign(({ context, event }) => {
      if (event.type !== 'COMMIT_PLACEMENT') return {};
      return { placement: event.placement, ...pushHistory(context, event.placement) };
    }),
    undo: assign(({ context }) => {
      if (context.historyIndex <= 0) return {};
      const i = context.historyIndex - 1;
      return { historyIndex: i, placement: context.history[i] };
    }),
    redo: assign(({ context }) => {
      if (context.historyIndex >= context.history.length - 1) return {};
      const i = context.historyIndex + 1;
      return { historyIndex: i, placement: context.history[i] };
    })
  },
  guards: {
    canUndo: ({ context }) => context.historyIndex > 0,
    canRedo: ({ context }) => context.historyIndex < context.history.length - 1,
    hasPlan: ({ context }) => context.plan !== null && context.placement !== null,
    hasBootPrompt: ({ context }) => !context.booted && context.prompt.trim() !== '',
    // An AbortError reaching onError is lifecycle noise (StrictMode teardown
    // persisting a mid-flight snapshot) — a user cancellation re-enters the
    // invoking state and never surfaces here.
    wasAborted: ({ event }) =>
      (event as { error?: { name?: string } }).error?.name === 'AbortError'
  }
}).createMachine({
  id: 'studio',
  initial: 'idle',
  context: ({ input }) => ({
    prompt: input?.prompt ?? '',
    booted: false,
    area: input?.area ?? null,
    distanceKm: input?.distance_km ?? null,
    loop: true,
    intent: null,
    plan: null,
    placement: null,
    solve: null,
    previewSvg: null,
    diagnostics: [],
    route: null,
    error: null,
    history: [],
    historyIndex: -1
  }),
  on: {
    // Recompose is allowed from anywhere — full re-entry at `compose`.
    COMPOSE: { target: '.composing', actions: 'assignComposeRequest' },
    SET_LOOP: { actions: assign(({ event }) => ({ loop: event.loop })) },
    SET_DISTANCE: {
      actions: assign(({ event }) => ({ distanceKm: event.distance_km }))
    },
    SET_AREA: { actions: assign(({ event }) => ({ area: event.area })) }
  },
  states: {
    idle: {
      // Self-boot: a prompt passed as machine input starts composing without
      // any external send() — see StudioInput.
      always: {
        guard: 'hasBootPrompt',
        target: 'composing',
        actions: assign({ booted: true })
      }
    },

    composing: {
      tags: ['busy'],
      invoke: {
        src: 'compose',
        input: ({ context }) => ({
          prompt: context.prompt,
          area: context.area ?? undefined,
          distance_km: context.distanceKm ?? undefined
        }),
        onDone: {
          target: 'placing',
          actions: assign(({ event }) => ({
            intent: event.output.intent,
            plan: event.output.plan,
            placement: event.output.placement,
            previewSvg: event.output.preview_svg ?? null,
            diagnostics: event.output.diagnostics ?? [],
            error: null,
            history: [event.output.placement],
            historyIndex: 0
          }))
        },
        onError: [
          // Teardown abort — re-invoke rather than surface a fake failure.
          { guard: 'wasAborted', target: 'composing', reenter: true },
          {
            target: 'composeFailed',
            actions: assign(({ event }) => ({
              error:
                event.error instanceof ApiError || event.error instanceof Error
                  ? event.error.message
                  : 'Compose failed'
            }))
          }
        ]
      }
    },

    composeFailed: {
      tags: ['failure'],
      on: {
        RETRY: 'composing'
      }
    },

    placing: {
      on: {
        SET_PLACEMENT: { actions: 'assignLivePlacement' },
        COMMIT_PLACEMENT: { actions: 'commitPlacement' },
        UNDO: { guard: 'canUndo', actions: 'undo' },
        REDO: { guard: 'canRedo', actions: 'redo' },
        SOLVE: { target: 'solving', guard: 'hasPlan' }
      }
    },

    solving: {
      tags: ['busy'],
      invoke: {
        src: 'solve',
        input: ({ context }) => ({
          plan: context.plan!,
          placement: context.placement!,
          loop: context.loop,
          distance_km: context.distanceKm ?? undefined
        }),
        onDone: {
          target: 'refined',
          actions: assign(({ context, event }) => ({
            solve: event.output.solve,
            // /art/solve only receives (plan, placement) — it cannot know the
            // intent. Graft the machine's intent on so shares/GPX keep the name.
            route: { ...event.output, intent: context.intent ?? event.output.intent },
            error: null
          }))
        },
        onError: [
          { guard: 'wasAborted', target: 'solving', reenter: true },
          {
            target: 'solveFailed',
            actions: assign(({ event }) => ({
              error:
                event.error instanceof ApiError || event.error instanceof Error
                  ? event.error.message
                  : 'Solve failed'
            }))
          }
        ]
      },
      on: {
        // Editing mid-solve: keep streaming; a re-SOLVE re-enters and the
        // stale request's AbortSignal fires (fromPromise cancellation).
        SET_PLACEMENT: { actions: 'assignLivePlacement' },
        COMMIT_PLACEMENT: { actions: 'commitPlacement' },
        SOLVE: { target: 'solving', reenter: true },
        UNDO: { guard: 'canUndo', actions: 'undo' },
        REDO: { guard: 'canRedo', actions: 'redo' }
      }
    },

    solveFailed: {
      tags: ['failure'],
      on: {
        RETRY: 'solving',
        EDIT_PLACEMENT: 'placing',
        SET_PLACEMENT: { actions: 'assignLivePlacement' },
        COMMIT_PLACEMENT: { actions: 'commitPlacement' },
        UNDO: { guard: 'canUndo', actions: 'undo' },
        REDO: { guard: 'canRedo', actions: 'redo' },
        SOLVE: 'solving'
      }
    },

    refined: {
      on: {
        // Gizmo edits in refine: live updates + history commits; the view
        // layer debounces 400 ms and sends SOLVE for the ≤2 s live re-solve.
        SET_PLACEMENT: { actions: 'assignLivePlacement' },
        COMMIT_PLACEMENT: { actions: 'commitPlacement' },
        UNDO: { guard: 'canUndo', actions: 'undo' },
        REDO: { guard: 'canRedo', actions: 'redo' },
        SOLVE: 'solving',
        // Re-enter at `place` — solve result stays visible but is stale
        // until the next SOLVE recomputes it (never mutated in-place).
        EDIT_PLACEMENT: 'placing'
      }
    }
  }
});

export type StudioMachine = typeof studioMachine;
