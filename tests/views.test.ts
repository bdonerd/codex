// Each page gets only a slice of the data: the slice must hold everything
// the page times, and the card list must agree with the card pages.
import { describe, expect, it } from 'vitest';
import { type Speeds, ratePerSec, segMs } from '../lib/clock';
import {
  cardData, cardParams, classSpecs, fullSlice, listData, loadView, specSeg,
} from '../lib/data';
import { bestOf, damage, labelPresets, timed } from '../lib/present';

const SETS: Speeds[] = [
  { attack: 100, casting: 100, movement: 100 },
  { attack: 130, casting: 115, movement: 110 },
];

for (const cs of classSpecs()) {
  const spec = specSeg(cs.spec);
  const V = loadView(cs.cls, spec);
  const full = fullSlice(V);
  const L = listData(cs.cls, spec);
  const params = cardParams(cs.cls, spec);

  describe(`${cs.cls} ${spec}`, () => {
    it('has one section per card, with unique addresses', () => {
      expect(params.length).toBe(L.cards.length);
      expect(new Set(params).size).toBe(params.length);
    });

    it('gives each card page every segment list and clock it times', () => {
      const bad: string[] = [];
      for (const p of params) {
        const d = cardData(cs.cls, spec, p);
        const S = d.slice;
        const lists = [
          ...d.presets.flatMap((x) => [x.segs, ...x.fu.map((f) => S.segs[f.sg])]),
          ...(S.cards[d.id].timelines || []).flatMap((t) => [t.segs, ...t.ex.map((f) => S.segs[f.sg]), ...(t.free ? [S.segs[t.free.sg]] : [])]),
        ];
        for (const l of lists) {
          if (!l) bad.push(`${p}: a segment list is missing`);
          else for (const [a] of l) if (!S.clock[a] && V.clock[a]) bad.push(`${p}: no clock for ${a}`);
        }
        for (const x of d.presets) for (const g of x.groups) for (const t of g.ticks) for (const l of t[0]) if (!S.lines[l] && V.lines[l]) bad.push(`${p}: no line ${l}`);
      }
      expect(bad).toEqual([]);
    });

    it('times every card page exactly as the full data does', () => {
      const bad: string[] = [];
      for (const p of params) {
        const d = cardData(cs.cls, spec, p);
        for (const sp of SETS) {
          for (const x of d.presets) {
            const a = timed(d.slice, x, damage(x, d.slice.lines), sp);
            const b = timed(full, x, damage(x, full.lines), sp);
            if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(`${p} ${x.key}`);
          }
        }
      }
      expect(bad).toEqual([]);
    });

    it('shows the same best %/s on the list as on each card page', () => {
      const bad: string[] = [];
      for (const c of L.cards) {
        const d = cardData(cs.cls, spec, c.slug);
        const dmg = new Map(d.presets.map((x) => [x.key, damage(x, d.slice.lines)]));
        for (const sp of SETS) {
          const card = d.presets.length ? bestOf(d.slice, d.presets, dmg, sp) : { best: null, lower: false };
          let best: number | null = null;
          let lower = false;
          for (const x of c.presets) {
            for (const sg of x.sgs) {
              const r = ratePerSec(x.pct, segMs(L.clock, L.segs[sg], sp));
              if (r != null && (best == null || r > best)) {
                best = r;
                lower = x.lower;
              }
            }
          }
          if (best !== card.best || lower !== card.lower) bad.push(`${c.slug} at ${JSON.stringify(sp)}: list ${best} card ${card.best}`);
        }
      }
      expect(bad).toEqual([]);
    });

    it('labels every preset of a card distinctly', () => {
      const bad: string[] = [];
      for (const p of params) {
        const d = cardData(cs.cls, spec, p);
        for (const cool of [false, true]) {
          const ps = d.presets.filter((x) => x.cool === cool);
          const labels = [...labelPresets(d.slice, ps).values()];
          if (new Set(labels).size !== labels.length) bad.push(p);
        }
      }
      expect(bad).toEqual([]);
    });

    it('never shows a missing damage value as zero', () => {
      for (const x of V.presets) {
        const dm = damage(x, V.lines);
        if (dm.missing === dm.ticks) expect(dm.pct).toBeNull();
        if (dm.pct === 0) throw new Error(`${x.key}: total 0`);
      }
    });
  });
}
