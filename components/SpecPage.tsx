'use client';
import { ArrowUp, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { type CardPayload, type SpecShared, cardDataPath, sliceOf } from '../lib/card-slice';
import { type Speeds, ratePerSec, segMs } from '../lib/clock';
import type { ListCard, ListData } from '../lib/data';
import { fmt } from '../lib/present';
import { type RankRow, rankCards } from '../lib/rank';
import { Chip, Fold, KeyText } from './bits';
import { Best, CardBody, KindChip } from './CardView';
import SpeedControls from './SpeedControls';
import { useSpeeds } from './useSpeeds';

/** a card's best %/s off cooldown, and whether that total has a gap */
function bestOf(L: ListData, c: ListCard, sp: Speeds): { best: number | null; lower: boolean } {
  let best: number | null = null;
  let lower = false;
  for (const p of c.presets) {
    for (const sg of p.sgs) {
      const r = ratePerSec(p.pct, segMs(L.clock, L.segs[sg], sp));
      if (r != null && (best == null || r > best)) {
        best = r;
        lower = p.lower;
      }
    }
  }
  return { best, lower };
}

/** the earliest free-to-act of a no-damage card's casts */
function freeOf(L: ListData, c: ListCard, sp: Speeds): number | null {
  let out: number | null = null;
  for (const sg of c.free) {
    const t = segMs(L.clock, L.segs[sg], sp);
    if (t != null && (out == null || t < out)) out = t;
  }
  return out;
}

// ---- each card's data, fetched once on open (or on hover / focus) -------------

const loaded = new Map<string, Promise<CardPayload>>();
function loadCard(path: string): Promise<CardPayload> {
  let p = loaded.get(path);
  if (!p) {
    p = fetch(path).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<CardPayload>;
    });
    p.catch(() => loaded.delete(path));
    loaded.set(path, p);
  }
  return p;
}

function useCard(path: string, on: boolean) {
  const [st, setSt] = useState<{ data?: CardPayload; failed?: boolean }>({});
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (!on || st.data) return;
    let live = true;
    loadCard(path).then((data) => live && setSt({ data }), () => live && setSt({ failed: true }));
    return () => {
      live = false;
    };
  }, [path, on, tries, st.data]);
  return { ...st, retry: () => { setSt({}); setTries(tries + 1); } };
}

// ---- the board: every ranked card by its best %/s ------------------------------

const TIER_BG = ['bg-tier-1', 'bg-tier-2', 'bg-tier-3', 'bg-tier-4', 'bg-tier-5'];
const pct = (x: number) => `${Math.round(x * 100)}%`;

