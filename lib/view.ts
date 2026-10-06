// Build time only: shapes one class/spec export into the data the pages
// read (the same shape the reviewed demo embedded), then cuts per-page
// slices from it. Never imported by client code.
import type {
  AccessEntry, Card, ClassExport, Followup, Golden, Input, Preset,
} from './export-types';
import type { ClockEntry, ClockTable, Seg } from './clock';

// ---- the page data shape ---------------------------------------------------

/** An input, compact: h held, p press, d double, c command names, cu
 * unnamed commands, q hotbar, w window, e End, rq requires, as assumed.
 * Keys that must stay up and the condition text are never included. */
export interface InputRec {
  h?: string[];
  p?: string[];
  d?: string[];
  rq?: string[];
  as?: string[];
  c?: string[];
  cu?: number;
  q?: 1;
  w?: number[];
  e?: 1;
}
export type Inp = InputRec | string | null;

/** A follow-up / exit: g group, s skill, to, at, i input, ms (at 100%),
 * sg segment list id, c cards, pl plays, nc no-card reason, of opens at,
 * cf/ca/ct/cp true-cancel frame/action/text/lost %, hb hotbar,
 * un unresolved, tc true cancel, ul Ultimate route. */
export interface FuRec {
  g: string | null;
  s: string | null;
  to: string | null;
  at: string | null;
  i: Inp;
  ms: number | null;
  sg: string;
  c: string[];
  pl?: string;
  nc?: string;
  of?: number;
  cf?: number;
  ca?: string;
  ct?: string;
  cp?: number;
  hb?: 1;
  un?: 1;
  tc?: 1;
  ul?: string;
}

export interface SkillRec {
  name: string | null;
  ids: number[];
  type: string | null;
  specs: Record<string, string | null>;
  inputs: [string[], string][];
  cool: string[];
}

export interface LineRec {
  pct: number | null;
  grade: string | null;
  map: string | null;
  src: string | null;
  reason: string | null;
  why: string | null;
  name: string | null;
  line: number | null;
  skill: number | null;
}

export interface TimelineRec {
  in: Inp;
  req: string | null;
  ends: string | null;
  segs: Seg[];
  ms: number | null;
  ex: FuRec[];
  free: FuRec | null;
  free_why: string | null;
}

export interface EnteredRec {
  mech: string | null;
  base: string | null;
  input: Inp;
  gate: string[];
}

export interface CardRec {
  name: string | null;
  kind: string;
  as_name: string | null;
  rank?: number | null;
  max_rank?: number | null;
  graph_skills: string[];
  access?: string | null;
  reached: [string, string, string, Inp, number | string | null][];
  entered: EnteredRec[];
  nd_why?: string | null;
  timelines?: TimelineRec[];
  gap?: string;
  gap_lines?: string[];
}

/** a tick: [line ids, conditional, frame, why no line] */
export type TickRec = [string[], boolean, number | null, string | null];

export interface Requirement {
  kind?: string;
  buff?: number;
  id?: number;
  active?: boolean;
  op?: string;
  value?: number;
  where?: string;
  name?: string;
  resource?: string;
  text?: string;
}

export interface PresetRec {
  card: string;
  cvia: string | null;
  key: string;
  skill: string;
  entry_action: string | null;
  ult: string | null;
  hb: boolean;
  ws: string | null;
  kind: string | null;
  cool: boolean;
  variant: string | null;
  flip: boolean;
  ms100: number | null;
  segs: Seg[];
  how: string | null;
  timed: boolean;
  path: string[];
  access: string | null;
  no_entry: string | null;
  groups: { name: string | null; action: string | null; ticks: TickRec[] }[];
  reqs: (Requirement | string)[] | null;
  dist: string | null;
  fu: FuRec[];
}

export interface AccessRec {
  rt?: Record<string, string[]>;
  k?: string;
  in?: Inp;
  act?: string;
  fa?: string;
  req?: string;
  fp?: string;
  fc?: string;
  fu?: number;
  f?: number;
  sk?: string;
  card?: string;
  name?: string;
  acts?: string[];
  all?: boolean;
  own?: boolean;
  dist?: string;
}

/** exit windows of an action: clip start / end, [lo, hi, target skills] */
export interface XwRec {
  s: number;
  e: number | null;
  w: [number, number, string[]][];
}

