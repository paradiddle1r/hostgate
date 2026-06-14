// Plan limits — the single source of truth for what each tenant plan unlocks.
// Mirrored in the DB by the enforce_property_limit() trigger (migration 04);
// keep maxProperties in sync with that trigger (pro = 25, others = 1).

export type Plan = "trial" | "standard" | "pro";

export interface PlanLimits {
  maxProperties: number;
  glassThemes: boolean; // Apple liquid-glass light/dark variants
  label: string;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  // glassThemes temporarily unlocked for everyone (promo). To re-gate as a Pro
  // perk later, set trial/standard back to `glassThemes: false`. Multi-property
  // stays Pro-only (maxProperties is unchanged).
  trial: { maxProperties: 1, glassThemes: true, label: "Trial" },
  standard: { maxProperties: 1, glassThemes: true, label: "Standard" },
  pro: { maxProperties: 25, glassThemes: true, label: "Pro" },
};

export function planLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[(plan as Plan)] ?? PLAN_LIMITS.trial;
}

/** Can this tenant add another property given how many they already have? */
export function canAddProperty(plan: string, currentCount: number): boolean {
  return currentCount < planLimits(plan).maxProperties;
}

/** Does this plan unlock the premium glass themes? */
export function hasGlassThemes(plan: string): boolean {
  return planLimits(plan).glassThemes;
}

export const ALL_THEMES = ["light", "dark", "sand", "ink", "forest", "rose", "aurora-light", "aurora-dark", "light-glass", "dark-glass"] as const;
export type ThemeName = (typeof ALL_THEMES)[number];

/** Themes available to a plan (only the glass variants are pro-gated). */
export function availableThemes(plan: string): ThemeName[] {
  const opaque = ALL_THEMES.filter((t) => !t.endsWith("-glass")) as ThemeName[];
  return hasGlassThemes(plan) ? [...ALL_THEMES] : opaque;
}

export function isThemeAllowed(plan: string, theme: string): theme is ThemeName {
  return (availableThemes(plan) as string[]).includes(theme);
}
