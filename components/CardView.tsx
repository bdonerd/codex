'use client';
import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { type Speeds, segMs } from '../lib/clock';
import {
  type Damage, type Slice, byRate, damage, enteredLines, fmt, ge, inp, isSummon,
  labelPresets, mainInput, mergeFus, presetInput, reachLines, reqChips, routeChips, timeFus, timed,
} from '../lib/present';
import type { CardRec, PresetRec } from '../lib/view';
import { Assumed, Chip, Chips, Fold, InputView, Sub } from './bits';
import DetailsTimeline from './DetailsTimeline';
import { EntrySkillsView, FollowupBlocks } from './Followups';

export function KindChip({ kind }: { kind: string }) {
  if (kind === 'black_spirit') return <Chip tone="meas">Black Spirit</Chip>;
  if (kind === 'no_damage') return <Chip>no damage</Chip>;
  if (kind === 'summon') return <Chip tone="warn">summon</Chip>;
  return null;
}

/** "best N %/s"; a best whose preset has a damage gap says so */
export function Best({ best, lower }: { best: number | null; lower: boolean }) {
  return (
    <span className="text-[13px] tabular-nums">
      {best == null ? <span className="text-muted-foreground">%/s needs value</span> : <>best <b>{lower ? `≥ ${fmt(best)}` : fmt(best)}</b> %/s</>}
    </span>
  );
}

const Stat = ({ v, label, title }: { v: string; label: string; title?: string }) => (
  <span className="text-[13px] leading-tight max-[560px]:text-left min-[561px]:text-right" title={title}>
    <b className="block text-[15px] tabular-nums">{v}</b>
    <span className="text-[11px] text-muted-foreground">{label}</span>
  </span>
);

function PresetRow({ D, p, dm, sp, main, label, showHow }: {
  D: Slice; p: PresetRec; dm: Damage; sp: Speeds; main: string | null; label: string; showHow: boolean;
}) {
  const [open, setOpen] = useState(false);
  const t = timed(D, p, dm, sp);
  const none = dm.pct == null;
  const pctTxt = none ? 'needs value' : ge(dm, `${fmt(dm.pct)}%`);
  const gapTitle = none ? 'no hit has a value yet' : dm.missing ? `${dm.missing} tick${dm.missing > 1 ? 's' : ''} without a value: a lower bound` : undefined;
  const rng = none ? 'needs value' : t.lo == null || t.hi == null ? '–'
    : Math.abs(t.hi - t.lo) < 0.5 ? ge(dm, fmt(t.hi)) : dm.lower ? `≥ ${fmt(t.lo)}–${fmt(t.hi)}` : `${fmt(t.lo)}–${fmt(t.hi)}`;
  const ins = presetInput(D, p).filter((x) => x !== main && x !== 'no input');
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="overflow-hidden rounded-[10px] border">
      <CollapsibleTrigger className="group grid w-full cursor-pointer grid-cols-2 items-center gap-x-4 gap-y-1 px-2.5 py-2 text-left hover:bg-muted data-[state=open]:bg-muted min-[561px]:grid-cols-[minmax(0,1fr)_auto_auto]">
        <span className="col-span-2 min-w-0 min-[561px]:col-span-1">
          <span className="flex items-start gap-1.5">
            <ChevronRight aria-hidden className="mt-[3px] size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
            <span className="min-w-0">
              <span className="block font-semibold [overflow-wrap:anywhere]">
                {label}
                <Chips list={routeChips(p.ro, p.ult, p.ws)} />
                <Chips list={reqChips(p.reqs, D.class)} />
                {p.hb && <> <Chip tone="warn">Hotbar</Chip></>}
              </span>
              {ins.length > 0 && <span className="block text-[13px] text-muted-foreground">{ins.join(' or ')}</span>}
            </span>
          </span>
        </span>
        <Stat v={pctTxt} label="total damage" title={gapTitle} />
        <Stat v={rng} label="%/s" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <PresetDetail D={D} p={p} dm={dm} sp={sp} showHow={showHow} />
      </CollapsibleContent>
    </Collapsible>
  );
}

function PresetDetail({ D, p, dm, sp, showHow }: { D: Slice; p: PresetRec; dm: Damage; sp: Speeds; showHow: boolean }) {
  const [q, setQ] = useState('');
  const [dt, setDt] = useState(false);
  const t = timed(D, p, dm, sp);
  return (
    <div className="flex flex-col gap-2 border-t bg-background p-2.5">
      {showHow && p.how && <div><Sub className="mt-0">How it is played</Sub><div className="text-[13px] [overflow-wrap:anywhere]">{p.how}</div></div>}
      <EntrySkillsView D={D} lists={[p.access]} />
      <Input
        type="search" placeholder="Filter follow-ups" aria-label="Filter follow-ups" value={q}
        onChange={(e) => setQ(e.target.value)} className="h-8 bg-card"
      />
      <FollowupBlocks D={D} fus={t.fus} q={q} dm={dm} fromStart={false} />
      <Fold summary={<b>Details</b>} onOpenChange={setDt}>
        <div className="px-2 pb-2">{dt && <DetailsTimeline D={D} p={p} sp={sp} />}</div>
      </Fold>
    </div>
  );
}

