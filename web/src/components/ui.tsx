/**
 * Shared styled primitives. Visual styling lives here (tokens via theme);
 * page layout composes UnoCSS atomic utilities.
 */
import styled, { css, keyframes } from 'styled-components';

export const Button = styled.button<{ $variant?: 'primary' | 'ghost' | 'quiet' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space.sm};
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 0.625rem 1.125rem;
  font-size: ${({ theme }) => theme.type.small};
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition:
    transform 160ms ${({ theme }) => theme.ease.out},
    background-color 160ms ${({ theme }) => theme.ease.out},
    border-color 160ms ${({ theme }) => theme.ease.out},
    box-shadow 160ms ${({ theme }) => theme.ease.out};

  &:active {
    transform: scale(0.97);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.ink};
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
  }

  ${({ $variant = 'primary', theme }) =>
    $variant === 'primary'
      ? css`
          background: ${theme.color.coal};
          color: ${theme.color.paper};
          &:hover:not(:disabled) {
            background: #000;
            box-shadow: ${theme.shadow.card};
          }
        `
      : $variant === 'ghost'
        ? css`
            background: ${theme.color.surface};
            color: ${theme.color.coal};
            border-color: ${theme.color.line};
            &:hover:not(:disabled) {
              border-color: ${theme.color.mist};
            }
          `
        : css`
            background: transparent;
            color: ${theme.color.slate};
            padding: 0.375rem 0.625rem;
            &:hover:not(:disabled) {
              color: ${theme.color.coal};
              background: rgba(24, 24, 27, 0.05);
            }
          `}
`;

export const Chip = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  border: 1px solid
    ${({ $active, theme }) => ($active ? theme.color.ink : theme.color.line)};
  background: ${({ $active, theme }) =>
    $active ? theme.color.inkWash : theme.color.surface};
  color: ${({ $active, theme }) => ($active ? theme.color.inkDeep : theme.color.slate)};
  font-size: ${({ theme }) => theme.type.small};
  font-weight: 500;
  padding: 0.375rem 0.875rem;
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 160ms ${({ theme }) => theme.ease.out},
    background-color 160ms ${({ theme }) => theme.ease.out},
    color 160ms ${({ theme }) => theme.ease.out},
    transform 160ms ${({ theme }) => theme.ease.out};

  &:hover {
    border-color: ${({ theme }) => theme.color.ink};
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.ink};
    outline-offset: 2px;
  }
`;

export const Card = styled.div`
  background: ${({ theme }) => theme.color.surface};
  border: 1px solid ${({ theme }) => theme.color.line};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: ${({ theme }) => theme.shadow.card};
`;

export const Kicker = styled.div`
  font-family: ${({ theme }) => theme.type.mono};
  font-size: ${({ theme }) => theme.type.micro};
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.color.ink};
  font-weight: 600;
`;

/** Stat chip — fixed-height so solve updates cause zero layout shift. */
export const Metric = styled.div`
  display: inline-flex;
  align-items: baseline;
  gap: 0.375rem;
  min-height: 2rem;
  padding: 0.25rem 0.75rem;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.color.surface};
  border: 1px solid ${({ theme }) => theme.color.line};
  font-variant-numeric: tabular-nums;

  strong {
    font-size: ${({ theme }) => theme.type.body};
    font-weight: 700;
  }
  span {
    font-size: ${({ theme }) => theme.type.micro};
    color: ${({ theme }) => theme.color.mist};
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
`;

const shimmer = keyframes`
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`;

/** Loading skeleton block with a soft shimmer sweep. */
export const Skeleton = styled.div<{ $h?: string; $w?: string; $r?: string }>`
  height: ${({ $h = '1rem' }) => $h};
  width: ${({ $w = '100%' }) => $w};
  border-radius: ${({ $r, theme }) => $r ?? theme.radius.sm};
  background: linear-gradient(
    100deg,
    ${({ theme }) => theme.color.line} 40%,
    #f4f4f2 50%,
    ${({ theme }) => theme.color.line} 60%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 1.6s ${({ theme }) => theme.ease.inOut} infinite;
`;

/** Translucent shimmer veil over the map while the solver is busy. */
export const BusyVeil = styled.div<{ $visible: boolean }>`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: ${({ theme }) => theme.z.gizmo - 1};
  background: linear-gradient(
    100deg,
    transparent 35%,
    rgba(59, 130, 246, 0.07) 50%,
    transparent 65%
  );
  background-size: 250% 100%;
  animation: ${shimmer} 1.4s ${({ theme }) => theme.ease.inOut} infinite;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transition: opacity 240ms ${({ theme }) => theme.ease.out};
`;

export const ErrorPanel = styled.div`
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: ${({ theme }) => theme.color.bad};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: ${({ theme }) => theme.space.md};
  font-size: ${({ theme }) => theme.type.small};
  line-height: 1.5;
`;
