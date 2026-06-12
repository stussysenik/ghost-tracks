/**
 * Presets row — distance (chips + Radix Slider), loop toggle, area select
 * (Radix Popover). Distance/loop feed solve opts; changing area re-enters
 * the pipeline at compose (SPEC §6.3 — edits never mutate downstream).
 */
import * as Popover from '@radix-ui/react-popover';
import * as Slider from '@radix-ui/react-slider';
import styled, { keyframes } from 'styled-components';
import { Chip } from './ui';

const DISTANCES = [5, 8, 12];
export const AREAS = ['Vinohrady', 'Letná', 'Karlín', 'Old Town', 'Stromovka'];

const pop = keyframes`
  from { opacity: 0; transform: translateY(4px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

const PopContent = styled(Popover.Content)`
  background: ${({ theme }) => theme.color.surface};
  border: 1px solid ${({ theme }) => theme.color.line};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.float};
  padding: ${({ theme }) => theme.space.xs};
  display: flex;
  flex-direction: column;
  min-width: 160px;
  z-index: ${({ theme }) => theme.z.toast};
  animation: ${pop} 200ms ${({ theme }) => theme.ease.out};
`;

const AreaOption = styled.button<{ $active?: boolean }>`
  all: unset;
  box-sizing: border-box;
  padding: 0.5rem 0.75rem;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.type.small};
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  color: ${({ $active, theme }) => ($active ? theme.color.inkDeep : theme.color.coal)};
  cursor: pointer;
  transition: background-color 140ms ${({ theme }) => theme.ease.out};

  &:hover,
  &:focus-visible {
    background: ${({ theme }) => theme.color.inkWash};
  }
`;

const SliderRoot = styled(Slider.Root)`
  position: relative;
  display: flex;
  align-items: center;
  width: 130px;
  height: 20px;
  touch-action: none;
  user-select: none;
  cursor: pointer;
`;

const SliderTrack = styled(Slider.Track)`
  position: relative;
  flex-grow: 1;
  height: 3px;
  border-radius: 999px;
  background: ${({ theme }) => theme.color.line};
`;

const SliderRange = styled(Slider.Range)`
  position: absolute;
  height: 100%;
  border-radius: 999px;
  background: ${({ theme }) => theme.color.ink};
`;

const SliderThumb = styled(Slider.Thumb)`
  display: block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: ${({ theme }) => theme.color.surface};
  border: 2px solid ${({ theme }) => theme.color.ink};
  cursor: grab;
  transition: transform 140ms ${({ theme }) => theme.ease.out};

  &:hover {
    transform: scale(1.15);
  }
  &:active {
    cursor: grabbing;
  }
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.ink};
    outline-offset: 2px;
  }
`;

export interface PresetsProps {
  distanceKm: number | null;
  loop: boolean;
  area: string | null;
  onDistance: (km: number) => void;
  onLoop: (loop: boolean) => void;
  onArea: (area: string) => void;
}

export function Presets({ distanceKm, loop, area, onDistance, onLoop, onArea }: PresetsProps) {
  return (
    <div className="stack gap-2" data-testid="presets">
      <div className="row gap-2 flex-wrap">
        {DISTANCES.map((km) => (
          <Chip key={km} $active={distanceKm === km} onClick={() => onDistance(km)}>
            {km} km
          </Chip>
        ))}
        <span className="row gap-2 ml-1" aria-label="Custom distance">
          <SliderRoot
            min={3}
            max={25}
            step={0.5}
            value={[distanceKm ?? 8]}
            onValueChange={([v]) => onDistance(v)}
            aria-label="Distance in kilometers"
          >
            <SliderTrack>
              <SliderRange />
            </SliderTrack>
            <SliderThumb />
          </SliderRoot>
          <span className="f-small tabular-nums" style={{ minWidth: '3.5em' }}>
            {(distanceKm ?? 8).toFixed(1)} km
          </span>
        </span>
      </div>

      <div className="row gap-2 flex-wrap">
        <Chip $active={loop} onClick={() => onLoop(!loop)} aria-pressed={loop}>
          {loop ? '↻ Loop · end at start' : '→ Open-ended'}
        </Chip>

        <Popover.Root>
          <Popover.Trigger asChild>
            <Chip aria-label="Choose area">📍 {area ?? 'Choose area'}</Chip>
          </Popover.Trigger>
          <Popover.Portal>
            <PopContent sideOffset={6} align="start">
              {AREAS.map((a) => (
                <AreaOption key={a} $active={a === area} onClick={() => onArea(a)}>
                  {a}
                </AreaOption>
              ))}
            </PopContent>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </div>
  );
}