function Presets({ D, ps, dmg, sp, main }: { D: Slice; ps: PresetRec[]; dmg: Map<string, Damage>; sp: Speeds; main: string | null }) {
  const top = new Map(ps.map((p) => [p.key, timed(D, p, dmg.get(p.key)!, sp).hi]));
  const byTop = (a: PresetRec, b: PresetRec) => byRate({ rate: top.get(a.key) ?? null }, { rate: top.get(b.key) ?? null });
  const live = ps.filter((p) => !p.cool).sort(byTop);
  const cool = ps.filter((p) => p.cool).sort(byTop);
  const labels = new Map([...labelPresets(D, live), ...labelPresets(D, cool)]);
  // "How it is played" only on a card with 2+ timed presets
  const showHow = live.filter((p) => p.timed === true).length >= 2;
  const row = (p: PresetRec) => (
    <PresetRow key={p.key} D={D} p={p} dm={dmg.get(p.key)!} sp={sp} main={main} label={labels.get(p.key) as string} showHow={showHow} />
  );
  return (
    <>
      <div className="mt-2 flex flex-col gap-1.5">{live.map(row)}</div>
      {cool.length > 0 && (
        <Fold className="mt-2" summary={<><Chip tone="bad">on cooldown</Chip> <span className="text-[13px] text-muted-foreground">{cool.length}</span></>}>
          <div className="flex flex-col gap-1.5 p-1.5">{cool.map(row)}</div>
        </Fold>
      )}
    </>
  );
}

function NoDamage({ D, id, c, sp }: { D: Slice; id: string; c: CardRec; sp: Speeds }) {
  const cool = new Set(D.cool);
  return (
    <div className="mt-2 flex flex-col gap-2">
      {isSummon(c) && <div className="text-xs text-warn">{c.gap || 'deals damage through a summon: needs value'}</div>}
      {(c.timelines || []).map((t, i) => {
        const total = segMs(D.clock, t.segs, sp);
        const ex = mergeFus(D, timeFus(D, cool, t.ex, null, sp));
        const free = t.free ? timeFus(D, cool, [t.free], null, sp)[0] : null;
        return (
          <div className="rounded-[10px] border px-2.5 py-2" key={`${id}#${i}`}>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span>{t.in ? <InputView x={inp(t.in, D.idName)} /> : 'no input'}</span>
              <span className="text-[13px] leading-tight" title={`whole cast ${fmt(total, 1)} ms`}>
                <b className="block text-[15px] tabular-nums">{free ? fmt(free.t, 1) + ' ms' : '–'}</b>
                <span className="text-[11px] text-muted-foreground">{free ? 'free to act' : 'no exit into a skill'}</span>
              </span>
            </div>
            {ex.length > 0 && (
              <Fold className="mt-2" summary={<><b>Exits</b> <span className="text-[13px] text-muted-foreground">timed from the cast start</span></>}>
                <div className="px-1.5 pb-1.5"><FollowupBlocks D={D} fus={ex} q="" dm={null} fromStart /></div>
              </Fold>
            )}
          </div>
        );
      })}
      <EntrySkillsView D={D} lists={[c.access]} />
    </div>
  );
}

export function CardHeadExtra({ D, c }: { D: Slice; c: CardRec }) {
  const reach = reachLines(D, c);
  return (
    <>
      {reach.length > 0 && (
        <div className="mt-1 text-[13px]">
          Not pressable in this spec; reached through{' '}
          {reach.map((x, i) => (
            <span key={i}>{i > 0 && ', '}<b>{x.src}</b> <span className="text-muted-foreground">({x.ins.join(' or ')}, from f{String(x.f)})</span></span>
          ))}
        </div>
      )}
      {enteredLines(D, c).map((e, i) => (
        <div className="mt-1 text-[13px]" key={i}>
          {e.text}
          {e.gate.length > 0 && <> <Assumed text={e.gate.join('; ')} /></>}
        </div>
      ))}
    </>
  );
}

/** a card's section body: how it is reached, then its presets (or its
 * casts, for a card with no damage of its own) */
export function CardBody({ D, id, presets, sp }: { D: Slice; id: string; presets: PresetRec[]; sp: Speeds }) {
  const c = D.cards[id];
  const dmg = useMemo(() => new Map(presets.map((p) => [p.key, damage(p, D.lines)])), [presets, D.lines]);
  const main = mainInput(D, c);
  return (
    <>
      <CardHeadExtra D={D} c={c} />
      {presets.length > 0
        ? <Presets D={D} ps={presets} dmg={dmg} sp={sp} main={main} />
        : <NoDamage D={D} id={id} c={c} sp={sp} />}
    </>
  );
}
