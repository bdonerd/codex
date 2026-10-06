// What the pages show, as plain data: names, inputs in plain words,
// damage sums, follow-up grouping and labels. Times come only from
// lib/clock.ts. Safe for the browser.
import {
  type ClockTable, type Seg, type Speeds, ratePerSec, segMs,
} from './clock';
import type {
  AccessRec, CardRec, FuRec, Inp, InputRec, LineRec, PresetRec, Requirement, SkillRec,
} from './view';

/** The part of the page data a page needs (a slice of the class view). */
export interface Slice {
  class: string;
  spec: string | null;
  skills: Record<string, SkillRec>;
  clock: ClockTable;
  lines: Record<string, LineRec>;
  presets: PresetRec[];
  segs: Record<string, Seg[]>;
  access: Record<string, AccessRec[]>;
  xw: Record<string, { s: number; e: number | null; w: [number, number, string[]][] }>;
  cards: Record<string, CardRec>;
  /** game skill id -> name, for inputs that name a skill by id */
  idName: Record<string, string>;
  /** actions played on cooldown */
  cool: string[];
  /** card id -> its page's path segment */
  slugs: Record<string, string>;
}

// ---- names -----------------------------------------------------------------

export const nice = (s: string | null | undefined) => (s || '').replace(/Mouse0/g, 'LMB').replace(/Mouse1/g, 'RMB');

export function skillName(D: Pick<Slice, 'skills'>, k: string | null): string {
  const s = k == null ? undefined : D.skills[k];
  return s ? s.name || `Unnamed skill (${s.ids.join(', ')})` : String(k);
}
export function cardName(D: Pick<Slice, 'cards'>, c: string): string {
  const x = D.cards[c];
  return x ? x.as_name || x.name || `Skill ${c}` : `Skill ${c}`;
}
export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'skill';

/** An action / group name made readable. */
export function readable(n: string | null | undefined): string {
  const m = /^(.*?)(?:\[(\d+)(?:-(\d+))?\])?$/.exec(n || '')!;
  let base = m[1].replace(/^BT_/, '').replace(/^UP_/i, '').replace(/^skill_/i, '').replace(/_/g, ' ');
  if (m[2]) base += m[3] ? ` · hits ${m[2]}–${m[3]}` : ` · hit ${m[2]}`;
  return base;
}

// keys that must stay UP are hidden
export const dropUp = (s: string | null | undefined) =>
  (s || '').replace(/(?:!\w+)+/g, ' ').replace(/,\s*[A-Za-z0-9+]+ up\b/g, '').replace(/\s{2,}/g, ' ').trim();

const K_MOD = ['Shift', 'Ctrl', 'Alt'];
const K_DIR = ['W', 'A', 'S', 'D'];
const K_OTHER = ['Space', 'E', 'F', 'Q', 'R', 'Z', 'X', 'C', 'V', 'T', 'G', 'B', 'Tab'];
const K_MOUSE = ['LMB', 'RMB'];
function keyRank(k: string): [number, string] {
  k = nice(k);
  for (const [base, list] of [[0, K_MOD], [10, K_DIR], [100, K_OTHER], [1000, K_MOUSE]] as [number, string[]][]) {
    const i = list.indexOf(k);
    if (i >= 0) return [base + i, k];
  }
  return [500, k];
}
/** modifiers, then WASD, then other keys, then the mouse */
export const sortKeys = (ks: string[]) => ks.slice().sort((a, b) => {
  const x = keyRank(a);
  const y = keyRank(b);
  return x[0] - y[0] || x[1].localeCompare(y[1]);
});
/** "A+Shift" -> "Shift + A" inside any text */
export const orderCombos = (t: string) =>
  t.replace(/[A-Za-z0-9]+(?:\+[A-Za-z0-9]+)+/g, (m) => sortKeys(m.split('+')).map(nice).join(' + '));

// ---- inputs in plain words -------------------------------------------------

/** a piece of an input: a verb with keys, or plain words */
export type InPart = { verb: string; keys: string[] } | { text: string };
export interface InputWords {
  parts: InPart[];
  /** text with key tokens marked (string inputs) */
  keyText?: string;
  plain: string;
  rq: string[];
  as: string[];
}

