# Lessons

## 2026-06-10 — Respect the user's repeated stack choice
- I recommended staying Svelte twice; the user ultimately chose a React rewrite (React + Radix + styled-components + UnoCSS/Tachyons, Scala kernel) for the Strava-art MVP.
- **Rule:** Push back on a consequential choice at most twice with concrete costs. If the user reaffirms, lock it in, record it, and never re-litigate.
- **Rule:** When the user names React-only libraries (Radix, styled-components), treat it as a signal of their intended ecosystem, not just a naming slip.

## 2026-06-09 — Verify what's actually running before inspecting
- "The app on :5173" was a different project entirely (portfolio); the gateway on :3000 was a third project. Always verify process cwd / response identity before debugging "the app".
- **Rule:** Pin dev ports per project (`strictPort`) to prevent port roulette across multiple local projects.

## 2026-06-09 — Leftover demo components can take down prod
- A scaffold `ConstraintLayout` demo with a top-level `cassowary` import crashed SSR site-wide (500).
- **Rule:** Demo/experiment components never get wired into real routes; delete scaffolding when done.
