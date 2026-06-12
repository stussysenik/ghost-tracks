/**
 * Studio — the core screen. Three-stage progressive flow driven by ONE
 * XState machine (machines/studio.ts):
 *
 *   Compose  prompt → artwork preview + legend + diagnostics
 *   Place    full-bleed map + placement gizmo + presets
 *   Refine   solved route by provenance + fidelity meter + live re-solve
 *            (400 ms debounce) + undo/redo (⌘Z/⇧⌘Z) + export bar
 */
import { useMachine } from '@xstate/react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { ArtPreview } from '../components/ArtPreview';
import { ExportBar } from '../components/ExportBar';
import { FidelityMeter } from '../components/FidelityMeter';
import { FitBounds, MapView, RouteLayers } from '../components/MapView';
import { PlacementGizmo } from '../components/PlacementGizmo';
import { Presets } from '../components/Presets';
import { BusyVeil, Button, Card, Chip, ErrorPanel, Kicker, Metric, Skeleton } from '../components/ui';
import { project } from '../geo/project';
import { saveRecent } from '../lib/storage';
import { studioMachine } from '../machines/studio';
import { theme as tokens } from '../theme';
import type { Diagnostic } from '../types';

type Stage = 'compose' | 'place' | 'refine';

const Shell = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const TopBar = styled.header`
  position: relative;
  z-index: ${({ theme }) => theme.z.bar};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.md};
  padding: ${({ theme }) => `${theme.space.sm} ${theme.space.lg}`};
  background: rgba(250, 250, 248, 0.88);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid ${({ theme }) => theme.color.line};
`;

const StageNav = styled.nav`
  display: flex;
  gap: ${({ theme }) => theme.space.xs};
`;

const StageTab = styled.button<{ $active: boolean; $done: boolean }>`
  all: unset;
  box-sizing: border-box;
  position: relative;
  padding: 0.375rem 0.75rem;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.type.small};
  font-weight: ${({ $active }) => ($active ? 650 : 450)};
  color: ${({ $active, $done, theme }) =>
    $active ? theme.color.coal : $done ? theme.color.slate : theme.color.mist};
  cursor: ${({ $done }) => ($done ? 'pointer' : 'default')};
  transition: color 180ms ${({ theme }) => theme.ease.out};

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.ink};
  }
`;

const Underline = styled(motion.div)`
  position: absolute;
  left: 0.75rem;
  right: 0.75rem;
  bottom: 1px;
  height: 2px;
  border-radius: 2px;
  background: ${({ theme }) => theme.color.ink};
`;

const Body = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
`;

const FloatingPanel = styled(motion.aside)`
  position: absolute;
  top: ${({ theme }) => theme.space.md};
  left: ${({ theme }) => theme.space.md};
  bottom: ${({ theme }) => theme.space.md};
  width: min(360px, calc(100vw - 2rem));
  z-index: ${({ theme }) => theme.z.panel};
  display: flex;
  flex-direction: column;
  pointer-events: none;

  > * {
    pointer-events: auto;
  }
`;

const PanelCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.md};
  padding: ${({ theme }) => theme.space.md};
  max-height: 100%;
  overflow-y: auto;
`;

const ComposeWrap = styled.main`
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: ${({ theme }) => `${theme.space.xl} ${theme.space.lg}`};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.md};
`;

const PromptBar = styled.form`
  display: flex;
  gap: ${({ theme }) => theme.space.sm};
  background: ${({ theme }) => theme.color.surface};
  border: 1px solid ${({ theme }) => theme.color.line};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: ${({ theme }) => theme.space.xs};

  &:focus-within {
    border-color: ${({ theme }) => theme.color.ink};
  }

  input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    padding: 0.375rem 0.625rem;
    font-size: ${({ theme }) => theme.type.small};
  }
`;

const DiagChip = styled.div<{ $level: Diagnostic['level'] }>`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0.5rem 0.75rem;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.type.small};
  border: 1px solid
    ${({ $level }) => ($level === 'error' ? '#fecaca' : $level === 'warn' ? '#fde68a' : '#e0e7ff')};
  background: ${({ $level }) =>
    $level === 'error' ? '#fef2f2' : $level === 'warn' ? '#fffbeb' : '#eef2ff'};

  em {
    font-style: normal;
    font-weight: 600;
    color: ${({ theme }) => theme.color.inkDeep};
  }
`;

function Diagnostics({ items }: { items: Diagnostic[] }) {
  if (items.length === 0) return null;
  return (
    <div className="stack gap-2" aria-label="Diagnostics">
      {items.map((d, i) => (
        <DiagChip key={i} $level={d.level}>
          {d.message}
          {d.action ? <em>→ {d.action}</em> : null}
        </DiagChip>
      ))}
    </div>
  );
}

const panelSpring = { type: 'spring', stiffness: 380, damping: 34 } as const;

