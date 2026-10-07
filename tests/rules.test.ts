// Display rules and data guards that the clock tests do not cover.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { speedsOf } from '../components/useSpeeds';
import { DATA_DIR, classSpecs, loadView, specSeg } from '../lib/data';
import type { ClassExport } from '../lib/export-types';
import { damage, fmtRate, ge } from '../lib/present';
import { SPEED_MAX, SPEED_MIN, defaultSpeeds, speedValue } from '../lib/speeds';
import { listData } from '../lib/data';
import { type Drops, KNOWN_DROPS, slim, unknownDrops } from '../lib/view';

describe('the schema', () => {
  it('is the file whose hash is recorded next to it', () => {
    const dir = join(DATA_DIR, 'schema');
    const lines = readFileSync(join(dir, 'SHA256'), 'utf8').trim().split('\n');
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const [hash, file] = line.trim().split(/\s+/);
      const got = createHash('sha256').update(readFileSync(join(dir, file))).digest('hex');
      expect(`${file} ${got}`).toBe(`${file} ${hash}`);
    }
  });
});

describe('a damage total with gaps', () => {
  for (const cs of classSpecs()) {
    const V = loadView(cs.cls, specSeg(cs.spec));
    it(`is a lower bound whenever a tick has no value (${cs.cls} ${cs.spec})`, () => {
      let withGap = 0;
      const bad: string[] = [];
      for (const p of V.presets) {
        // a tick has no value when it names no line, or a line without a %
        const missing = p.groups.flatMap((g) => g.ticks)
          .filter(([ls]) => !ls.length || ls.some((l) => V.lines[l]?.pct == null)).length;
        const dm = damage(p, V.lines);
        if (dm.missing !== missing) bad.push(`${p.key}: ${dm.missing} ticks without a value, expected ${missing}`);
        if (missing && dm.pct != null) {
          withGap++;
          if (dm.lower !== true) bad.push(`${p.key}: total ${dm.pct} not marked as a lower bound`);
          if (!ge(dm, '1').startsWith('≥') || !fmtRate(1, dm).startsWith('≥')) bad.push(`${p.key}: shown without ≥`);
        }
        if (!missing && dm.lower) bad.push(`${p.key}: marked as a lower bound with no gap`);
      }
      expect(withGap).toBeGreaterThan(0);
      expect(bad).toEqual([]);
    });
  }
});

describe('speeds', () => {
  it('clamps typed and stored values to the input range; anything else is 100', () => {
    expect(speedValue('130')).toBe(130);
    expect(speedValue(115)).toBe(115);
    expect(speedValue('10')).toBe(SPEED_MIN);
    expect(speedValue('0')).toBe(SPEED_MIN);
    expect(speedValue('-20')).toBe(SPEED_MIN);
    expect(speedValue('999')).toBe(SPEED_MAX);
    expect(speedValue('1e9')).toBe(SPEED_MAX);
    expect(speedValue('')).toBe(100);
    expect(speedValue('abc')).toBe(100);
    expect(speedValue(null)).toBe(100);
    expect(speedValue(undefined)).toBe(100);
    expect(speedValue('Infinity')).toBe(100);
    expect(speedValue({})).toBe(100);
    expect(speedsOf({ attack: '400', casting: 'x', movement: '75' })).toEqual({ attack: SPEED_MAX, casting: 100, movement: 75 });
  });
});

describe('the default speeds', () => {
  it("come from the class file's speeds_default, else 100", () => {
    expect(defaultSpeeds({ attack: 130, casting: 115, movement: 110 })).toEqual({ attack: 130, casting: 115, movement: 110 });
    expect(defaultSpeeds({ attack: 120 })).toEqual({ attack: 120, casting: 100, movement: 100 });
    expect(defaultSpeeds(null)).toEqual({ attack: 100, casting: 100, movement: 100 });
    expect(defaultSpeeds({ attack: 'x', casting: 999, movement: -5 })).toEqual({ attack: 100, casting: SPEED_MAX, movement: SPEED_MIN });
  });
  for (const cs of classSpecs()) {
    it(`are what each page starts at (${cs.cls} ${cs.spec})`, () => {
      const doc = JSON.parse(readFileSync(join(cs.dir, cs.file), 'utf8')) as ClassExport;
      expect(listData(cs.cls, specSeg(cs.spec)).speeds).toEqual(defaultSpeeds(doc.speeds_default));
    });
  }
});

describe('what the shaping leaves out', () => {
  const cs = classSpecs()[0];
  const doc = JSON.parse(readFileSync(join(cs.dir, cs.file), 'utf8')) as ClassExport;

  it('is only of known kinds on the real data', () => {
    const d: Drops = {};
    slim(doc, undefined, d);
    expect(unknownDrops(d)).toEqual([]);
    for (const k of Object.keys(d)) expect(KNOWN_DROPS as readonly string[]).toContain(k);
  });

  it('notices a new kind of access entry or card', () => {
    const t = structuredClone(doc);
    const lid = Object.keys(t.access_lists)[0];
    t.access_lists[lid].push({ ...t.access_lists[lid][0], kind: 'teleport' as never });
    const cid = Object.keys(t.cards)[0];
    t.cards[cid].kind = 'pet' as never;
    const d: Drops = {};
    slim(t, undefined, d);
    expect(unknownDrops(d).map(([k]) => k).sort()).toEqual(['access entry kind not shown: teleport', 'card kind not shown as such: pet']);
  });
});
