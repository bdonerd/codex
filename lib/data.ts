// Build time only: finds the data, shapes it (lib/view.ts) and cuts the
// slice each page needs. Pages never receive the whole class file.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ClassExport, Golden, Manifest } from './export-types';
import type { ClockTable, Seg } from './clock';
import {
  type Slice, cardName, damage, isSummon, mainInput, readable, slugify,
} from './present';
import {
  type CardRec, type Drops, type PresetRec, type SkillRec, type View, slim, unknownDrops,
} from './view';
import type { CardPayload, SpecShared } from './card-slice';
import { defaultSpeeds } from './speeds';

export const DATA_DIR = join(process.cwd(), 'data');

export interface ClassSpec {
  cls: string;
  spec: string | null;
  build: string;
  file: string;
  dir: string;
}

/** Every class file in the newest build directory that has it. */
export function classSpecs(): ClassSpec[] {
  const builds = readdirSync(DATA_DIR)
    .filter((d) => statSync(join(DATA_DIR, d)).isDirectory() && existsSync(join(DATA_DIR, d, 'manifest.json')))
    .sort()
    .reverse();
  const out = new Map<string, ClassSpec>();
  for (const b of builds) {
    const man = JSON.parse(readFileSync(join(DATA_DIR, b, 'manifest.json'), 'utf8')) as Manifest;
    for (const [file, m] of Object.entries(man.files)) {
      const k = `${m.class}.${m.spec ?? ''}`;
      if (!out.has(k)) out.set(k, { cls: m.class, spec: m.spec ?? null, build: man.build, file, dir: join(DATA_DIR, b) });
    }
  }
  return [...out.values()].sort((a, b) => a.cls.localeCompare(b.cls) || String(a.spec).localeCompare(String(b.spec)));
}