export function Studio() {
  const [searchParams] = useSearchParams();
  // Boot via machine input: arriving with ?prompt= self-starts composing.
  // (An external send() from an effect races StrictMode's double-mount —
  // the aborted first fetch used to surface as a fake compose failure.)
  const [state, send] = useMachine(studioMachine, {
    input: { prompt: searchParams.get('prompt') ?? undefined }
  });
  const { context: ctx } = state;
  const [promptDraft, setPromptDraft] = useState(searchParams.get('prompt') ?? '');
  const lastSolveKey = useRef<string | null>(null);

  const stage: Stage = state.matches('placing')
    ? 'place'
    : state.matches('solving') || state.matches('refined') || state.matches('solveFailed')
      ? 'refine'
      : 'compose';
  const busy = state.hasTag('busy');
  const canUndo = ctx.historyIndex > 0;
  const canRedo = ctx.historyIndex < ctx.history.length - 1;

  // Keyboard undo/redo — ⌘Z / ⇧⌘Z (also ctrl for non-mac).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const target = e.target as HTMLElement | null;
      if (target && /^(input|textarea)$/i.test(target.tagName)) return;
      e.preventDefault();
      send({ type: e.shiftKey ? 'REDO' : 'UNDO' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [send]);

  // Live re-solve: once in the refine loop, any placement/opts change
  // re-solves after a 400 ms debounce (spec: visible result ≤ 2 s).
  const inRefineLoop =
    state.matches('refined') || state.matches('solveFailed') || state.matches('solving');
  const solveKey = JSON.stringify({ p: ctx.placement, l: ctx.loop, d: ctx.distanceKm });
  useEffect(() => {
    if (!inRefineLoop || !ctx.placement) return;
    if (lastSolveKey.current === null) {
      lastSolveKey.current = solveKey; // first entry — already solved/solving
      return;
    }
    if (lastSolveKey.current === solveKey) return;
    const t = setTimeout(() => {
      lastSolveKey.current = solveKey;
      send({ type: 'SOLVE' });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inRefineLoop, solveKey, send]);

  // Persist to "recent creations" once a solve lands.
  useEffect(() => {
    if (state.matches('refined') && ctx.route && ctx.prompt) {
      saveRecent({
        prompt: ctx.prompt,
        at: Date.now(),
        fidelity: ctx.route.solve.fidelity,
        distance_km: ctx.route.solve.distance_km
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.value]);

  const onPromptSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!promptDraft.trim()) return;
    lastSolveKey.current = null;
    send({
      type: 'COMPOSE',
      prompt: promptDraft.trim(),
      area: ctx.area ?? undefined,
      distance_km: ctx.distanceKm ?? undefined
    });
  };

  const presets = ctx.plan && (
    <Presets
      distanceKm={ctx.distanceKm}
      loop={ctx.loop}
      area={ctx.area}
      onDistance={(km) => send({ type: 'SET_DISTANCE', distance_km: km })}
      onLoop={(loop) => send({ type: 'SET_LOOP', loop })}
      onArea={(area) => {
        // Area edit re-enters at compose — downstream is recomputed.
        send({ type: 'SET_AREA', area });
        if (ctx.prompt) {
          lastSolveKey.current = null;
          send({ type: 'COMPOSE', prompt: ctx.prompt, area, distance_km: ctx.distanceKm ?? undefined });
        }
      }}
    />
  );

  const previewTrace = ctx.plan && ctx.placement ? project(ctx.plan, ctx.placement) : null;
  const solved = ctx.solve;

  return (
    <Shell>
      <TopBar>
        <Link to="/" className="row gap-2 no-underline" aria-label="Ghost Tracks home">
          <img src="/ghost.svg" alt="" width={20} height={20} />
          <span className="f-small font-700 tracking-tight">Ghost Tracks</span>
        </Link>

        <StageNav aria-label="Stages">
          {(['compose', 'place', 'refine'] as const).map((s, i) => {
            const reachable =
              s === 'compose' || (s === 'place' && ctx.plan !== null) || (s === 'refine' && solved !== null);
            return (
              <StageTab
                key={s}
                $active={stage === s}
                $done={reachable && stage !== s}
                disabled={!reachable}
                onClick={() => {
                  if (s === 'place' && ctx.plan) send({ type: 'EDIT_PLACEMENT' });
                  if (s === 'refine' && ctx.plan && stage === 'place') send({ type: 'SOLVE' });
                }}
              >
                {i + 1} · {s[0].toUpperCase() + s.slice(1)}
                {stage === s && <Underline layoutId="stage-underline" transition={panelSpring} />}
              </StageTab>
            );
          })}
        </StageNav>

        <div className="row gap-1">
          <Button
            $variant="quiet"
            onClick={() => send({ type: 'UNDO' })}
            disabled={!canUndo}
            aria-label="Undo (Cmd+Z)"
            title="Undo ⌘Z"
          >
            ↩
          </Button>
          <Button
            $variant="quiet"
            onClick={() => send({ type: 'REDO' })}
            disabled={!canRedo}
            aria-label="Redo (Shift+Cmd+Z)"
            title="Redo ⇧⌘Z"
          >
            ↪
          </Button>
        </div>
      </TopBar>

      <Body>
        {stage === 'compose' ? (
          <ComposeWrap>
            <Kicker>Compose</Kicker>
            <PromptBar onSubmit={onPromptSubmit}>
              <input
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
                placeholder="write 'ANNA + TOM' and a heart, near Vinohrady, about 8 km…"
                aria-label="Describe your route art"
                autoFocus
              />
              <Button type="submit" disabled={!promptDraft.trim() || busy}>
                {busy ? 'Composing…' : 'Compose'}
              </Button>
            </PromptBar>

            {state.matches('composing') && (
              <Card className="p-4 stack gap-3" aria-label="Composing" data-testid="compose-skeleton">
                <Skeleton $h="220px" $r={tokens.radius.md} />
                <Skeleton $w="55%" />
                <Skeleton $w="35%" />
              </Card>
            )}

            {state.matches('composeFailed') && (
              <ErrorPanel role="alert">
                <strong>Couldn’t compose that.</strong> {ctx.error}
                <div className="row gap-2 mt-3">
                  <Button onClick={() => send({ type: 'RETRY' })}>Try again</Button>
                </div>
              </ErrorPanel>
            )}

            {state.matches('idle') && !searchParams.get('prompt') && (
              <p className="f-small" style={{ color: tokens.color.mist }}>
                Describe the occasion — names, shapes, neighborhood, distance. We’ll compose it
                into one continuous, runnable line.
              </p>
            )}
          </ComposeWrap>
        ) : (
          <>
            <MapView>
              {ctx.placement && <FitBounds bbox={ctx.placement.bbox} />}
              {previewTrace && ctx.plan && (
                <RouteLayers
                  id="preview"
                  coords={previewTrace}
                  segments={ctx.plan.segments}
                  dim={stage === 'refine' && solved !== null}
                />
              )}
              {solved && stage === 'refine' && (
                <RouteLayers id="solved" coords={solved.coordinates} segments={solved.segments} />
              )}
              {ctx.placement && (
                <PlacementGizmo
                  placement={ctx.placement}
                  onLive={(p) => send({ type: 'SET_PLACEMENT', placement: p })}
                  onCommit={(p) => send({ type: 'COMMIT_PLACEMENT', placement: p })}
                />
              )}
            </MapView>

            <BusyVeil $visible={state.matches('solving')} aria-hidden />

            <AnimatePresence mode="wait">
              <FloatingPanel
                key={stage}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={panelSpring}
              >
                {stage === 'place' ? (
                  <PanelCard>
                    <div>
                      <Kicker>Place</Kicker>
                      <p className="f-small mt-1 mb-0" style={{ color: tokens.color.slate }}>
                        Drag to move · corners to scale · top handle to rotate.
                      </p>
                    </div>
                    {ctx.plan && <ArtPreview plan={ctx.plan} previewSvg={ctx.previewSvg} />}
                    <Diagnostics items={ctx.diagnostics} />
                    {presets}
                    <Button onClick={() => send({ type: 'SOLVE' })} disabled={!ctx.plan}>
                      Solve route →
                    </Button>
                  </PanelCard>
                ) : (
                  <PanelCard>
                    <div className="row-between">
                      <Kicker>Refine</Kicker>
                      <Chip onClick={() => send({ type: 'EDIT_PLACEMENT' })}>← Adjust placement</Chip>
                    </div>

                    <FidelityMeter score={solved ? solved.fidelity : null} busy={busy} />

                    <div className="row gap-2 flex-wrap" aria-label="Route stats">
                      <Metric data-testid="distance-chip">
                        <strong>{solved ? solved.distance_km.toFixed(1) : '—'}</strong>
                        <span>km</span>
                      </Metric>
                      <Metric data-testid="duration-chip">
                        <strong>{solved ? Math.round(solved.duration_min) : '—'}</strong>
                        <span>min</span>
                      </Metric>
                    </div>

                    {state.matches('solveFailed') && (
                      <ErrorPanel role="alert">
                        <strong>Solve failed.</strong> {ctx.error}
                        <div className="row gap-2 mt-3">
                          <Button onClick={() => send({ type: 'RETRY' })}>Retry</Button>
                          <Button $variant="ghost" onClick={() => send({ type: 'EDIT_PLACEMENT' })}>
                            Adjust placement
                          </Button>
                        </div>
                      </ErrorPanel>
                    )}

                    <Diagnostics items={ctx.diagnostics} />
                    {presets}
                    <ExportBar route={ctx.route} disabled={busy || !solved} />
                  </PanelCard>
                )}
              </FloatingPanel>
            </AnimatePresence>
          </>
        )}
      </Body>
    </Shell>
  );
}
