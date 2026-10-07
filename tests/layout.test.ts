// The one-page layout: each section's data (loaded on open) must make the
// same slice the card pages had; the leaderboard ranks as specified; the
// route chip reads the export's `route` when it gives one.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cardDataPath, sliceOf } from '../lib/card-slice';
import {
  cardData, cardIds, cardPayload, classSpecs, listData, loadView, specSeg, specShared, slugsOf,
} from '../lib/data';
import type { ClassExport } from '../lib/export-types';
import { routeChips, routeName } from '../lib/present';
import { TIERS, rankCards, tierOf } from '../lib/rank';
import { slim } from '../lib/view';

for (const cs of classSpecs()) {
  const spec = specSeg(cs.spec);
  const V = loadView(cs.cls, spec);
  const shared = specShared(cs.cls, spec);
  const L = listData(cs.cls, spec);
  const slugs = slugsOf(V);

  describe(`${cs.cls} ${spec}: one page`, () => {
    it('has a section, an address and a data file per card', () => {
      const ids = cardIds(cs.cls, spec);
      expect(ids.sort()).toEqual(L.cards.map((c) => c.id).sort());
      expect(new Set(L.cards.map((c) => c.slug)).size).toBe(L.cards.length);
      for (const c of L.cards) expect(c.slug).toMatch(new RegExp(`^${c.id}-[a-z0-9-]+$`));
      expect(new Set(ids.map((id) => cardDataPath(cs.cls, spec, id))).size).toBe(ids.length);
    });

    it("makes each card's slice from the shared names and its data file, as the card page did", () => {
      const bad: string[] = [];
      for (const id of cardIds(cs.cls, spec)) {
        const d = cardData(cs.cls, spec, slugs[id]);
        // what the browser gets: the data file through JSON
        const p = JSON.parse(JSON.stringify(cardPayload(cs.cls, spec, id)));
        const sh = JSON.parse(JSON.stringify(shared));
        const S = sliceOf(sh, p);
        if (JSON.stringify(S) !== JSON.stringify(d.slice)) bad.push(`${id}: slice differs`);
        if (JSON.stringify(p.presets) !== JSON.stringify(d.presets)) bad.push(`${id}: presets differ`);
      }
      expect(bad).toEqual([]);
    });

    it('notices a data file that lost a clock entry', () => {
      const id = cardIds(cs.cls, spec).find((k) => Object.keys(cardPayload(cs.cls, spec, k).clock).length > 0)!;
      const p = structuredClone(cardPayload(cs.cls, spec, id));
      delete p.clock[Object.keys(p.clock)[0]];
      expect(JSON.stringify(sliceOf(shared, p))).not.toBe(JSON.stringify(cardData(cs.cls, spec, slugs[id]).slice));
    });

    it('ranks damage and Black Spirit cards only', () => {
      const ranked = new Set(L.cards.filter((c) => c.section === 'skill' || c.section === 'bs').map((c) => c.id));
      const notRanked = L.cards.filter((c) => c.section === 'summon' || c.section === 'nd');
      expect(ranked.size + notRanked.length).toBe(L.cards.length);
      expect(notRanked.length).toBe(L.counts.noDamage + L.counts.summon);
    });
  });
}

describe('the leaderboard ranking', () => {
  const rows = rankCards([
    { id: 'a', best: 50, lower: false },
    { id: 'b', best: null, lower: false },
    { id: 'c', best: 100, lower: false },
    { id: 'd', best: 80, lower: true },
    { id: 'e', best: 80, lower: false },
    { id: 'f', best: 30, lower: false },
  ]);
  it('orders by best, shares a rank on a tie, and leaves "needs value" unranked at the end', () => {
    expect(rows.map((r) => [r.id, r.rank])).toEqual([['c', 1], ['d', 2], ['e', 2], ['a', 4], ['f', 5], ['b', null]]);
  });
  it('ranks a lower bound at its value and keeps it a lower bound', () => {
    const d = rows.find((r) => r.id === 'd')!;
    expect(d.lower).toBe(true);
    expect(d.share).toBeCloseTo(0.8);
  });
  it('puts each card in the tier of its share of the top', () => {
    expect(rows.map((r) => r.tier)).toEqual([1, 2, 2, 4, 5, null]);
    expect(TIERS.map(tierOf)).toEqual([1, 2, 3, 4]);
    expect(tierOf(0.3999)).toBe(5);
    expect(tierOf(1)).toBe(1);
  });
});