/** the URL segment of a spec ('all' for the all-skills file) */
export const specSeg = (spec: string | null) => spec ?? 'all';
export const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const cache = new Map<string, View>();
export function loadView(cls: string, specSegment: string): View {
  const key = `${cls}/${specSegment}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const cs = classSpecs().find((c) => c.cls === cls && specSeg(c.spec) === specSegment);
  if (!cs) throw new Error(`no data for ${key}`);
  const doc = JSON.parse(readFileSync(join(cs.dir, cs.file), 'utf8')) as ClassExport;
  const gold = JSON.parse(readFileSync(join(cs.dir, 'golden.json'), 'utf8')) as Golden;
  const drops: Drops = {};
  const v = slim(doc, gold.files[cs.file], drops);
  const unknown = unknownDrops(drops);
  if (unknown.length) {
    throw new Error(`${cs.file}: left out something of a kind the pages do not know: ${unknown.map(([k, n]) => `${k} (${n})`).join('; ')}`);
  }
  console.log(`${cs.file}: left out ${Object.entries(drops).map(([k, n]) => `${k}: ${n}`).join('; ') || 'nothing'}`);
  cache.set(key, v);
  return v;
}

// ---- what every page shares --------------------------------------------------

export function idNameOf(V: View): Record<string, string> {
  const idName: Record<string, string> = {};
  for (const l of Object.values(V.lines)) if (l.name) idName[String(l.skill)] = l.name;
  for (const s of Object.values(V.skills)) for (const i of s.ids) if (s.name) idName[String(i)] = s.name;
  return idName;
}
export const coolOf = (V: View) => [...new Set(Object.values(V.skills).flatMap((s) => s.cool))].sort();

/** cards with presets, and cards with timelines but no preset */
export function cardSets(V: View) {
  const PS: Record<string, PresetRec[]> = {};
  for (const p of V.presets) (PS[p.card] = PS[p.card] || []).push(p);
  for (const list of Object.values(PS)) {
    list.sort((a, b) => (a.ms100 == null ? Infinity : a.ms100) - (b.ms100 == null ? Infinity : b.ms100) || 0);
  }
  const ND = Object.keys(V.cards).filter((k) => V.cards[k].timelines && PS[k] === undefined);
  return { PS, ND };
}

export function slugsOf(V: View): Record<string, string> {
  const { PS, ND } = cardSets(V);
  const out: Record<string, string> = {};
  for (const k of [...Object.keys(PS), ...ND]) out[k] = `${k}-${slugify(cardName(V, k))}`;
  return out;
}

function pickClock(V: View, segLists: Iterable<Seg[]>): ClockTable {
  const c: ClockTable = {};
  for (const segs of segLists) for (const [a] of segs) if (V.clock[a]) c[a] = V.clock[a];
  return c;
}

const nameOnlyCard = (c: CardRec): CardRec => ({
  name: c.name, kind: c.kind, as_name: c.as_name, graph_skills: [], reached: [], entered: [],
});
const nameOnlySkill = (s: SkillRec): SkillRec => ({ name: s.name, ids: s.ids, type: null, specs: s.specs, inputs: [], cool: [] });

// ---- the card list -----------------------------------------------------------

export interface ListCard {
  id: string;
  slug: string;
  name: string;
  kind: string;
  section: 'skill' | 'bs' | 'summon' | 'nd';
  keys: string | null;
  search: string;
  /** per preset off cooldown: total %, lower bound, follow-up segment lists */
  presets: { pct: number | null; lower: boolean; sgs: string[] }[];
  /** no-damage cards: each timeline's free-to-act segment list */
  free: string[];
}
export interface ListData {
  cls: string;
  spec: string | null;
  label: string;
  build: string;
  schema: string;
  counts: { damage: number; noDamage: number; summon: number; presets: number; followups: number };
  /** the speeds the page starts at and Reset returns to */
  speeds: { attack: number; casting: number; movement: number };
  cards: ListCard[];
  clock: ClockTable;
  segs: Record<string, Seg[]>;
  rest: { name: string; reached: boolean; why: string }[];
}

export function listData(cls: string, specSegment: string): ListData {
  const V = loadView(cls, specSegment);
  const { PS, ND } = cardSets(V);
  const slugs = slugsOf(V);
  const cool = new Set(coolOf(V));
  const used = new Set<string>();
  const cards: ListCard[] = [];
  for (const k of [...Object.keys(PS), ...ND]) {
    const c = V.cards[k] || ({ graph_skills: [] } as unknown as CardRec);
    const ps = PS[k] || [];
    const presets = ps.filter((p) => !p.cool).map((p) => {
      const dm = damage(p, V.lines);
      const sgs = [...new Set(p.fu.filter((f) => !f.un && !cool.has(f.to as string) && !cool.has(f.pl as string)).map((f) => f.sg))];
      if (dm.pct != null) for (const s of sgs) used.add(s);
      return { pct: dm.pct, lower: dm.lower, sgs: dm.pct != null ? sgs : [] };
    });
    const free = (c.timelines || []).map((t) => t.free?.sg).filter((s): s is string => Boolean(s));
    for (const s of free) used.add(s);
    const section = PS[k] ? (c.kind === 'black_spirit' ? 'bs' : 'skill') : isSummon(c) ? 'summon' : 'nd';
    cards.push({
      id: k, slug: slugs[k], name: cardName(V, k), kind: c.kind, section,
      keys: mainInput(V, c),
      search: [cardName(V, k), ...ps.flatMap((p) => p.groups.map((g) => readable(g.name)))].join('\n').toLowerCase(),
      presets, free,
    });
  }
  const segs: Record<string, Seg[]> = {};
  for (const s of [...used].sort()) segs[s] = V.segs[s];
  const inCard = new Set([...Object.keys(PS), ...ND].flatMap((c) => (V.cards[c] || { graph_skills: [] }).graph_skills || []));
  const rest = Object.keys(V.skills).filter((k) => !inCard.has(k))
    .map((k) => ({
      name: V.skills[k].name || `Unnamed skill (${V.skills[k].ids.join(', ')})`,
      reached: V.spec != null && V.skills[k].specs[V.spec] === 'reached_through',
      why: V.nopreset[k] || 'its damage is shown under another card, or the spec keeps none of its presets',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    cls: V.class, spec: V.spec, label: `${title(V.class)} · ${V.spec ? title(V.spec) : 'All skills'}`,
    build: V.build, schema: V.schema,
    counts: {
      damage: Object.keys(PS).length,
      noDamage: ND.filter((k) => !isSummon(V.cards[k])).length,
      summon: ND.filter((k) => isSummon(V.cards[k])).length,
      presets: V.presets.length,
      followups: V.presets.reduce((n, p) => n + p.fu.length, 0),
    },
    speeds: defaultSpeeds(V.speeds),
    cards, clock: pickClock(V, Object.values(segs)), segs, rest,
  };
}

// ---- one card ------------------------------------------------------------------

export interface CardData {
  cls: string;
  spec: string | null;
  label: string;
  id: string;
  slice: Slice;
  /** its presets (sorted by time at 100%), or none for a no-damage card */
  presets: PresetRec[];
}

export function cardParams(cls: string, specSegment: string): string[] {
  return Object.values(slugsOf(loadView(cls, specSegment)));
}

export function cardData(cls: string, specSegment: string, param: string): CardData {
  const V = loadView(cls, specSegment);
  const slugs = slugsOf(V);
  const id = Object.keys(slugs).find((k) => slugs[k] === param);
  if (!id) throw new Error(`no card ${param} in ${cls}/${specSegment}`);
  const { PS } = cardSets(V);
  const presets = PS[id] || [];
  const card = V.cards[id];

  const segIds = new Set<string>();
  const inline: Seg[][] = [];
  const lineIds = new Set<string>(card.gap_lines || []);
  for (const p of presets) {
    inline.push(p.segs);
    for (const f of p.fu) segIds.add(f.sg);
    for (const g of p.groups) for (const t of g.ticks) for (const l of t[0]) lineIds.add(l);
  }
  for (const t of card.timelines || []) {
    inline.push(t.segs);
    for (const f of t.ex) segIds.add(f.sg);
    if (t.free) segIds.add(t.free.sg);
  }
  const segs: Record<string, Seg[]> = {};
  for (const s of [...segIds].sort()) if (V.segs[s]) segs[s] = V.segs[s];
  const all = [...inline, ...Object.values(segs)];
  const xw: Slice['xw'] = {};
  for (const sg of all) for (const [a] of sg) if (V.xw[a]) xw[a] = V.xw[a];
  const lines: Slice['lines'] = {};
  for (const l of [...lineIds].sort()) if (V.lines[l]) lines[l] = V.lines[l];
  const access: Slice['access'] = {};
  for (const id2 of [card.access, ...presets.map((p) => p.access)]) if (id2 && V.access[id2]) access[id2] = V.access[id2];
  const skills: Slice['skills'] = {};
  for (const [k, s] of Object.entries(V.skills)) skills[k] = card.graph_skills.includes(k) ? s : nameOnlySkill(s);
  const cards: Slice['cards'] = {};
  for (const [k, c] of Object.entries(V.cards)) cards[k] = k === id ? c : nameOnlyCard(c);

  return {
    cls: V.class, spec: V.spec, label: `${title(V.class)} · ${V.spec ? title(V.spec) : 'All skills'}`,
    id, presets,
    slice: {
      class: V.class, spec: V.spec, skills, clock: pickClock(V, all), lines,
      presets, segs, access, xw, cards, idName: idNameOf(V), cool: coolOf(V), slugs,
    },
  };
}

/** The full view as a slice (tests and checks). */
export function fullSlice(V: View): Slice {
  return {
    class: V.class, spec: V.spec, skills: V.skills, clock: V.clock, lines: V.lines, presets: V.presets,
    segs: V.segs, access: V.access, xw: V.xw, cards: V.cards, idName: idNameOf(V), cool: coolOf(V), slugs: slugsOf(V),
  };
}

// ---- the spec page: shared names, and each card's data loaded on open ----------

/** what every section of a spec page shares: names only */
export function specShared(cls: string, specSegment: string): SpecShared {
  const V = loadView(cls, specSegment);
  const skills: SpecShared['skills'] = {};
  for (const [k, s] of Object.entries(V.skills)) skills[k] = nameOnlySkill(s);
  const cards: SpecShared['cards'] = {};
  for (const [k, c] of Object.entries(V.cards)) cards[k] = nameOnlyCard(c);
  return { class: V.class, spec: V.spec, skills, cards, idName: idNameOf(V), cool: coolOf(V), slugs: slugsOf(V) };
}

/** the card ids that have a section (and a data file) */
export const cardIds = (cls: string, specSegment: string) => Object.keys(slugsOf(loadView(cls, specSegment)));

/** one card's own data: with specShared it makes the card's slice */
export function cardPayload(cls: string, specSegment: string, id: string): CardPayload {
  const V = loadView(cls, specSegment);
  const slug = slugsOf(V)[id];
  if (!slug) throw new Error(`no card ${id} in ${cls}/${specSegment}`);
  const d = cardData(cls, specSegment, slug);
  const S = d.slice;
  const card = S.cards[id];
  const skills: CardPayload['skills'] = {};
  for (const k of card.graph_skills) if (S.skills[k]) skills[k] = S.skills[k];
  return { id, presets: d.presets, clock: S.clock, lines: S.lines, segs: S.segs, access: S.access, xw: S.xw, skills, card };
}