export function inputText(s: string, idName: Record<string, string>) {
  s = dropUp(nice(s)).replace(/\bskill (\d+)/g, (x, i) => (idName[i] ? `skill “${idName[i]}”` : x));
  const parts = s.split(/\s+assumed\s+/);
  return { press: parts[0], assumed: parts.slice(1) };
}

export function inp(i: Inp | undefined, idName: Record<string, string> = {}): InputWords {
  if (i == null) return { parts: [], plain: '', rq: [], as: [] };
  if (typeof i === 'string') {
    const t = inputText(i, idName);
    return { parts: [], keyText: t.press, plain: t.press, rq: [], as: t.assumed };
  }
  const H: InPart[] = [];
  const P: string[] = [];
  const keys = (verb: string, ks?: string[]) => {
    if (ks && ks.length) {
      ks = sortKeys(ks);
      H.push({ verb, keys: ks.map(nice) });
      P.push(verb + ' ' + ks.map(nice).join(' + '));
    }
  };
  keys('hold', i.h);
  keys('press', i.p);
  keys('double-tap', i.d);
  if (i.c && i.c.length) {
    const t = 'the ' + i.c.join(' / ') + ' command';
    H.push({ text: t });
    P.push(t);
  }
  if (i.cu && !(i.c && i.c.length)) {
    H.push({ text: 'a skill command' });
    P.push('a skill command');
  }
  if (i.q) {
    H.push({ text: 'a skill from the hotbar' });
    P.push('a skill from the hotbar');
  }
  if (i.e) {
    H.push({ text: 'when the action ends' });
    P.push('when the action ends');
  }
  if (!H.length) H.push({ text: 'no input' });
  return { parts: H, plain: P.join(', ') || 'no input', rq: i.rq || [], as: i.as || [] };
}

/** Text with key names marked: [text, isKey] pieces. */
export function keyPieces(t: string): [string, boolean][] {
  const s = orderCombos(dropUp(nice(t)));
  const rx = /\b(LMB|RMB|Shift|Space|[A-Z0-9]|F\d+|Tab|Ctrl)\b(?=[+, ;]|$)/g;
  const out: [string, boolean][] = [];
  let last = 0;
  for (let m; (m = rx.exec(s));) {
    if (m.index > last) out.push([s.slice(last, m.index), false]);
    out.push([m[1], true]);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push([s.slice(last), false]);
  return out;
}

// ---- requirement chips -----------------------------------------------------

export interface ChipData {
  cls: string;
  label: string;
  title?: string;
}
const RESOURCE_NAME: Record<string, string> = { sorceress: 'Shards' };
const OPS: Record<string, string> = { '>=': '≥', '<=': '≤', '>': '>', '<': '<', '==': '=', '!=': '≠' };

export function reqChips(list: (Requirement | string)[] | null | undefined, cls: string): ChipData[] {
  if (!list || !list.length) return [];
  const seen = new Set<string>();
  const out: ChipData[] = [];
  for (const r of list) {
    let c: ChipData;
    if (typeof r === 'string') c = { cls: 'chip c-req', label: r };
    else {
      const title = r.where || undefined;
      if (r.kind === 'class_resource' || r.op != null) {
        const nm = r.name || r.resource || RESOURCE_NAME[cls] || 'class resource';
        c = { cls: 'chip c-req', label: `${nm} ${OPS[r.op || ''] || r.op || ''} ${r.value ?? ''}`, title };
      } else if (r.kind === 'buff' || r.buff != null) {
        c = { cls: 'chip c-req', label: `${r.active === false ? 'not ' : ''}Buff ${r.buff ?? r.id}${r.name ? ' ' + r.name : ''}`, title };
      } else c = { cls: 'chip c-req', label: r.text || r.kind || 'requires', title };
    }
    const k = JSON.stringify(c);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(c);
    }
  }
  return out;
}

const RES_RE = /^class resource\s*(>=|<=|==|!=|>|<)\s*(\d+)$/;
/** requires (plain words) as chips; a requirement always true on this
 * spec is dropped; an Ultimate already chipped is not repeated */
