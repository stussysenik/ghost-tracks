import { defineConfig, presetMini } from 'unocss';

/**
 * UnoCSS — atomic utility layer with a Tachyons-flavored shortcuts dialect.
 *
 * Philosophy (Tachyons): tiny, single-purpose, composable class names for
 * LAYOUT only. Component-level visual styling (color systems, motion,
 * states) lives in styled-components with tokens from src/theme.ts.
 */
export default defineConfig({
  presets: [presetMini()],
  shortcuts: {
    // -- stacks & rows (flex idioms) --------------------------------------
    row: 'flex flex-row items-center',
    'row-between': 'flex flex-row items-center justify-between',
    'row-center': 'flex flex-row items-center justify-center',
    stack: 'flex flex-col',
    'stack-center': 'flex flex-col items-center',
    center: 'flex items-center justify-center',

    // -- measure (Tachyons readable line lengths) -------------------------
    measure: 'max-w-30em',
    'measure-wide': 'max-w-38em',
    'measure-narrow': 'max-w-22em',

    // -- coverage ----------------------------------------------------------
    'absolute-fill': 'absolute inset-0',
    'fixed-fill': 'fixed inset-0',

    // -- type scale helpers (editorial, dark-on-light) ---------------------
    'f-hero': 'text-3rem leading-tight font-700 tracking-tight',
    'f-title': 'text-1.5rem leading-snug font-600 tracking-tight',
    'f-body': 'text-1rem leading-relaxed font-400',
    'f-small': 'text-0.8125rem leading-normal font-400',
    'f-mono': 'font-mono text-0.75rem tracking-wide uppercase'
  },
  theme: {
    colors: {
      ink: '#3B82F6',
      'ink-deep': '#1D4ED8',
      'ink-soft': '#93C5FD',
      paper: '#FAFAF8',
      coal: '#18181B',
      slate: '#52525B'
    }
  }
});