export interface View {
  class: string;
  spec: string | null;
  build: string;
  schema: string;
  profile: string | null;
  speeds: Record<string, number>;
  files: string[];
  skills: Record<string, SkillRec>;
  clock: ClockTable;
  lines: Record<string, LineRec>;
  presets: PresetRec[];
  segs: Record<string, Seg[]>;
  access: Record<string, AccessRec[]>;
  xw: Record<string, XwRec>;
  actcard: Record<string, string>;
  nopreset: Record<string, string>;
  cards: Record<string, CardRec>;
  golden: { clock: Golden['files'][string]['clock']; presets: Golden['files'][string]['presets'] };
}

// ---- helpers ---------------------------------------------------------------

/** A JSON object's entries in the data file's own order (its keys are
 * written sorted), whatever JavaScript does with integer-like keys. */
function ents<T>(o: Record<string, T> | null | undefined): [string, T][] {
  return o ? Object.keys(o).sort().map((k) => [k, o[k]] as [string, T]) : [];
}
const nn = <T>(x: T | undefined): T | null => (x === undefined ? null : x);
const truthy = (x: unknown) => Boolean(x) && !(Array.isArray(x) && x.length === 0);
/** a card id as text ('None' when it is absent, as the reviewed page showed it) */
const pyStr = (x: unknown) => (x === null || x === undefined ? 'None' : String(x));

/** A follow-up the page cannot name: marked so, or its skill is not in the file. */
export function unresolved(f: Record<string, unknown>, skills: Record<string, unknown>): boolean {
  if (f.unresolved || f.resolved === false) return true;
  return !Object.prototype.hasOwnProperty.call(skills, f.skill as string);
}

/** A `distinguishing` value in plain words only; never a raw condition. */
export function plainDist(x: unknown): string | null {
  if (x == null) return null;
  if (typeof x === 'string') return x;
  if (Array.isArray(x)) return x.map(plainDist).filter(Boolean).join('; ') || null;
  if (typeof x === 'object') {
    const o = x as Record<string, unknown>;
    return (o.text as string) || (o.plain as string) || null;
  }
  return null;
}

/** An input as structure, without its condition text and without the keys
 * that must be up. A string input passes through. */
export function slimInput(x: Input | string | null | undefined): Inp {
  if (x == null || typeof x === 'string') return x ?? null;
  const r: InputRec = {};
  const pairs: [keyof Input, 'h' | 'p' | 'd' | 'rq' | 'as'][] = [
    ['held', 'h'], ['press', 'p'], ['double', 'd'], ['requires', 'rq'], ['assumed', 'as']];
  for (const [src, dst] of pairs) {
    const v = x[src] as string[] | undefined;
    if (truthy(v)) r[dst] = [...(v as string[])];
  }
  const cmds = x.commands || [];
  const names = [...new Set(cmds.map((c) => c.name).filter((n): n is string => Boolean(n)))];
  if (names.length) r.c = names;
  if (cmds.some((c) => !c.name)) r.cu = cmds.filter((c) => !c.name).length;
  if (x.quickslot) r.q = 1;
  if (truthy(x.window)) r.w = x.window as number[];
  if (x.end) r.e = 1;
  return r;
}

type FuLike = Partial<Followup> & { segments: string };

export function fuRec(f: FuLike, skills: Record<string, unknown>): FuRec {
  const cancel = f.cancel || ({} as Partial<NonNullable<Followup['cancel']>>);
  const r: FuRec = {
    g: nn(f.group), s: nn(f.skill), to: nn(f.to), at: nn(f.at),
    i: slimInput(f.input), ms: nn(f.ms_100), sg: f.segments,
    c: (f.cards || []).map((c) => pyStr(c)),
  };
  const opt: [keyof FuRec, unknown][] = [
    ['pl', f.plays], ['nc', f.no_card], ['of', f.opens_f], ['cf', cancel.f], ['ca', cancel.at],
    ['ct', cancel.text], ['cp', cancel.lost_pct]];
  for (const [k, v] of opt) if (v != null) (r as unknown as Record<string, unknown>)[k] = v;
  if (f.hotbar) r.hb = 1;
  else if (unresolved(f as Record<string, unknown>, skills)) r.un = 1;
  if (f.true_cancel) r.tc = 1;
  if (f.ultimate) r.ul = f.ultimate.name || 'Ultimate';
  return r;
}

