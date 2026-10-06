// The per-action clock. Every time the site shows is computed here and only
// here: the data ships each path as segments [action, f0, f1] plus each
// action's clock, and this module re-applies the clock at the chosen speeds.
// Golden vectors in the data pin it (tests/golden.test.ts).

export interface Speeds {
  attack: number;
  casting: number;
  movement: number;
}

/** [rate, speed pool, speed events, slow-motion events] of one action */
export type ClockEntry = [number, string, number[][], number[][]];
export type ClockTable = Record<string, ClockEntry>;
export type Seg = [string, number, number];

export const DEFAULT_SPEEDS: Speeds = { attack: 100, casting: 100, movement: 100 };

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Effective frames over [lo, hi) at `rate`; each speed event [frame,
 * speed, remain] replaces the rate from its frame, for remain*speed*30
 * frames when remain > 0 (else to the end); the last event covering a
 * frame wins. null when a stretch has speed 0. */
export function spanFrames(lo: number, hi: number, rate: number, sched: number[][] | null | undefined): number | null {
  if (!sched || !sched.length) return (hi - lo) / rate;
  const ev = sched.map((e) => [e[0], e[1], e.length > 2 && e[2] ? e[0] + e[2] * e[1] * 30 : Infinity] as const);
  const cuts = new Set<number>([lo, hi]);
  for (const [f, , end] of ev) {
    if (lo < f && f < hi) cuts.add(f);
    if (lo < end && end < hi) cuts.add(end);
  }
  const xs = [...cuts].sort((a, b) => a - b);
  let total = 0;
  let cur = lo;
  for (const nxt of xs.slice(1)) {
    let r = rate;
    for (const [f, sp, end] of ev) if (f <= cur && cur < end) r = sp;
    if (!r) return null;
    total += (nxt - cur) / r;
    cur = nxt;
  }
  return total;
}

/** The slow-motion excess in ms of the events [frame, seconds, scale]
 * that start inside [lo, hi). */
export function slowMotionMs(
  sm: number[][] | null | undefined, lo: number, hi: number, rate: number,
  sched: number[][] | null | undefined, mPct: number,
): number {
  if (!sm || !sm.length) return 0;
  const m = (mPct || 100) / 100;
  let out = 0;
  for (const [sf, t, k] of sm) {
    if (!(lo <= sf && sf < hi) || t <= 0 || k <= 0) continue;
    const rest = spanFrames(sf, hi, rate, sched);
    if (rest === null) continue;
    const a = rest / 30 / m;
    out += a >= k * t ? t * (1 - k) : a * (1 / k - 1);
  }
  return out * 1000;
}

/** ms for [lo, hi) of one action at speeds `sp`, rounded to 0.1. */
export function clockMs(
  rate: number, pool: string, sched: number[][], lo: number, hi: number,
  sp: Speeds, sm: number[][],
): number | null {
  const fr = spanFrames(lo, hi, rate, sched);
  if (fr === null) return null;
  const m = pool.startsWith('none') ? 100 : (sp[pool as keyof Speeds] || 100);
  return round1((fr / 30 / (m / 100)) * 1000 + slowMotionMs(sm, lo, hi, rate, sched, m));
}

export function actionMs(clock: ClockTable, a: string, lo: number, hi: number, sp: Speeds): number | null {
  const c = clock[a];
  if (!c) return null;
  return clockMs(c[0], c[1], c[2], lo, hi, sp, c[3]);
}

/** A path's time: the sum of the clock over its segments. */
export function segMs(clock: ClockTable, segs: Seg[] | null | undefined, sp: Speeds): number | null {
  if (!segs) return null;
  let tot = 0;
  for (const [a, f0, f1] of segs) {
    if (f1 <= f0) continue;
    const x = actionMs(clock, a, f0, f1, sp);
    if (x === null) return null;
    tot += x;
  }
  return round1(tot);
}

export interface TimedSeg {
  a: string;
  f0: number;
  f1: number;
  t0: number;
  t1: number;
  /** the segment's own time */
  d: number;
}
export interface Timeline {
  segs: TimedSeg[];
  total: number;
}

/** Each segment timed by the clock, back to back. */
export function timelineOf(clock: ClockTable, segs: Seg[], sp: Speeds): Timeline | null {
  const out: TimedSeg[] = [];
  let t = 0;
  for (const [a, f0, f1] of segs) {
    const d = f1 > f0 ? actionMs(clock, a, f0, f1, sp) : 0;
    if (d === null) return null;
    out.push({ a, f0, f1, t0: t, t1: t + d, d });
    t += d;
  }
  return { segs: out, total: round1(t) };
}

/** The longest of a preset's path and its follow-ups' paths (all start at
 * the preset start): the Details timeline runs to the last follow-up. */
export function longSegs(clock: ClockTable, presetSegs: Seg[], followupSegs: (Seg[] | undefined)[], sp: Speeds): Seg[] {
  let best = presetSegs;
  let bt = segMs(clock, presetSegs, sp);
  for (const sg of followupSegs) {
    if (!sg) continue;
    const t = segMs(clock, sg, sp);
    if (t != null && (bt == null || t > bt)) {
      best = sg;
      bt = t;
    }
  }
  return best;
}

/** Where a path's end sits on a drawn timeline: on it when the path is a
 * prefix of it, else at the path's own total. */
export function markerTime(clock: ClockTable, tl: Timeline, segs: Seg[], sp: Speeds): number | null {
  const n = segs.length;
  let prefix = n <= tl.segs.length;
  for (let i = 0; prefix && i < n; i++) {
    const a = segs[i];
    const b = tl.segs[i];
    if (a[0] !== b.a || a[1] !== b.f0 || (i < n - 1 ? a[2] !== b.f1 : a[2] > b.f1)) prefix = false;
  }
  if (prefix) {
    let t = n ? tl.segs[n - 1].t0 : 0;
    if (n) {
      const [a, f0, f1] = segs[n - 1];
      if (f1 > f0) t += actionMs(clock, a, f0, f1, sp) ?? 0;
    }
    return round1(t);
  }
  const own = timelineOf(clock, segs, sp);
  return own ? own.total : null;
}

/** The time on a timeline at which action `a` reaches frame `f`. */
export function atTime(clock: ClockTable, tl: Timeline, a: string, f: number, sp: Speeds): number | null {
  const seg = tl.segs.find((s) => s.a === a && s.f0 <= f && f <= s.f1) || tl.segs.filter((s) => s.a === a).pop();
  if (!seg) return null;
  const ff = Math.min(Math.max(f, seg.f0), seg.f1);
  return seg.t0 + (ff > seg.f0 ? (actionMs(clock, a, seg.f0, ff, sp) ?? 0) : 0);
}

/** The time of one segment as drawn in a timeline (0 when empty). */
export function segDuration(clock: ClockTable, a: string, f0: number, f1: number, sp: Speeds): number | null {
  return f1 > f0 ? actionMs(clock, a, f0, f1, sp) : 0;
}

/** Damage % per second over `ms`; null when the time is unknown or 0. */
export function ratePerSec(pct: number | null, ms: number | null): number | null {
  return pct != null && ms != null && ms > 0 ? pct / (ms / 1000) : null;
}

/** A speed set name "attack/casting/movement" as speeds. */
export function speedSet(name: string): Speeds {
  const [attack, casting, movement] = name.split('/').map(Number);
  return { attack, casting, movement };
}