function Board({ rows, cards, prefetch }: {
  rows: RankRow[]; cards: Map<string, ListCard>; prefetch: (id: string) => void;
}) {
  return (
    <section id="board" tabIndex={-1} aria-label="Skills by best %/s" className="scroll-mt-3 rounded-xl border bg-card px-2 pt-1 pb-1.5 outline-none">
      <div aria-hidden className="pr-1.5 text-right text-[11px] text-muted-foreground">%/s</div>
      <ol className="lg:columns-2 lg:gap-x-6">
        {rows.map((r) => {
          const c = cards.get(r.id)!;
          const val = r.best == null ? null : r.lower ? `≥ ${fmt(r.best)}` : fmt(r.best);
          const title = `${c.name} · ${val == null ? '%/s needs value' : `${val} %/s`}${r.share != null ? ` · ${pct(r.share)} of the top` : ''}`;
          return (
            <li key={r.id} className="break-inside-avoid">
              <a
                href={`#${c.slug}`}
                title={title}
                onPointerEnter={() => prefetch(r.id)}
                onFocus={() => prefetch(r.id)}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-md px-1.5 py-[3px] text-[13px] leading-[18px] text-foreground no-underline hover:bg-muted hover:no-underline sm:grid-cols-[1.5rem_minmax(0,1fr)_minmax(3rem,8rem)_5.5rem] sm:py-[5px]"
              >
                <span className="text-right text-xs text-muted-foreground tabular-nums">{r.rank ?? '–'}</span>
                <span className="truncate font-medium">{c.name}</span>
                <span className="text-right tabular-nums sm:order-last">
                  {val == null ? <span className="text-muted-foreground">needs value</span> : <b>{val}</b>}
                </span>
                <span aria-hidden className="col-span-2 col-start-2 mt-0.5 block h-[3px] rounded-full bg-muted sm:col-span-1 sm:col-start-3 sm:mt-0 sm:h-1.5">
                  {r.share != null && r.tier != null && (
                    <i className={cn('block h-full rounded-full', TIER_BG[r.tier - 1])} style={{ width: `${(r.share * 100).toFixed(1)}%` }} />
                  )}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** a small floating button back to the board once it is out of view; on a
 * narrow screen only while scrolling up (it shows whenever it has focus) */
function BackToBoard() {
  const [away, setAway] = useState(false);
  const [up, setUp] = useState(false);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const board = document.getElementById('board');
    if (!board) return;
    const io = new IntersectionObserver(([e]) => setAway(!e.isIntersecting && e.boundingClientRect.bottom < 0));
    io.observe(board);
    const mq = matchMedia('(min-width: 1100px)');
    const onMq = () => setWide(mq.matches);
    onMq();
    mq.addEventListener('change', onMq);
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) > 4) setUp(y < last);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      io.disconnect();
      mq.removeEventListener('change', onMq);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  if (!away) return null;
  const shown = wide || up;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Back to the skill board"
      title="Back to the skill board"
      onClick={() => {
        const b = document.getElementById('board');
        b?.scrollIntoView({ block: 'start' });
        b?.focus({ preventScroll: true });
      }}
      className={cn(
        'fixed bottom-3 z-40 rounded-full bg-card shadow-md transition-[translate,opacity] focus-visible:translate-y-0 focus-visible:opacity-100',
        'right-3 min-[1100px]:right-[max(0.75rem,calc((100vw-980px)/2-3.5rem))]',
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-16 opacity-0',
      )}
    >
      <ArrowUp aria-hidden />
    </Button>
  );
}

// ---- a card's section --------------------------------------------------------

function Section({ L, shared, c, open, setOpen, sp, best, prefetch }: {
  L: ListData; shared: SpecShared; c: ListCard; open: boolean; setOpen: (o: boolean) => void; sp: Speeds;
  best: { best: number | null; lower: boolean }; prefetch: (id: string) => void;
}) {
  const card = useCard(cardDataPath(L.cls, L.spec ?? 'all', c.id), open);
  const D = useMemo(() => (card.data ? sliceOf(shared, card.data) : null), [shared, card.data]);
  const free = c.section === 'nd' ? freeOf(L, c, sp) : null;
  return (
    <section id={c.slug} className="scroll-mt-3 rounded-xl border bg-card">
      <Collapsible open={open} onOpenChange={setOpen}>
        <h3 className="m-0 text-base">
          <CollapsibleTrigger
            onPointerEnter={() => prefetch(c.id)}
            onFocus={() => prefetch(c.id)}
            className="group flex w-full cursor-pointer flex-wrap items-baseline gap-x-2.5 gap-y-0.5 rounded-xl px-3 py-2 text-left font-normal hover:bg-muted/60"
          >
            <ChevronRight aria-hidden className="size-4 shrink-0 self-center text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
            <span className="font-semibold">{c.name}</span>
            {c.keys && <span className="text-[13px] text-muted-foreground"><KeyText text={c.keys} /></span>}
            <KindChip kind={c.kind} />
            <span className="ml-auto">
              {c.section !== 'nd' && <Best best={best.best} lower={best.lower} />}
              {c.section === 'nd' && free != null && <span className="text-[13px] tabular-nums">free to act <b>{fmt(free, 1)}</b> ms</span>}
            </span>
          </CollapsibleTrigger>
        </h3>
        <CollapsibleContent>
          <div className="border-t px-3 pt-0.5 pb-2.5">
            {D && card.data
              ? <CardBody D={D} id={c.id} presets={card.data.presets} sp={sp} />
              : card.failed
                ? <div className="mt-2 text-[13px]">Could not load this skill. <Button type="button" variant="link" className="h-auto p-0" onClick={card.retry}>Try again</Button></div>
                : <div className="mt-2 flex flex-col gap-1.5" aria-busy="true" aria-label="Loading">{[0, 1].map((i) => <div key={i} className="h-12 animate-pulse rounded-[10px] bg-muted" />)}</div>}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

// ---- the page ------------------------------------------------------------------

export default function SpecPage({ list: L, shared }: { list: ListData; shared: SpecShared }) {
  const { raw, set, settle, speeds, reset } = useSpeeds(L.speeds);
  const [open, setOpenIds] = useState<Set<string>>(() => new Set());
  const cards = useMemo(() => new Map(L.cards.map((c) => [c.id, c])), [L]);
  const bySlug = useMemo(() => new Map(L.cards.map((c) => [c.slug, c.id])), [L]);
  const prefetch = useCallback((id: string) => {
    loadCard(cardDataPath(L.cls, L.spec ?? 'all', id)).catch(() => {});
  }, [L]);
  const setOpen = (id: string, o: boolean) => setOpenIds((s) => {
    if (s.has(id) === o) return s;
    const n = new Set(s);
    if (o) n.add(id);
    else n.delete(id);
    return n;
  });

  // a #<card> address opens that card's section and scrolls to it; links to
  // a section push a history entry, and Back returns to where the page was
  useEffect(() => {
    const slugOf = () => {
      try {
        return decodeURIComponent(location.hash.slice(1));
      } catch {
        return '';
      }
    };
    const reveal = (slug: string, scroll: boolean) => {
      const id = bySlug.get(slug);
      if (!id) return;
      setOpen(id, true);
      if (scroll) requestAnimationFrame(() => document.getElementById(slug)?.scrollIntoView({ block: 'start' }));
    };
    reveal(slugOf(), true);
    const onPop = (e: PopStateEvent) => {
      const y = e.state && typeof e.state.__y === 'number' ? (e.state.__y as number) : null;
      reveal(slugOf(), y == null);
      if (y != null) requestAnimationFrame(() => window.scrollTo(0, y));
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
      const slug = a ? decodeURIComponent((a.getAttribute('href') as string).slice(1)) : '';
      if (!bySlug.has(slug)) return;
      e.preventDefault();
      const st = (history.state || {}) as Record<string, unknown>;
      history.replaceState({ ...st, __y: window.scrollY }, '');
      history.pushState({ ...st, __y: undefined }, '', `#${slug}`);
      reveal(slug, true);
    };
    window.addEventListener('popstate', onPop);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('click', onClick);
    };
  }, [bySlug]);

  const best = new Map(L.cards.map((c) => [c.id, bestOf(L, c, speeds)]));
  const rows = rankCards(
    L.cards.filter((c) => c.section === 'skill' || c.section === 'bs')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ id: c.id, ...best.get(c.id)! })),
  );
  const byName = (a: ListCard, b: ListCard) => a.name.localeCompare(b.name);
  const groups: [string, ListCard[]][] = [
    ['Skills', L.cards.filter((c) => c.section === 'skill').sort(byName)],
    ['Black Spirit', L.cards.filter((c) => c.section === 'bs').sort(byName)],
    ['Damage through a summon', L.cards.filter((c) => c.section === 'summon').sort(byName)],
    ['No damage of its own', L.cards.filter((c) => c.section === 'nd').sort(byName)],
  ];
  const n = L.counts;
  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{L.label}</h1>
        <div className="mt-0.5 flex flex-wrap gap-x-3.5 gap-y-0.5 text-[13px] text-muted-foreground">
          <span>game build {L.build}</span>
          <span>export schema {L.schema}</span>
          <span>{n.damage} damage cards</span>
          <span>{n.noDamage} no-damage cards</span>
          <span>{n.summon} summon card{n.summon === 1 ? '' : 's'}</span>
          <span>{n.presets} presets</span>
          <span>{n.followups.toLocaleString('en-US')} follow-ups</span>
        </div>
      </header>
      <SpeedControls raw={raw} set={set} settle={settle} reset={reset} defaults={L.speeds} />
      <Board rows={rows} cards={cards} prefetch={prefetch} />
      <main className="pb-14">
        {groups.map(([label, cs]) => cs.length > 0 && (
          <section key={label} aria-label={label}>
            <h2 className="mt-4 mb-1.5 text-[13px] font-medium tracking-wider text-muted-foreground uppercase">{label} · {cs.length}</h2>
            <div className="flex flex-col gap-1.5">
              {cs.map((c) => (
                <Section
                  key={c.id} L={L} shared={shared} c={c} open={open.has(c.id)} setOpen={(o) => setOpen(c.id, o)}
                  sp={speeds} best={best.get(c.id)!} prefetch={prefetch}
                />
              ))}
            </div>
          </section>
        ))}
        {L.rest.length > 0 && (
          <Fold className="mt-4" summary={<><b>Skills with no card in this spec</b> <span className="text-[13px] text-muted-foreground">{L.rest.length}</span></>}>
            {L.rest.map((r, i) => (
              <div className="border-t px-2.5 py-1.5 text-[13px]" key={i}>
                <b>{r.name}</b>
                {r.reached && <> <Chip tone="acc">reached through another skill</Chip></>}
                <div className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{r.why}</div>
              </div>
            ))}
          </Fold>
        )}
      </main>
      <BackToBoard />
    </>
  );
}