/** Per action on a preset path: its clip range and its rows' distinct exit
 * windows [lo, hi, target skills]. An edge with no window is open from its
 * row's frame to the clip end; an End-only edge draws no band. */
export function exitWindows(doc: ClassExport): Record<string, XwRec> {
  const acts = new Set<string>();
  for (const p of doc.presets) for (const [a] of p.segments) acts.add(a);
  const E = doc.edges || {};
  const EL = doc.edge_lists || {};
  const out: Record<string, XwRec> = {};
  for (const a of [...acts].sort()) {
    const rec = doc.actions[a];
    const clip = rec?.clip;
    const sf = clip?.start_f || 0;
    const ef = clip ? clip.end_f : null;
    const win = new Map<string, { lo: number; hi: number; to: Set<string> }>();
    for (const r of rec?.rows || []) {
      for (const eid of EL[r.list] || []) {
        const e = E[eid];
        if (!e || e.kind !== 'exit') continue;
        let w = e.window;
        if (w == null) {
          if (e.end || ef == null) continue;
          w = [Math.max(sf, r.from_f || 0), ef];
        }
        const key = `${w[0]}|${w[1]}`;
        if (!win.has(key)) win.set(key, { lo: w[0], hi: w[1], to: new Set() });
        if (e.to_skill) win.get(key)!.to.add(e.to_skill);
      }
    }
    const ws = [...win.values()].sort((x, y) => x.lo - y.lo || x.hi - y.hi);
    out[a] = { s: sf, e: ef ?? null, w: ws.map((x) => [x.lo, x.hi, [...x.to].sort()]) };
  }
  return out;
}