export function reqAs(x: InputWords, ul: string | null | undefined, spec: string | null, cls: string): ChipData[] {
  const out: ChipData[] = [];
  const alwaysTrue = (r: string) => Boolean(spec) && new RegExp(`^requires the ${spec} skill$`, 'i').test(r);
  for (const r of x.rq) {
    const m = RES_RE.exec(r);
    if (m) {
      out.push(...reqChips([{ kind: 'class_resource', op: m[1], value: +m[2] }], cls));
      continue;
    }
    if (alwaysTrue(r)) continue;
    const label = r.replace(/^requires\s+/i, '');
    if (ul && label === ul) continue;
    out.push({ cls: /^(state:|condition \d)/i.test(label) ? 'chip' : 'chip c-req', label, title: r });
  }
  return out;
}

// ---- numbers ---------------------------------------------------------------

export const fmt = (x: number | null | undefined, d = 0) =>
  x == null || !Number.isFinite(x) ? '–' : x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export interface Damage {
  pct: number | null;
  lower: boolean;
  missing: number;
  ticks: number;
  cond: number;
  why: string[];
}

/** A preset's total %: never a false zero. A tick without a value makes
 * the total a lower bound. */
export function damage(p: PresetRec, lines: Record<string, LineRec>): Damage {
  let sum = 0;
  let known = 0;
  let missing = 0;
  let ticks = 0;
  let cond = 0;
  const why = new Set<string>();
  for (const g of p.groups) {
    for (const [ls, c, , lineWhy] of g.ticks) {
      ticks++;
      if (c) cond++;
      let ok = ls.length > 0;
      if (!ok) why.add(lineWhy || 'no damage line');
      for (const l of ls) {
        const L = lines[l];
        const v = L ? L.pct : null;
        if (v == null) {
          ok = false;
          why.add(L ? L.why || L.reason || 'no value' : 'line not in the data');
        } else {
          sum += v;
          known++;
        }
      }
      if (!ok) missing++;
    }
  }
  return { pct: known ? sum : null, lower: missing > 0, missing, ticks, cond, why: [...why] };
}

export const ge = (dm: Damage | null | undefined, s: string) => (dm && dm.lower ? `≥ ${s}` : s);
export const fmtRate = (r: number | null, dm: Damage | null | undefined) => (r == null ? '–' : ge(dm, fmt(r)));
export const byRate = (a: { rate: number | null }, b: { rate: number | null }) =>
  (b.rate == null ? -Infinity : b.rate) - (a.rate == null ? -Infinity : a.rate) || 0;

// ---- follow-ups ------------------------------------------------------------

export interface FuNamePart {
  name: string;
  card?: string;
}
/** what a follow-up enters, as name parts (a card each, linkable) */
export function fuParts(D: Pick<Slice, 'skills' | 'cards'>, f: FuRec): FuNamePart[] {
  if (f.hb) return [{ name: 'Hotbar skill' }];
  if (f.un) return [{ name: `Unresolved skill request (${f.to})` }];
  if (f.c.length) {
    const seen = new Map<string, string>();
    for (const c of f.c) {
      const n = cardName(D, c);
      if (!seen.has(n)) seen.set(n, c);
    }
    return [...seen].map(([name, card]) => ({ name, card }));
  }
  return [{ name: skillName(D, f.s) }];
}
export const fuName = (D: Pick<Slice, 'skills' | 'cards'>, f: FuRec) => fuParts(D, f).map((x) => x.name).join(' + ');

export interface TimedFu extends FuRec {
  t: number | null;
  rate: number | null;
  cool: boolean;
}

/** follow-ups / exits at the given speeds; dm null = no %/s */
export function timeFus(D: Pick<Slice, 'clock' | 'segs'>, cool: Set<string>, list: FuRec[], dm: Damage | null, sp: Speeds): TimedFu[] {
  return list.map((f) => {
    const ms = segMs(D.clock, D.segs[f.sg], sp);
    const rate = dm && !f.un && dm.pct != null ? ratePerSec(dm.pct, ms) : null;
    return { ...f, t: ms, rate, cool: cool.has(f.to as string) || cool.has(f.pl as string) };
  });
}