describe('the route chip', () => {
  it('reads the route when the export gives one', () => {
    expect(routeChips({ k: 'ultimate', n: 'Ultimate: Dream of Doom' }, null, null).map((c) => c.label)).toEqual(['Ultimate']);
    expect(routeChips({ k: 'weapon_switch', n: 'Awakening: Dark Flame' }, null, null).map((c) => c.label)).toEqual(['Awakening: Dark Flame']);
    expect(routeChips({ k: 'weapon_switch', n: null }, null, null).map((c) => c.label)).toEqual(['Weapon switch']);
    expect(routeChips({ k: 'skill', n: 'Succession: Imminent Doom' }, 'Imminent Doom', null).map((c) => c.label)).toEqual(['Succession: Imminent Doom']);
    expect(routeName({ k: 'skill', n: 'Succession: Imminent Doom' }, 'Imminent Doom')).toBe('Succession: Imminent Doom');
  });
  it('falls back to the Ultimate and weapon-switch fields without one', () => {
    expect(routeChips(undefined, 'Imminent Doom', null).map((c) => c.label)).toEqual(['Ultimate']);
    expect(routeChips(undefined, null, 'Dark Flame').map((c) => c.label)).toEqual(['Weapon switch']);
    expect(routeChips(undefined, null, null)).toEqual([]);
    expect(routeName(undefined, 'Imminent Doom')).toBe('Imminent Doom');
  });
  it("is picked up from a preset's and a follow-up's `route` in the export", () => {
    const cs = classSpecs()[0];
    const doc = JSON.parse(readFileSync(join(cs.dir, cs.file), 'utf8')) as ClassExport;
    const t = structuredClone(doc) as unknown as { presets: Record<string, unknown>[] };
    for (const p of t.presets) {
      delete p.route;
      for (const f of (p.followups as Record<string, unknown>[]) || []) delete f.route;
    }
    const plain = slim(t as unknown as ClassExport, undefined, {});
    expect(plain.presets.some((p) => p.ro || p.fu.some((f) => f.ro))).toBe(false);
    const i = t.presets.findIndex((p) => Array.isArray(p.followups) && (p.followups as unknown[]).length > 0);
    t.presets[i].route = { kind: 'skill', id: 1, name: 'Succession: X' };
    (t.presets[i].followups as Record<string, unknown>[])[0].route = { kind: 'ultimate', id: 2, name: 'X' };
    const v = slim(t as unknown as ClassExport, undefined, {});
    expect(v.presets[i].ro).toEqual({ k: 'skill', n: 'Succession: X' });
    expect(v.presets[i].fu[0].ro).toEqual({ k: 'ultimate', n: 'X' });
    expect(routeChips(v.presets[i].ro, v.presets[i].ult, v.presets[i].ws).map((c) => c.label)).toEqual(['Succession: X']);
  });
});

describe('the route chips on the data (sorceress succession)', () => {
  const V = loadView('sorceress', 'succession');
  const chip = (p: { ro?: Parameters<typeof routeChips>[0]; ult: string | null; ws: string | null }) => routeChips(p.ro, p.ult, p.ws).map((c) => c.label);
  const cardOf = (name: string) => Object.keys(V.cards).find((k) => V.cards[k].as_name === name || V.cards[k].name === name)!;
  it('chips the Imminent Doom presets on Prime: Dream of Doom IV "Succession: Imminent Doom", not "Ultimate"', () => {
    const ps = V.presets.filter((p) => p.card === cardOf('Prime: Dream of Doom IV') && p.ro);
    expect(ps.length).toBeGreaterThan(0);
    for (const p of ps) expect(chip(p)).toEqual(['Succession: Imminent Doom']);
  });
  it('still chips the Crow Flare and Midnight Stinger folds "Ultimate"', () => {
    for (const nm of ['Prime: Crow Flare III', 'Prime: Midnight Stinger']) {
      const ps = V.presets.filter((p) => p.card === cardOf(nm) && p.ro);
      expect(ps.length).toBeGreaterThan(0);
      for (const p of ps) expect(chip(p)).toEqual(['Ultimate']);
    }
  });
  it('chips no preset "Ultimate" that the export does not call an Ultimate', () => {
    for (const p of V.presets) if (chip(p).includes('Ultimate')) expect(p.ro?.k).toBe('ultimate');
  });
});

describe('shadowed exits ("press late")', () => {
  const cs = classSpecs()[0];
  const doc = JSON.parse(readFileSync(join(cs.dir, cs.file), 'utf8')) as ClassExport;
  type Raw = Record<string, unknown> & { shadow?: unknown };
  const fuCount = (d: ClassExport) => d.presets.reduce((n, p) => n + ((p.followups || []) as unknown as Raw[]).filter((f) => f.shadow).length, 0)
    + Object.values(d.cards).reduce((n, c) => n + ((c as { timelines?: { exits?: Raw[]; free_to_act?: Raw | null }[] }).timelines || [])
      .reduce((m, t) => m + (t.exits || []).filter((f) => f.shadow).length + (t.free_to_act && t.free_to_act.shadow ? 1 : 0), 0), 0);
  it('keeps every follow-up shadow, with its text', () => {
    const V = loadView(cs.cls, specSeg(cs.spec));
    const shown = V.presets.reduce((n, p) => n + p.fu.filter((f) => f.sw && f.sw.t).length, 0)
      + Object.values(V.cards).reduce((n, c) => n + (c.timelines || []).reduce((m, t) => m + [...t.ex, t.free].filter((f) => f && f.sw).length, 0), 0);
    expect(fuCount(doc)).toBeGreaterThan(0);
    expect(shown).toBe(fuCount(doc));
  });
  it('places every access-entry shadow on an Entry Skills entry, or counts it by name', () => {
    const drops: Record<string, number> = {};
    const v = slim(doc, undefined, drops);
    const placed = new Set<string>();
    for (const l of Object.values(v.access)) for (const e of l) for (const x of e.sh || []) placed.add(x.t);
    const raw = new Set<string>();
    for (const l of Object.values(doc.access_lists)) for (const e of l as unknown as Raw[]) if (e.shadow) raw.add((e.shadow as { text: string }).text);
    const missing = [...raw].filter((t) => !placed.has(t));
    expect(raw.size).toBeGreaterThan(0);
    expect(missing.length).toBeLessThanOrEqual(drops['shadow: on an entry whose card Entry Skills do not list'] || 0);
  });
  it('shows none when the export has none', () => {
    const t = structuredClone(doc) as unknown as { presets: { followups?: Raw[] }[]; access_lists: Record<string, Raw[]> };
    for (const p of t.presets) for (const f of p.followups || []) delete f.shadow;
    for (const l of Object.values(t.access_lists)) for (const e of l) delete e.shadow;
    const v = slim(t as unknown as ClassExport, undefined, {});
    expect(v.presets.some((p) => p.fu.some((f) => f.sw))).toBe(false);
    expect(Object.values(v.access).some((l) => l.some((e) => e.sh))).toBe(false);
  });
});
