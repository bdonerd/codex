// The clock must reproduce every golden vector shipped with the data, and
// every time the pages draw must agree with it. `npm run build` runs these
// first, so a clock that disagrees never builds.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type Speeds, actionMs, longSegs, markerTime, segMs, timelineOf,
} from '../lib/clock';
import { classSpecs, loadView, specSeg } from '../lib/data';
import type { Golden } from '../lib/export-types';

const close = (got: number | null, want: number, tol = 1e-6) => got !== null && Math.abs(got - want) <= tol;

for (const cs of classSpecs()) {
  const V = loadView(cs.cls, specSeg(cs.spec));
  const golden = JSON.parse(readFileSync(join(cs.dir, 'golden.json'), 'utf8')) as Golden;
  const sets = golden.speed_sets as Record<string, Speeds>;
  const s100 = sets['100/100/100'] ?? { attack: 100, casting: 100, movement: 100 };
  const byKey = new Map(V.presets.map((p) => [p.key, p]));

  describe(`${cs.cls} ${cs.spec ?? 'all'} (build ${cs.build})`, () => {
    it('has golden vectors', () => {
      expect(V.golden.clock.length).toBeGreaterThan(0);
      expect(V.golden.presets.length).toBeGreaterThan(0);
    });

    it('reproduces every golden clock span', () => {
      const bad: string[] = [];
      for (const [a, lo, hi, nm, want] of V.golden.clock) {
        const got = actionMs(V.clock, a, lo, hi, sets[nm]);
        if (!close(got, want)) bad.push(`${a} [${lo}, ${hi}) at ${nm}: ${got} ms, golden ${want} ms`);
      }
      expect(bad).toEqual([]);
    });

    it('reproduces every golden preset time, and its timeline sums to it', () => {
      const bad: string[] = [];
      for (const [k, nm, want] of V.golden.presets) {
        const p = byKey.get(k);
        if (!p || want == null) {
          bad.push(`${k} at ${nm}: ${p ? 'golden null' : 'no such preset'}`);
          continue;
        }
        const got = segMs(V.clock, p.segs, sets[nm]);
        if (!close(got, want)) bad.push(`${k} at ${nm}: ${got} ms, golden ${want} ms`);
        const tl = timelineOf(V.clock, p.segs, sets[nm]);
        if (!tl || !close(tl.total, want)) bad.push(`${k} at ${nm}: timeline ${tl && tl.total} ms, golden ${want} ms`);
      }
      expect(bad).toEqual([]);
    });

    it('places every follow-up marker at its group time on the Details timeline', () => {
      const bad: string[] = [];
      let n = 0;
      for (const [k, nm] of V.golden.presets) {
        const p = byKey.get(k);
        if (!p) continue;
        const sp = sets[nm];
        const long = timelineOf(V.clock, longSegs(V.clock, p.segs, p.fu.map((f) => V.segs[f.sg]), sp), sp);
        for (const f of p.fu) {
          const sg = V.segs[f.sg];
          if (!sg || !long) continue;
          n++;
          const want = segMs(V.clock, sg, sp);
          const got = markerTime(V.clock, long, sg, sp);
          if (got == null || want == null || !close(got, want)) bad.push(`${k} -> ${f.to} at ${nm}: marker ${got} ms, group ${want} ms`);
        }
      }
      expect(n).toBeGreaterThan(0);
      expect(bad).toEqual([]);
    });

    it('times every follow-up at 100% as the data does', () => {
      const bad: string[] = [];
      for (const p of V.presets) {
        for (const f of p.fu) {
          if (f.ms == null) continue;
          const segs = V.segs[f.sg];
          const got = segMs(V.clock, segs, s100);
          if (!close(got, f.ms, 0.05 * (segs ? segs.length : 1) + 1e-6)) bad.push(`${p.key} -> ${f.to}: ${got} ms, data ${f.ms} ms`);
        }
      }
      expect(bad).toEqual([]);
    });

    it('times every no-damage timeline and exit at 100% as the data does', () => {
      const bad: string[] = [];
      for (const [cid, c] of Object.entries(V.cards)) {
        for (const t of c.timelines || []) {
          if (t.ms != null) {
            const got = segMs(V.clock, t.segs, s100);
            if (!close(got, t.ms, 0.05 * t.segs.length + 1e-6)) bad.push(`card ${cid} timeline: ${got} ms, data ${t.ms} ms`);
          }
          for (const f of t.ex.concat(t.free ? [t.free] : [])) {
            if (f.ms == null) continue;
            const segs = V.segs[f.sg];
            const got = segMs(V.clock, segs, s100);
            if (!close(got, f.ms, 0.05 * (segs ? segs.length : 1) + 1e-6)) bad.push(`card ${cid} exit -> ${f.to}: ${got} ms, data ${f.ms} ms`);
          }
        }
      }
      expect(bad).toEqual([]);
    });
  });
}

describe('the clock check can fail', () => {
  it('notices a changed rate', () => {
    const cs = classSpecs()[0];
    const V = loadView(cs.cls, specSeg(cs.spec));
    const [a, lo, hi, , want] = V.golden.clock.find((g) => g[1] < g[2] && g[3] === '100/100/100')!;
    const c = V.clock[a];
    const tampered = { [a]: [c[0] * 1.01, c[1], c[2], c[3]] as typeof c };
    expect(close(actionMs(tampered, a, lo, hi, { attack: 100, casting: 100, movement: 100 }), want)).toBe(false);
  });
});