/** the same skill by the same input through several rows: one row, at
 * the earliest time */
export function mergeFus(D: Pick<Slice, 'skills' | 'cards' | 'idName'>, fus: TimedFu[]): TimedFu[] {
  const best = new Map<string, TimedFu>();
  for (const f of fus) {
    const k = [f.cool ? 'cool' : '', f.un ? 'un' : '', f.ul ? 'ult:' + f.ul : '', fuName(D, f), inp(f.i, D.idName).plain].join('|');
    const b = best.get(k);
    if (!b || (f.t != null && (b.t == null || f.t < b.t))) best.set(k, f);
  }
  return [...best.values()];
}

export interface Timed {
  fin: number | null;
  fus: TimedFu[];
  lo: number | null;
  hi: number | null;
}
export function timed(D: Slice, p: PresetRec, dm: Damage, sp: Speeds): Timed {
  const fin = segMs(D.clock, p.segs, sp);
  const fus = mergeFus(D, timeFus(D, new Set(D.cool), p.fu, dm, sp));
  const rates = fus.filter((f) => !f.cool && !f.un && f.rate != null).map((f) => f.rate as number);
  return { fin, fus, lo: rates.length ? Math.min(...rates) : null, hi: rates.length ? Math.max(...rates) : null };
}

/** follow-up groups: distinct opening times numbered 1.. over the whole list */
export function groupNumbers(fus: { t: number | null }[]): Map<string, number> {
  const ks = [...new Set(fus.filter((f) => f.t != null).map((f) => (f.t as number).toFixed(1)))].sort((a, b) => +a - +b);
  return new Map(ks.map((k, i) => [k, i + 1]));
}

export interface FuBlock {
  key: string;
  num?: number;
  t: number | null;
  live: TimedFu[];
  cool: TimedFu[];
  un: TimedFu[];
  rate: number | null;
  anyTc: boolean;
  skills: number;
}
/** one block per moment follow-ups open, in time order; the filter keeps
 * the numbers */
export function fuBlocks(D: Pick<Slice, 'skills' | 'cards' | 'idName'>, fus: TimedFu[], q: string): { blocks: FuBlock[]; maxRate: number; shown: number } {
  q = (q || '').trim().toLowerCase();
  const hit = (f: TimedFu) => !q || (fuName(D, f) + ' ' + inp(f.i, D.idName).plain).toLowerCase().includes(q);
  const shown = fus.filter(hit);
  const byKey = new Map<string, TimedFu[]>();
  for (const f of shown) {
    const k = f.t == null ? 'none' : f.t.toFixed(1);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(f);
  }
  const tOf = (k: string) => (k === 'none' ? null : +k);
  const order = [...byKey.entries()].sort((a, b) => {
    const x = tOf(a[0]);
    const y = tOf(b[0]);
    return Number(x == null) - Number(y == null) || ((x as number) - (y as number)) || 0;
  });
  const maxRate = Math.max(1e-9, ...fus.filter((f) => f.rate != null && !f.cool).map((f) => f.rate as number));
  const num = groupNumbers(fus);
  const nameCmp = (a: TimedFu, b: TimedFu) => fuName(D, a).localeCompare(fuName(D, b));
  const blocks = order.map(([k, fs]) => {
    fs.sort(nameCmp);
    const live = fs.filter((f) => !f.cool && !f.un);
    const withRate = live.filter((f) => f.rate != null);
    return {
      key: k, num: num.get(k), t: tOf(k), live,
      cool: fs.filter((f) => f.cool && !f.un), un: fs.filter((f) => f.un),
      rate: withRate.length ? withRate[0].rate : null,
      anyTc: fs.some((f) => f.tc), skills: new Set(live.map((f) => fuName(D, f))).size,
    };
  });
  return { blocks, maxRate, shown: shown.length };
}

// ---- Entry Skills ----------------------------------------------------------

