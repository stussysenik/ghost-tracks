/**
 * Fidelity meter — the product's hero metric (SPEC §9). Animated radial
 * gauge driven by a motion spring (intentional curve, not a default).
 * The layout reserves its full footprint so solve updates never shift it.
 */
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useEffect } from 'react';
import styled from 'styled-components';
import { theme as tokens } from '../theme';

const R = 34;
const CIRCUMFERENCE = 2 * Math.PI * R;

const Wrap = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.md};
  min-height: 88px; /* reserved — zero layout shift while solving */
`;

const Gauge = styled.div`
  position: relative;
  width: 88px;
  height: 88px;
  flex: none;
`;

const Value = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.375rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;

const Label = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;

  strong {
    font-size: ${({ theme }) => theme.type.small};
    font-weight: 600;
  }
  span {
    font-size: ${({ theme }) => theme.type.micro};
    color: ${({ theme }) => theme.color.mist};
  }
`;

function colorFor(score: number): string {
  if (score >= 70) return tokens.color.good;
  if (score >= 50) return tokens.color.warn;
  return tokens.color.bad;
}

export function FidelityMeter({ score, busy }: { score: number | null; busy?: boolean }) {
  const value = useMotionValue(0);
  const dashOffset = useTransform(value, (v) => CIRCUMFERENCE * (1 - v / 100));
  const rounded = useTransform(value, (v) => Math.round(v));

  useEffect(() => {
    const controls = animate(value, score ?? 0, {
      type: 'spring',
      stiffness: tokens.ease.spring.stiffness,
      damping: tokens.ease.spring.damping
    });
    return () => controls.stop();
  }, [score, value]);

  const tone = colorFor(score ?? 0);

  return (
    <Wrap data-testid="fidelity-meter" aria-label={`Fidelity ${score ?? '—'} of 100`}>
      <Gauge style={{ opacity: busy ? 0.55 : 1, transition: `opacity 240ms ${tokens.ease.out}` }}>
        <svg viewBox="0 0 88 88" width="88" height="88">
          <circle cx="44" cy="44" r={R} fill="none" stroke={tokens.color.line} strokeWidth="7" />
          <motion.circle
            cx="44"
            cy="44"
            r={R}
            fill="none"
            stroke={score === null ? tokens.color.line : tone}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            style={{ strokeDashoffset: dashOffset }}
            transform="rotate(-90 44 44)"
          />
        </svg>
        <Value style={{ color: score === null ? tokens.color.mist : tone }}>
          {score === null ? '—' : <motion.span>{rounded}</motion.span>}
        </Value>
      </Gauge>
      <Label>
        <strong>Fidelity</strong>
        <span>
          {score === null
            ? 'Solve to score'
            : score >= 70
              ? 'Reads beautifully on streets'
              : score >= 50
                ? 'Recognizable — try rotating or scaling up'
                : 'Streets fight this shape — move or enlarge it'}
        </span>
      </Label>
    </Wrap>
  );
}
