/**
 * Design tokens — the single source of truth for color/space/type.
 *
 * styled-components is in maintenance mode (SPEC §12 risk); every visual
 * decision routes through these tokens so a future swap is mechanical.
 * Language: confident editorial-minimal — dark-on-light, one accent
 * (route-ink blue), strong type scale, generous whitespace.
 */
export const theme = {
  color: {
    // accent — the route ink
    ink: '#3B82F6',
    inkDeep: '#1D4ED8',
    inkSoft: '#93C5FD',
    inkWash: '#EFF6FF',

    // neutrals — warm paper, cool coal
    paper: '#FAFAF8',
    surface: '#FFFFFF',
    coal: '#18181B',
    slate: '#52525B',
    mist: '#A1A1AA',
    line: '#E4E4E7',

    // semantics
    good: '#16A34A',
    warn: '#D97706',
    bad: '#DC2626',

    // segment provenance on the map
    segmentInk: '#3B82F6',
    segmentConnector: '#9CA3AF',
    segmentRetrace: '#BFDBFE'
  },

  space: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2.5rem',
    xxl: '4rem'
  },

  type: {
    family:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'SF Mono', 'JetBrains Mono', ui-monospace, monospace",
    hero: '3rem',
    title: '1.5rem',
    body: '1rem',
    small: '0.8125rem',
    micro: '0.6875rem'
  },

  radius: {
    sm: '6px',
    md: '10px',
    lg: '16px',
    pill: '999px'
  },

  shadow: {
    card: '0 1px 2px rgba(24,24,27,0.06), 0 8px 24px rgba(24,24,27,0.08)',
    float: '0 2px 8px rgba(24,24,27,0.10), 0 16px 48px rgba(24,24,27,0.14)'
  },

  // intentional curves only — no library defaults (SPEC §8 polish bar)
  ease: {
    out: 'cubic-bezier(0.22, 1, 0.36, 1)', // confident decel
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)', // stage swaps
    spring: { type: 'spring', stiffness: 380, damping: 32 } as const
  },

  z: {
    map: 0,
    gizmo: 10,
    panel: 20,
    bar: 30,
    toast: 50
  }
} as const;

export type AppTheme = typeof theme;
