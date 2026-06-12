/**
 * Placement gizmo — direct manipulation of where the artwork lands.
 *
 *   body drag      → translate bbox      (cursor: grab/grabbing)
 *   corner handles → scale about center  (cursor: nwse/nesw-resize)
 *   top handle     → rotate              (cursor: crosshair)
 *   arrow keys     → nudge (keyboard path; shift = larger steps)
 *
 * Implemented with raw pointer events + map.project/unproject. Gestures
 * stream `onLive` (no history) and finish with one `onCommit` snapshot —
 * that is what keeps undo/redo at one step per gesture.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useMap } from 'react-map-gl/mapbox';
import styled from 'styled-components';
import { bboxCenter, scaleBBox, translateBBox } from '../geo/project';
import type { Placement } from '../types';

interface Props {
  placement: Placement;
  onLive: (p: Placement) => void;
  onCommit: (p: Placement) => void;
}

type Mode = 'translate' | 'scale' | 'rotate';

interface Gesture {
  mode: Mode;
  startX: number;
  startY: number;
  startPlacement: Placement;
  centerPx: { x: number; y: number };
}

const Body = styled.div`
  position: absolute;
  border: 1.5px solid ${({ theme }) => theme.color.ink};
  border-radius: 2px;
  background: rgba(59, 130, 246, 0.06);
  cursor: grab;
  pointer-events: auto;
  touch-action: none;
  z-index: ${({ theme }) => theme.z.gizmo};

  &.dragging {
    cursor: grabbing;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.inkDeep};
    outline-offset: 3px;
  }
`;

const Handle = styled.div<{ $cursor: string }>`
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: ${({ theme }) => theme.color.surface};
  border: 1.5px solid ${({ theme }) => theme.color.ink};
  cursor: ${({ $cursor }) => $cursor};
  pointer-events: auto;
  touch-action: none;
  transition: transform 140ms ${({ theme }) => theme.ease.out};

  &:hover {
    transform: scale(1.25);
  }
`;

const RotateHandle = styled.div`
  position: absolute;
  top: -34px;
  left: 50%;
  width: 14px;
  height: 14px;
  margin-left: -7px;
  border-radius: 50%;
  background: ${({ theme }) => theme.color.ink};
  border: 2px solid ${({ theme }) => theme.color.surface};
  box-shadow: ${({ theme }) => theme.shadow.card};
  cursor: crosshair;
  pointer-events: auto;
  touch-action: none;

  &::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 12px;
    width: 1.5px;
    height: 22px;
    margin-left: -0.75px;
    background: ${({ theme }) => theme.color.ink};
    opacity: 0.5;
  }
`;

const CORNERS = [
  { key: 'nw', style: { top: -6, left: -6 }, cursor: 'nwse-resize' },
  { key: 'ne', style: { top: -6, right: -6 }, cursor: 'nesw-resize' },
  { key: 'se', style: { bottom: -6, right: -6 }, cursor: 'nwse-resize' },
  { key: 'sw', style: { bottom: -6, left: -6 }, cursor: 'nesw-resize' }
] as const;

export function PlacementGizmo({ placement, onLive, onCommit }: Props) {
  const { current: map } = useMap();
  const gesture = useRef<Gesture | null>(null);
  // Re-render the screen-space frame whenever the camera moves.
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!map) return;
    map.on('move', bump);
    return () => {
      map.off('move', bump);
    };
  }, [map]);

  const applyGesture = useCallback(
    (clientX: number, clientY: number): Placement | null => {
      const g = gesture.current;
      if (!map || !g) return null;
      const { startPlacement: sp, centerPx } = g;

      if (g.mode === 'translate') {
        const from = map.unproject([g.startX, g.startY]);
        const to = map.unproject([clientX, clientY]);
        const bbox = translateBBox(sp.bbox, to.lng - from.lng, to.lat - from.lat);
        const [lng, lat] = bboxCenter(bbox);
        return { ...sp, bbox, anchor: { lng, lat } };
      }

      if (g.mode === 'scale') {
        const d0 = Math.hypot(g.startX - centerPx.x, g.startY - centerPx.y);
        const d1 = Math.hypot(clientX - centerPx.x, clientY - centerPx.y);
        if (d0 < 1) return null;
        return { ...sp, bbox: scaleBBox(sp.bbox, d1 / d0) };
      }

      // rotate — screen angles grow clockwise (y down); geo rotation is CCW+.
      const a0 = Math.atan2(g.startY - centerPx.y, g.startX - centerPx.x);
      const a1 = Math.atan2(clientY - centerPx.y, clientX - centerPx.x);
      let deg = sp.rotation_deg - ((a1 - a0) * 180) / Math.PI;
      deg = ((((deg + 180) % 360) + 360) % 360) - 180; // normalize [-180, 180)
      return { ...sp, rotation_deg: Math.round(deg * 10) / 10 };
    },
    [map]
  );

  const startGesture = useCallback(
    (mode: Mode) => (e: React.PointerEvent<HTMLDivElement>) => {
      if (!map) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = map.getContainer().getBoundingClientRect();
      const [clng, clat] = bboxCenter(placement.bbox);
      const c = map.project([clng, clat]);
      gesture.current = {
        mode,
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        startPlacement: placement,
        centerPx: { x: c.x, y: c.y }
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      if (mode === 'translate') e.currentTarget.classList.add('dragging');
    },
    [map, placement]
  );

  const moveGesture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!gesture.current || !map) return;
      const rect = map.getContainer().getBoundingClientRect();
      const next = applyGesture(e.clientX - rect.left, e.clientY - rect.top);
      if (next) onLive(next);
    },
    [applyGesture, map, onLive]
  );

  const endGesture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!gesture.current || !map) return;
      const rect = map.getContainer().getBoundingClientRect();
      const next = applyGesture(e.clientX - rect.left, e.clientY - rect.top);
      gesture.current = null;
      e.currentTarget.classList.remove('dragging');
      if (next) onCommit(next);
    },
    [applyGesture, map, onCommit]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = (e.shiftKey ? 0.1 : 0.02) * (placement.bbox.max_lng - placement.bbox.min_lng);
      let dLng = 0;
      let dLat = 0;
      if (e.key === 'ArrowLeft') dLng = -step;
      else if (e.key === 'ArrowRight') dLng = step;
      else if (e.key === 'ArrowUp') dLat = step;
      else if (e.key === 'ArrowDown') dLat = -step;
      else return;
      e.preventDefault();
      const bbox = translateBBox(placement.bbox, dLng, dLat);
      const [lng, lat] = bboxCenter(bbox);
      onCommit({ ...placement, bbox, anchor: { lng, lat } });
    },
    [placement, onCommit]
  );

  if (!map) return null;

  const { bbox, rotation_deg } = placement;
  const [clng, clat] = bboxCenter(bbox);
  const c = map.project([clng, clat]);
  const tl = map.project([bbox.min_lng, bbox.max_lat]);
  const br = map.project([bbox.max_lng, bbox.min_lat]);
  const w = Math.max(24, Math.abs(br.x - tl.x));
  const h = Math.max(24, Math.abs(br.y - tl.y));

  return (
    <Body
      role="application"
      aria-label="Artwork placement. Drag to move, corners to scale, top handle to rotate, arrow keys to nudge."
      tabIndex={0}
      style={{
        left: c.x,
        top: c.y,
        width: w,
        height: h,
        // CSS rotate is clockwise-positive; geo rotation is CCW-positive.
        transform: `translate(-50%, -50%) rotate(${-rotation_deg}deg)`
      }}
      onPointerDown={startGesture('translate')}
      onPointerMove={moveGesture}
      onPointerUp={endGesture}
      onKeyDown={onKeyDown}
      data-testid="placement-gizmo"
    >
      {CORNERS.map((corner) => (
        <Handle
          key={corner.key}
          style={corner.style as React.CSSProperties}
          $cursor={corner.cursor}
          onPointerDown={startGesture('scale')}
          onPointerMove={moveGesture}
          onPointerUp={endGesture}
        />
      ))}
      <RotateHandle
        aria-hidden
        onPointerDown={startGesture('rotate')}
        onPointerMove={moveGesture}
        onPointerUp={endGesture}
      />
    </Body>
  );
}
