/**
 * Artwork preview card — renders the composed plan either from the backend's
 * preview_svg or client-side from plan.continuous + segments:
 * ink strokes solid · connectors dashed · retrace dotted. Unit y is up;
 * SVG y is down, so the client render flips y.
 */
import styled from 'styled-components';
import { classifySegment, type SegmentClass } from '../geo/segments';
import { theme } from '../theme';
import type { ArtPlan } from '../types';
import { Card } from './ui';

const Frame = styled(Card)`
  padding: ${({ theme }) => theme.space.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.sm};
`;

const Canvas = styled.div`
  aspect-ratio: 4 / 3;
  border-radius: ${({ theme }) => theme.radius.md};
  background:
    radial-gradient(circle at 1px 1px, ${({ theme }) => theme.color.line} 1px, transparent 0) 0 0 /
      16px 16px,
    #fdfdfc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  svg {
    width: 100%;
    height: 100%;
  }
`;

const LegendRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.md};
  font-size: ${({ theme }) => theme.type.micro};
  color: ${({ theme }) => theme.color.slate};
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const Swatch = styled.svg`
  width: 22px;
  height: 8px;
`;

const STYLES: Record<SegmentClass, { stroke: string; dash?: string; width: number }> = {
  ink: { stroke: theme.color.segmentInk, width: 2.4 },
  connector: { stroke: theme.color.segmentConnector, dash: '4 3', width: 1.8 },
  retrace: { stroke: theme.color.segmentRetrace, dash: '0.5 4', width: 2.2 }
};

function PlanSvg({ plan }: { plan: ArtPlan }) {
  const W = 400;
  const H = 300;
  const pad = 24;
  const sx = (x: number) => pad + x * (W - 2 * pad);
  const sy = (y: number) => H - pad - y * (H - 2 * pad); // flip: unit y is up

  const segs =
    plan.segments.length > 0
      ? plan.segments
      : [{ kind: 'glyph' as const, retrace: false, start_idx: 0, end_idx: plan.continuous.length - 1 }];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Composed artwork preview">
      {segs.map((seg, i) => {
        const pts = plan.continuous.slice(seg.start_idx, seg.end_idx + 1);
        if (pts.length < 2) return null;
        const cls = classifySegment(seg);
        const s = STYLES[cls];
        return (
          <polyline
            key={i}
            points={pts.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(' ')}
            fill="none"
            stroke={s.stroke}
            strokeWidth={s.width}
            strokeDasharray={s.dash}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}

export function ArtPreview({ plan, previewSvg }: { plan: ArtPlan; previewSvg?: string | null }) {
  return (
    <Frame data-testid="art-preview">
      <Canvas>
        {previewSvg ? (
          <div dangerouslySetInnerHTML={{ __html: previewSvg }} className="absolute-fill center" />
        ) : (
          <PlanSvg plan={plan} />
        )}
      </Canvas>
      <LegendRow aria-label="Stroke legend">
        <span className="row gap-1.5">
          <Swatch viewBox="0 0 22 8">
            <line x1="1" y1="4" x2="21" y2="4" stroke={STYLES.ink.stroke} strokeWidth="2.4" strokeLinecap="round" />
          </Swatch>
          Ink
        </span>
        <span className="row gap-1.5">
          <Swatch viewBox="0 0 22 8">
            <line x1="1" y1="4" x2="21" y2="4" stroke={STYLES.connector.stroke} strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />
          </Swatch>
          Connector
        </span>
        <span className="row gap-1.5">
          <Swatch viewBox="0 0 22 8">
            <line x1="1" y1="4" x2="21" y2="4" stroke={STYLES.retrace.stroke} strokeWidth="2.4" strokeDasharray="0.5 4" strokeLinecap="round" />
          </Swatch>
          Retrace
        </span>
      </LegendRow>
    </Frame>
  );
}
