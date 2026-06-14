-- =====================================================================
-- HostGate · Migration 19 — Aurora themes (theme CHECK widen)
-- =====================================================================
-- Adds the flagship WebGL "aurora-light" / "aurora-dark" themes. CSS token
-- blocks live in app/globals.css, the live backdrop in
-- components/app/AuroraBackground.tsx (Three.js + GSAP), and the picker list in
-- lib/plan.ts. Idempotent — keep the full theme list in sync with ALL_THEMES.
-- =====================================================================
alter table public.user_profiles drop constraint if exists user_profiles_theme_check;
alter table public.user_profiles add constraint user_profiles_theme_check
  check (theme = any (array[
    'light','dark','sand','ink','forest','rose',
    'aurora-light','aurora-dark',
    'light-glass','dark-glass'
  ]));
