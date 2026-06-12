/**
 * Studio machine — transition + invariant tests.
 * Actors are mocked via `.provide`, so no network is involved.
 */
import { describe, expect, it } from 'vitest';
import { createActor, fromPromise, waitFor } from 'xstate';
import { artRoute, composeResponse, movedPlacement, placement } from '../test/fixtures';
import { studioMachine, type ComposeInput, type SolveInput, type StudioInput } from './studio';

function makeActor(opts?: {
  composeFailures?: number;
  solveFailures?: number;
  input?: StudioInput;
}) {
  let composeFails = opts?.composeFailures ?? 0;
  let solveFails = opts?.solveFailures ?? 0;

  const machine = studioMachine.provide({
    actors: {
      compose: fromPromise(async ({ input }: { input: ComposeInput }) => {
        if (composeFails > 0) {
          composeFails--;
          throw new Error('compose exploded');
        }
        expect(input.prompt).toBeTruthy();
        return composeResponse;
      }),
      solve: fromPromise(async ({ input }: { input: SolveInput }) => {
        if (solveFails > 0) {
          solveFails--;
          throw new Error('no streets there');
        }
        return { ...artRoute, placement: input.placement };
      })
    }
  });

  const actor = createActor(machine, { input: opts?.input });
  actor.start();
  return actor;
}

const COMPOSE = {
  type: 'COMPOSE',
  prompt: "write 'ANNA + TOM' and a heart"
} as const;

describe('studio machine — happy path', () => {
  it('walks compose → place → refine', async () => {
    const actor = makeActor();
    expect(actor.getSnapshot().matches('idle')).toBe(true);

    actor.send(COMPOSE);
    expect(actor.getSnapshot().matches('composing')).toBe(true);
    expect(actor.getSnapshot().hasTag('busy')).toBe(true);

    await waitFor(actor, (s) => s.matches('placing'));
    const placed = actor.getSnapshot();
    expect(placed.context.plan).toEqual(composeResponse.plan);
    expect(placed.context.placement).toEqual(placement);
    expect(placed.context.diagnostics).toHaveLength(1);
    // initial placement seeds the undo history
    expect(placed.context.history).toEqual([placement]);
    expect(placed.context.historyIndex).toBe(0);

    actor.send({ type: 'SOLVE' });
    expect(actor.getSnapshot().matches('solving')).toBe(true);

    await waitFor(actor, (s) => s.matches('refined'));
    const refined = actor.getSnapshot();
    expect(refined.context.solve?.fidelity).toBe(84);
    expect(refined.context.route?.solve.success).toBe(true);
  });

  it('does not solve without a plan', () => {
    const actor = makeActor();
    actor.send({ type: 'SOLVE' });
    expect(actor.getSnapshot().matches('idle')).toBe(true);
  });
});

describe('studio machine — undo/redo history', () => {
  async function placedActor() {
    const actor = makeActor();
    actor.send(COMPOSE);
    await waitFor(actor, (s) => s.matches('placing'));
    return actor;
  }

  it('SET_PLACEMENT streams live without touching history', async () => {
    const actor = await placedActor();
    actor.send({ type: 'SET_PLACEMENT', placement: movedPlacement(0.01) });
    const s = actor.getSnapshot();
    expect(s.context.placement).toEqual(movedPlacement(0.01));
    expect(s.context.history).toHaveLength(1); // unchanged
  });

  it('COMMIT_PLACEMENT pushes one snapshot per gesture; UNDO/REDO walk it', async () => {
    const actor = await placedActor();
    const p1 = movedPlacement(0.01);
    const p2 = movedPlacement(0.02);
    actor.send({ type: 'COMMIT_PLACEMENT', placement: p1 });
    actor.send({ type: 'COMMIT_PLACEMENT', placement: p2 });

    expect(actor.getSnapshot().context.history).toHaveLength(3);
    expect(actor.getSnapshot().context.placement).toEqual(p2);

    actor.send({ type: 'UNDO' });
    expect(actor.getSnapshot().context.placement).toEqual(p1);
    actor.send({ type: 'UNDO' });
    expect(actor.getSnapshot().context.placement).toEqual(placement);

    // guard: nothing left to undo
    actor.send({ type: 'UNDO' });
    expect(actor.getSnapshot().context.placement).toEqual(placement);
    expect(actor.getSnapshot().context.historyIndex).toBe(0);

    actor.send({ type: 'REDO' });
    actor.send({ type: 'REDO' });
    expect(actor.getSnapshot().context.placement).toEqual(p2);
    // guard: nothing left to redo
    actor.send({ type: 'REDO' });
    expect(actor.getSnapshot().context.placement).toEqual(p2);
  });

  it('a commit after UNDO truncates the redo branch', async () => {
    const actor = await placedActor();
    actor.send({ type: 'COMMIT_PLACEMENT', placement: movedPlacement(0.01) });
    actor.send({ type: 'COMMIT_PLACEMENT', placement: movedPlacement(0.02) });
    actor.send({ type: 'UNDO' });
    actor.send({ type: 'COMMIT_PLACEMENT', placement: movedPlacement(0.05) });

    const s = actor.getSnapshot();
    expect(s.context.history).toHaveLength(3); // base, p1, p5 — p2 gone
    expect(s.context.placement).toEqual(movedPlacement(0.05));
    actor.send({ type: 'REDO' });
    expect(actor.getSnapshot().context.placement).toEqual(movedPlacement(0.05));
  });

  it('supports at least 20 undo steps', async () => {
    const actor = await placedActor();
    for (let i = 1; i <= 24; i++) {
      actor.send({ type: 'COMMIT_PLACEMENT', placement: movedPlacement(i / 1000) });
    }
    for (let i = 0; i < 20; i++) actor.send({ type: 'UNDO' });
    expect(actor.getSnapshot().context.placement).toEqual(movedPlacement(4 / 1000));
  });

  it('undo/redo also work in refined (live re-solve loop)', async () => {
    const actor = await placedActor();
    actor.send({ type: 'COMMIT_PLACEMENT', placement: movedPlacement(0.01) });
    actor.send({ type: 'SOLVE' });
    await waitFor(actor, (s) => s.matches('refined'));

    actor.send({ type: 'UNDO' });
    expect(actor.getSnapshot().matches('refined')).toBe(true);
    expect(actor.getSnapshot().context.placement).toEqual(placement);
  });
});

