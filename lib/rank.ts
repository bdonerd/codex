// The spec page's leaderboard: cards ranked by their best %/s, each in a
// tier by its share of the top. Safe for the browser.

export interface RankIn {
  id: string;
  /** best %/s at the chosen speeds; null when it needs a value */
  best: number | null;
  /** the best is a lower bound (shown with ≥; ranked at its value) */
  lower: boolean;
}
export interface RankRow extends RankIn {
  /** 1 = the top; equal bests share a rank; null = not ranked */
  rank: number | null;
  /** best / the top best */
  share: number | null;
  /** 1 (strongest) .. TIERS.length + 1; null = not ranked */
  tier: number | null;
}

/** a tier's lowest share of the top best: tier 1 from 90%, 2 from 75% … */
export const TIERS = [0.9, 0.75, 0.6, 0.4] as const;

export const tierOf = (share: number) => {
  const i = TIERS.findIndex((t) => share >= t);
  return i < 0 ? TIERS.length + 1 : i + 1;
};

/** Ranked cards (best first; equal bests keep the input order), then the
 * cards whose best needs a value, unranked, in input order. */
export function rankCards(xs: RankIn[]): RankRow[] {
  const ranked = xs.map((x, i) => ({ x, i })).filter(({ x }) => x.best != null)
    .sort((a, b) => (b.x.best as number) - (a.x.best as number) || a.i - b.i);
  const top = ranked.length ? (ranked[0].x.best as number) : null;
  const out: RankRow[] = [];
  ranked.forEach(({ x }, i) => {
    const prev = out[i - 1];
    const rank = prev && prev.best === x.best ? (prev.rank as number) : i + 1;
    const share = top && top > 0 ? (x.best as number) / top : null;
    out.push({ ...x, rank, share, tier: share == null ? null : tierOf(share) });
  });
  for (const x of xs) if (x.best == null) out.push({ ...x, rank: null, share: null, tier: null });
  return out;
}