export interface EntryItem {
  name: string;
  card?: string;
  own: boolean;
  all: boolean;
  allUlt: boolean;
  anyUlt: boolean;
  acts: { label: string; ult: 'only' | 'also' | null }[];
}
export interface EntrySkills {
  head: string;
  cmd: boolean;
  hot: boolean;
  items: EntryItem[];
}
export function entrySkills(D: Pick<Slice, 'access' | 'cards' | 'skills'>, lists: (string | null | undefined)[]): EntrySkills {
  const L = ([] as AccessRec[]).concat(...lists.filter(Boolean).map((id) => D.access[id as string] || []));
  const idle = L.some((e) => e.k === 'press');
  const cmd = L.some((e) => e.k === 'command');
  const hot = L.some((e) => e.k === 'hotbar');
  const src = new Map<string, { name: string; card?: string; own: boolean; all: boolean; acts: Map<string, Set<string>> }>();
  for (const e of L) {
    if (e.k !== 'from_skill') continue;
    const isCard = Boolean(e.card && D.cards[e.card]);
    const name = isCard ? cardName(D, e.card as string) : e.name || skillName(D, e.sk ?? null);
    if (!src.has(name)) src.set(name, { name, card: isCard ? e.card : undefined, own: Boolean(e.own), all: false, acts: new Map() });
    const x = src.get(name)!;
    if (e.all === true) x.all = true;
    if (e.own) x.own = true;
    for (const a of e.acts || []) {
      const k = readable(a);
      if (!x.acts.has(k)) x.acts.set(k, new Set());
      for (const r of (e.rt && e.rt[a]) || ['plain']) x.acts.get(k)!.add(r);
    }
  }
  const ultOnly = (rs: Set<string>) => rs.has('ultimate') && !rs.has('plain');
  const items = [...src.values()]
    .sort((a, b) => Number(b.own) - Number(a.own) || a.name.localeCompare(b.name))
    .map((x) => {
      const rs = [...x.acts.values()];
      return {
        name: x.name, card: x.card, own: x.own, all: x.all,
        anyUlt: rs.some((r) => r.has('ultimate')),
        allUlt: rs.length > 0 && rs.every(ultOnly),
        acts: [...x.acts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, r]) => ({
          label, ult: ultOnly(r) ? ('only' as const) : r.has('ultimate') ? ('also' as const) : null,
        })),
      };
    });
  const head = [src.size ? String(src.size) : '', cmd ? 'skill command' : '', hot ? 'Hotbar' : ''].filter(Boolean).join(' · ') || (idle ? '' : 'unknown');
  return { head, cmd, hot, items };
}

// ---- cards and presets -----------------------------------------------------

/** a card's main input: its first graph skill's first entry input */
export function mainInput(D: Pick<Slice, 'skills'>, c: Pick<CardRec, 'graph_skills'> | undefined): string | null {
  const g = (c?.graph_skills || []).find((g) => D.skills[g] && D.skills[g].inputs.length);
  if (!g) return null;
  const keys = D.skills[g].inputs[0][0];
  return keys.length ? 'hold ' + sortKeys(keys).map(nice).join(' + ') : null;
}

const ownKeys = (i: Inp | undefined): i is InputRec =>
  Boolean(i) && typeof i === 'object' && ((i as InputRec).h || []).length + ((i as InputRec).p || []).length + ((i as InputRec).d || []).length > 0;
const keysOnly = (i: InputRec) => inp({ h: i.h, p: i.p, d: i.d }).plain;

/** a preset's own input: its press entries with keys of their own */
export function presetInput(D: Pick<Slice, 'access'>, p: PresetRec): string[] {
  const L = (p.access && D.access[p.access]) || [];
  return [...new Set(L.filter((e) => (e.k === 'press' || e.k === 'skill_request') && ownKeys(e.in)).map((e) => keysOnly(e.in as InputRec)))];
}

/** a distinct label per preset on a card: its damage groups; where two
 * share them, the entry action; then the press input; then a number */