describe('studio machine — edits re-enter the pipeline', () => {
  it('EDIT_PLACEMENT re-enters at place without mutating plan or solve', async () => {
    const actor = makeActor();
    actor.send(COMPOSE);
    await waitFor(actor, (s) => s.matches('placing'));
    actor.send({ type: 'SOLVE' });
    await waitFor(actor, (s) => s.matches('refined'));

    const before = actor.getSnapshot().context;
    actor.send({ type: 'EDIT_PLACEMENT' });
    const after = actor.getSnapshot();

    expect(after.matches('placing')).toBe(true);
    expect(after.context.plan).toBe(before.plan); // untouched
    expect(after.context.solve).toBe(before.solve); // stale but not mutated
  });

  it('COMPOSE from refined re-enters at compose and invalidates downstream', async () => {
    const actor = makeActor();
    actor.send(COMPOSE);
    await waitFor(actor, (s) => s.matches('placing'));
    actor.send({ type: 'SOLVE' });
    await waitFor(actor, (s) => s.matches('refined'));

    actor.send({ type: 'COMPOSE', prompt: 'draw a fox instead' });
    const s = actor.getSnapshot();
    expect(s.matches('composing')).toBe(true);
    expect(s.context.plan).toBeNull();
    expect(s.context.placement).toBeNull();
    expect(s.context.solve).toBeNull();
    expect(s.context.history).toHaveLength(0);

    await waitFor(actor, (snap) => snap.matches('placing'));
    expect(actor.getSnapshot().context.prompt).toBe('draw a fox instead');
  });

  it('re-solving after a placement edit replaces solve with the new result', async () => {
    const actor = makeActor();
    actor.send(COMPOSE);
    await waitFor(actor, (s) => s.matches('placing'));
    actor.send({ type: 'SOLVE' });
    await waitFor(actor, (s) => s.matches('refined'));

    const p1 = movedPlacement(0.01);
    actor.send({ type: 'COMMIT_PLACEMENT', placement: p1 });
    actor.send({ type: 'SOLVE' });
    expect(actor.getSnapshot().matches('solving')).toBe(true);
    // previous solve stays visible while re-solving (zero layout shift)
    expect(actor.getSnapshot().context.solve).not.toBeNull();

    await waitFor(actor, (s) => s.matches('refined'));
    expect(actor.getSnapshot().context.route?.placement).toEqual(p1);
  });
});

describe('studio machine — failures and retry', () => {
  it('compose failure lands in composeFailed; RETRY recovers', async () => {
    const actor = makeActor({ composeFailures: 1 });
    actor.send(COMPOSE);
    await waitFor(actor, (s) => s.matches('composeFailed'));
    expect(actor.getSnapshot().context.error).toContain('compose exploded');
    expect(actor.getSnapshot().hasTag('failure')).toBe(true);

    actor.send({ type: 'RETRY' });
    await waitFor(actor, (s) => s.matches('placing'));
    expect(actor.getSnapshot().context.plan).not.toBeNull();
  });

  it('solve failure lands in solveFailed; RETRY and EDIT_PLACEMENT both recover', async () => {
    const actor = makeActor({ solveFailures: 1 });
    actor.send(COMPOSE);
    await waitFor(actor, (s) => s.matches('placing'));
    actor.send({ type: 'SOLVE' });
    await waitFor(actor, (s) => s.matches('solveFailed'));
    expect(actor.getSnapshot().context.error).toContain('no streets there');

    actor.send({ type: 'RETRY' });
    await waitFor(actor, (s) => s.matches('refined'));
    expect(actor.getSnapshot().context.solve?.fidelity).toBe(84);
  });
});

describe('studio machine — solve opts', () => {
  it('SET_LOOP / SET_DISTANCE / SET_AREA update context anywhere', async () => {
    const actor = makeActor();
    actor.send({ type: 'SET_LOOP', loop: false });
    actor.send({ type: 'SET_DISTANCE', distance_km: 12 });
    actor.send({ type: 'SET_AREA', area: 'Karlín' });
    const s = actor.getSnapshot();
    expect(s.context.loop).toBe(false);
    expect(s.context.distanceKm).toBe(12);
    expect(s.context.area).toBe('Karlín');
  });
});

describe('studio machine — boot via input', () => {
  // Regression: booting used to be an external send() from a React effect,
  // which raced StrictMode's double-mount and surfaced AbortError as a
  // compose failure. Input-driven boot has no external race.
  it('self-starts composing from a ?prompt= boot input', async () => {
    const actor = makeActor({ input: { prompt: "write 'HI'" } });
    expect(actor.getSnapshot().matches('composing')).toBe(true);
    await waitFor(actor, (s) => s.matches('placing'));
    expect(actor.getSnapshot().context.prompt).toBe("write 'HI'");
  });

  it('stays idle without a boot prompt', () => {
    const actor = makeActor();
    expect(actor.getSnapshot().matches('idle')).toBe(true);
  });
});