const ACTION_TOKEN = /[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+/g;

/** The card each action named in a `distinguishing` text belongs to. */
export function actionCards(
  doc: ClassExport, cards: Record<string, CardRec>, presets: PresetRec[], access: Record<string, AccessRec[]>,
): Record<string, string> {
  const names = new Set<string>();
  for (const p of doc.presets) {
    for (const x of p.distinguishing || []) {
      if (typeof x === 'string') for (const t of x.match(ACTION_TOKEN) || []) if (t in doc.actions) names.add(t);
    }
  }
  const out: Record<string, string> = {};
  const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
  const put = (a: string, c: string | null | undefined) => {
    if (names.has(a) && !has(out, a) && c != null && has(cards, c)) out[a] = c;
  };
  for (const pr of presets) for (const a of pr.path) put(a, pr.card);
  for (const [cid, c] of ents(cards)) for (const t of c.timelines || []) for (const sg of t.segs) put(sg[0], cid);
  for (const [, lst] of ents(access)) {
    for (const e of lst) if (e.k === 'from_skill') for (const a of e.acts || []) put(a, e.card);
  }
  for (const [cid, c] of ents(cards)) {
    for (const g of c.graph_skills || []) for (const a of doc.skills[g]?.entries || []) put(a, cid);
  }
  for (const [k, sk] of ents(doc.skills)) {
    for (const a of sk.entries || []) if (names.has(a) && !has(out, a)) out[a] = 's:' + k;
  }
  for (const pr of doc.presets) {
    for (const a of pr.path || []) if (names.has(a) && !has(out, a)) out[a] = 's:' + pr.skill;
  }
  return out;
}

// ---- what the shaping leaves out ------------------------------------------

/** Every kind of thing slim() leaves out on purpose. Anything else it
 * leaves out is a new kind: the load fails until the page handles it. */
export const KNOWN_DROPS = [
  'access entry: other_skill (Entry Skills cover it)',
  'access entry: own_skill (Entry Skills cover it)',
  'access entry: loop (Entry Skills cover it)',
  'action: no clock rate (its paths show untimed)',
  'gate: no plain words after the dash',
] as const;
const SHOWN_ACCESS = new Set(['press', 'command', 'skill_request', 'from_skill', 'hotbar']);
const DROPPED_ACCESS = new Set(['other_skill', 'own_skill', 'loop']);
const CARD_KINDS = new Set(['skill', 'black_spirit', 'no_damage', 'summon']);

export type Drops = Record<string, number>;
const drop = (d: Drops, why: string, n = 1) => {
  d[why] = (d[why] || 0) + n;
};

/** The drops of a kind slim() does not know, with their counts. */
export function unknownDrops(d: Drops): [string, number][] {
  const known = new Set<string>(KNOWN_DROPS);
  return Object.entries(d).filter(([k, n]) => n > 0 && !known.has(k));
}

// ---- the export as page data ----------------------------------------------

export function slim(doc: ClassExport, gold: Golden['files'][string] | undefined, drops: Drops = {}): View {
  const spec = doc.spec;
  const skills: Record<string, SkillRec> = {};
  for (const [k, s] of ents(doc.skills)) {
    skills[k] = {
      name: nn(s.name), ids: s.ids || [], type: nn(s.type),
      specs: (s.specs || {}) as Record<string, string | null>,
      inputs: (s.entry_inputs || []).map((x) => [x.keys || [], x.text] as [string[], string]),
      cool: [...new Set(Object.values(s.on_cooldown || {}))].sort(),
    };
  }
  const clock: ClockTable = {};
  for (const [a, r] of ents(doc.actions)) {
    const c = r.clock;
    // an action without a rate cannot be timed: left out, so its paths show untimed
    if (c.rate == null) {
      drop(drops, 'action: no clock rate (its paths show untimed)');
      continue;
    }
    clock[a] = [c.rate, c.pool, c.speed_events, c.slow_motion_events] as ClockEntry;
  }
  const lines: Record<string, LineRec> = {};
  for (const [lid, x] of ents(doc.damage_lines)) {
    lines[lid] = {
      pct: nn(x.pct), grade: nn(x.grade), map: nn(x.mapping_grade),
      src: x.value_source ? nn(x.value_source.grade) : null,
      reason: nn(x.reason), why: nn(x.reason_text), name: nn(x.skill_name),
      line: nn(x.line), skill: nn(x.skill),
    };
  }

  const specOf = (c: Card) => {
    const sh = spec ? (c.specs as Record<string, unknown>)?.[spec] : null;
    return (sh || {}) as { as?: number; as_name?: string | null; reached_through?: { from_skill: string; from_action: string; to_action: string; input: string; opens_f: number | string | null }[] };
  };
  const cards: Record<string, CardRec> = {};
  for (const [cid, c] of ents(doc.cards || {})) {
    const sh = specOf(c);
    if (!CARD_KINDS.has(c.kind || 'skill')) drop(drops, `card kind not shown as such: ${c.kind}`);
    for (const e of c.entered_by || []) {
      const n = (e.gate || []).filter((g) => !g.includes(' — ')).length;
      if (n) drop(drops, 'gate: no plain words after the dash', n);
    }
    const rec: CardRec = {
      name: nn(c.name), kind: c.kind || 'skill',
      as_name: sh.as_name || nn(c.name),
      rank: nn(c.rank), max_rank: nn(c.max_rank),
      graph_skills: c.graph_skills || [],
      access: nn(c.access),
      reached: (sh.reached_through || []).map((r) => [
        r.from_skill, r.from_action, r.to_action, slimInput(r.input), nn(r.opens_f)]),
      entered: (c.entered_by || []).map((e) => ({
        mech: nn(e.mechanism),
        base: e.base_card != null ? String(e.base_card) : null,
        input: slimInput(e.input),
        // only the plain words after the dash
        gate: (e.gate || []).filter((g) => g.includes(' — ')).map((g) => g.split(' — ').slice(1).join(' — ')),
      })),
    };
    if (c.timelines != null) {
      rec.nd_why = nn(c.no_damage_reason);
      rec.timelines = c.timelines.map((t) => ({
        in: slimInput(t.entry?.input),
        req: nn(t.entry?.request),
        ends: nn(t.ends), segs: (t.segments || []) as Seg[],
        ms: nn(t.ms_100),
        ex: (t.exits || []).map((f) => fuRec(f as FuLike, doc.skills)),
        free: t.free_to_act ? fuRec(t.free_to_act as unknown as FuLike, doc.skills) : null,
        free_why: nn(t.free_to_act_reason),
      }));
    }
    const gap = c.damage_gap;
    if (gap) {
      rec.gap = gap.text;
      rec.gap_lines = gap.lines || [];
    }
    cards[cid] = rec;
  }

  const presets: PresetRec[] = doc.presets.map((p: Preset) => {
    const pp = p as unknown as Record<string, unknown>;
    return {
      card: 'card' in pp ? pyStr(p.card) : p.skill,
      cvia: nn(p.on_cooldown_via), key: p.key, skill: p.skill, entry_action: nn(p.entry_action),
      ult: p.ultimate ? nn(p.ultimate.name) : null,
      hb: Boolean(p.via_hotbar),
      ws: p.weapon_switch ? p.weapon_switch.name || 'Weapon switch' : null,
      kind: nn(p.kind), cool: Boolean(p.on_cooldown),
      variant: nn(p.variant), flip: Boolean(p.speed_flip),
      ms100: nn(p.ms_100), segs: p.segments as Seg[],
      how: nn(p.how), timed: Boolean(p.timed),
      path: truthy(p.path) ? p.path : p.segments.map((s) => s[0]),
      access: nn(p.access), no_entry: nn(p.no_entry),
      groups: p.groups.map((g) => ({
        name: g.name, action: nn(g.action),
        ticks: g.ticks.map((t) => [
          (t.lines || []).filter(Boolean), Boolean(t.conditional), nn(t.f), nn(t.line_reason)] as TickRec),
      })),
      reqs: (['requirements', 'requires', 'tags']
        .map((k) => pp[k]).find((v) => Array.isArray(v) && v.length) as PresetRec['reqs']) ?? null,
      dist: plainDist(p.distinguishing),
      fu: (p.followups || []).map((f) => fuRec(f, doc.skills)),
    };
  });

  // a from_skill entry may name a card by its shown-as id on this spec
  const asOf: Record<string, string> = {};
  for (const [cid, c] of ents(doc.cards || {})) {
    const sh = specOf(c);
    if (sh.as != null && !(String(sh.as) in asOf)) asOf[String(sh.as)] = cid;
  }
  const cardKey = (c: unknown): string | null => {
    if (c == null) return null;
    const s = String(c);
    return s in cards ? s : (asOf[s] ?? s);
  };
  const access: Record<string, AccessRec[]> = {};
  for (const [lid, entries] of ents(doc.access_lists || {})) {
    for (const e of entries) {
      if (DROPPED_ACCESS.has(e.kind)) drop(drops, `access entry: ${e.kind} (Entry Skills cover it)`);
      else if (!SHOWN_ACCESS.has(e.kind)) drop(drops, `access entry kind not shown: ${e.kind}`);
    }
    access[lid] = entries
      .filter((e) => !['other_skill', 'own_skill', 'loop'].includes(e.kind))
      .map((e: AccessEntry) => {
        const ee = e as unknown as Record<string, unknown>;
        const pairs: [keyof AccessRec, unknown][] = [
          ['rt', e.kind === 'from_skill' ? e.routes : null],
          ['k', e.kind], ['in', slimInput(e.input)], ['act', e.action], ['fa', e.from_action],
          ['req', e.request], ['fp', e.from_preset],
          ['fc', e.from_card == null ? null : String(e.from_card)],
          ['fu', e.followup], ['f', e.f],
          ['sk', e.kind === 'from_skill' ? ee.skill : null],
          ['card', cardKey(e.card)], ['name', e.name], ['acts', e.actions],
          ['all', e.all], ['own', e.own], ['dist', plainDist(ee.distinguishing)]];
        const r: Record<string, unknown> = {};
        for (const [k, v] of pairs) if (v != null) r[k] = v;
        return r as AccessRec;
      });
  }

  const nopreset: Record<string, string> = {};
  for (const [reason, v] of ents(doc.dropped || {})) {
    if (reason.startsWith('preset (presets module)')) {
      for (const k of Object.keys(v.names || {})) {
        if (k in skills) nopreset[k] = reason.split(': ').slice(1).join(': ');
      }
    }
  }
  return {
    class: doc.class, spec, build: doc.build, schema: doc.schema, profile: nn(doc.profile),
    speeds: (doc.speeds_default || {}) as unknown as Record<string, number>,
    files: Object.keys(doc.provenance?.files || {}).sort(),
    skills, clock, lines, presets,
    segs: doc.segment_lists as Record<string, Seg[]>,
    access, xw: exitWindows(doc),
    actcard: actionCards(doc, cards, presets, access),
    nopreset, cards,
    golden: { clock: gold?.clock || [], presets: gold?.presets || [] },
  };
}