export function labelPresets(D: Pick<Slice, 'access'>, ps: PresetRec[]): Map<string, string> {
  const base = (p: PresetRec) => p.groups.map((g) => readable(g.name)).join(' + ');
  const from = (p: PresetRec) => base(p) + ' · from ' + readable(p.entry_action || (p.path || [])[0] || '');
  const steps = [from, (p: PresetRec) => {
    const pi = presetInput(D, p);
    return from(p) + (pi.length ? ' · ' + pi.join(' or ') : '');
  }];
  const lab = new Map(ps.map((p) => [p.key, base(p)]));
  for (const step of steps) {
    const count = new Map<string, number>();
    for (const v of lab.values()) count.set(v, (count.get(v) || 0) + 1);
    for (const p of ps) if ((count.get(lab.get(p.key)!) || 0) > 1) lab.set(p.key, step(p));
  }
  const seen = new Map<string, number>();
  for (const p of ps) {
    const v = lab.get(p.key)!;
    const n = (seen.get(v) || 0) + 1;
    seen.set(v, n);
    if (n > 1) lab.set(p.key, `${v} #${n}`);
  }
  return lab;
}

/** the best %/s of a card's presets (off cooldown), and whether that
 * preset's total is a lower bound */
export function bestOf(D: Slice, ps: PresetRec[], dmg: Map<string, Damage>, sp: Speeds): { best: number | null; lower: boolean } {
  let b: number | null = null;
  let lower = false;
  for (const p of ps) {
    if (p.cool) continue;
    const t = timed(D, p, dmg.get(p.key)!, sp);
    if (t.hi != null && (b == null || t.hi > b)) {
      b = t.hi;
      lower = dmg.get(p.key)!.lower;
    }
  }
  return { best: b, lower };
}

// ---- how a Black Spirit / reached card is entered ---------------------------

export function enteredLines(D: Pick<Slice, 'cards' | 'idName'>, c: CardRec): { text: string; gate: string[] }[] {
  const when = (e: CardRec['entered'][number]) => {
    const ws = e.gate.map((g) => (g.includes(' — ') ? g.split(' — ')[1] : g)).filter(Boolean).map((w) => {
      const m = /^(.*?) full \((assumed[^)]*)\)$/.exec(w);
      return m ? `when the ${m[1]} is full (assumed full)` : `when ${w}`;
    });
    return ws.length ? ' ' + ws.join(', ') : '';
  };
  const words = (i: Inp) => (i && typeof i === 'object' ? inp(i, D.idName).plain : dropUp(nice((i as string) || '')));
  const own = (e: CardRec['entered'][number]) => {
    if (e.input && typeof e.input === 'object') {
      const names = e.input.c || [];
      const mine = names.filter((x) => x === c.as_name || x === c.name);
      return names.length ? (mine.length ? mine : names).map((x) => `${x} skill`).join(' or ') : inp(e.input).plain;
    }
    const xs = [...((e.input as string) || '').matchAll(/skill (.+?) \(its keys or its quickslot\)/g)].map((m) => m[1]);
    const mine = xs.filter((x) => x === c.as_name || x === c.name);
    return (mine.length ? mine : xs).map((x) => `${x} skill`).join(' or ') || dropUp(nice((e.input as string) || ''));
  };
  return (c.entered || []).map((e) => {
    let text: string;
    if (e.mech === 'base press') {
      const has = e.input && (typeof e.input === 'object' ? inp(e.input).plain !== 'no input' : e.input !== '(no input)');
      text = `Played by the ${e.base ? cardName(D, e.base) : 'base skill'} press${has ? ' with ' + words(e.input) : ''}${when(e)}`;
    } else if (e.mech === 'own skill') text = `Its own input: ${own(e)}${when(e)}`;
    else text = `${e.mech || 'entered'}: ${words(e.input)}${when(e)}`;
    return { text, gate: e.gate };
  });
}

export function reachLines(D: Pick<Slice, 'skills' | 'idName'>, c: CardRec): { src: string; ins: string[]; f: unknown }[] {
  const by = new Map<string, { src: string; f: unknown; ins: Set<string> }>();
  for (const [src, , , input, f] of c.reached || []) {
    const k = src + '|' + f;
    if (!by.has(k)) by.set(k, { src, f, ins: new Set() });
    by.get(k)!.ins.add(inp(input, D.idName).plain);
  }
  return [...by.values()].map((x) => ({ src: skillName(D, x.src), ins: [...x.ins], f: x.f }));
}

export const isSummon = (c: CardRec | undefined) => Boolean(c && (c.kind === 'summon' || c.gap));
