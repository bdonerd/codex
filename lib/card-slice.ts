// A spec page's sections share names (SpecShared, in the page) and load
// each card's own data (CardPayload) when opened. Safe for the browser.
import type { Slice } from './present';
import type { CardRec, PresetRec, SkillRec } from './view';

export interface SpecShared {
  class: string;
  spec: string | null;
  /** every skill and card by name only */
  skills: Record<string, SkillRec>;
  cards: Record<string, CardRec>;
  idName: Record<string, string>;
  cool: string[];
  slugs: Record<string, string>;
}

export interface CardPayload {
  id: string;
  /** its presets (sorted by time at 100%), or none for a no-damage card */
  presets: PresetRec[];
  clock: Slice['clock'];
  lines: Slice['lines'];
  segs: Slice['segs'];
  access: Slice['access'];
  xw: Slice['xw'];
  /** its own skills in full */
  skills: Record<string, SkillRec>;
  card: CardRec;
}

/** the card's slice: the shared names with its own data over them */
export function sliceOf(sh: SpecShared, p: CardPayload): Slice {
  return {
    class: sh.class, spec: sh.spec, skills: { ...sh.skills, ...p.skills }, clock: p.clock, lines: p.lines,
    presets: p.presets, segs: p.segs, access: p.access, xw: p.xw, cards: { ...sh.cards, [p.id]: p.card },
    idName: sh.idName, cool: sh.cool, slugs: sh.slugs,
  };
}

/** where a card's data file is served */
export const cardDataPath = (cls: string, specSegment: string, id: string) => `/cards/${cls}/${specSegment}/${id}.json`;
