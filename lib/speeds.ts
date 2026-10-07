// The speed inputs' range, and what a typed or stored value counts as.
export const SPEED_MIN = 50;
export const SPEED_MAX = 300;

/** A typed or stored speed %: clamped to the inputs' range; anything
 * that is not a number counts as 100. */
export function speedValue(raw: unknown): number {
  const s = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (!Number.isFinite(s)) return 100;
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, s));
}

/** The speeds a page starts at and Reset returns to: the class file's
 * `speeds_default` (each field as a typed value would be), else 100. */
export function defaultSpeeds(fromExport: unknown): { attack: number; casting: number; movement: number } {
  const d = (fromExport && typeof fromExport === 'object' ? fromExport : {}) as Record<string, unknown>;
  return { attack: speedValue(d.attack), casting: speedValue(d.casting), movement: speedValue(d.movement) };
}
