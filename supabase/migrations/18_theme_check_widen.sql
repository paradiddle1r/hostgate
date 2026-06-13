-- =====================================================================
-- HostGate · Migration 18 — widen user_profiles.theme CHECK
-- =====================================================================
-- Adds 4 named themes (sand / ink / forest / rose) for visual parity with
-- hotel-pms's palette variety. The CSS token blocks live in app/globals.css
-- and the picker list in lib/plan.ts. Idempotent.
-- =====================================================================
alter table public.user_profiles drop constraint if exists user_profiles_theme_check;
alter table public.user_profiles add constraint user_profiles_theme_check
  check (theme = any (array['light','dark','sand','ink','forest','rose','light-glass','dark-glass']));
