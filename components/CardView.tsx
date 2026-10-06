'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { type Speeds, segMs } from '../lib/clock';
import type { CardData } from '../lib/data';
import {
  type Damage, type Slice, bestOf, byRate, damage, enteredLines, fmt, ge, inp, isSummon,
  labelPresets, mainInput, mergeFus, presetInput, reachLines, reqChips, timeFus, timed,
} from '../lib/present';
import type { CardRec, PresetRec } from '../lib/view';
import { Chips, InputView, KeyText, UltChip, specPath } from './bits';
import DetailsTimeline from './DetailsTimeline';
import { EntrySkillsView, FollowupBlocks } from './Followups';
import SpeedControls from './SpeedControls';
import { useSpeeds } from './useSpeeds';

export function KindChip({ kind }: { kind: string }) {
  if (kind === 'black_spirit') return <> <span className="chip c-bs">Black Spirit</span></>;
  if (kind === 'no_damage') return <> <span className="chip">no damage</span></>;
  if (kind === 'summon') return <> <span className="chip g-need">summon</span></>;
  return null;
}

/** "best N %/s"; a best whose preset has a damage gap says so */
export function Best({ best, lower }: { best: number | null; lower: boolean }) {
  return (
    <span className="best">
      {best == null ? <span className="mut">%/s needs value</span> : <>best <b>{lower ? `≥ ${fmt(best)}` : fmt(best)}</b> %/s</>}
    </span>
  );
}

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
    <div className={'preset' + (open ? ' open' : '')}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="pg">
          <span className="grp">
            {label}
            <UltChip name={p.ult} />
            <Chips list={reqChips(p.reqs, D.class)} />
            {p.hb && <> <span className="chip c-req">Hotbar</span></>}
            {p.ws && <> <span className="chip c-ult" title={p.ws}>Weapon switch</span></>}
          </span>
          {ins.length > 0 && <span className="small mut">{ins.join(' or ')}</span>}
        </span>
        <span className="stat" title={gapTitle}><b>{pctTxt}</b><span>total damage</span></span>
        <span className="stat"><b>{rng}</b><span>%/s</span></span>
      </button>
      {open && <PresetDetail D={D} p={p} dm={dm} sp={sp} showHow={showHow} />}
    </div>
  );
}

function PresetDetail({ D, p, dm, sp, showHow }: { D: Slice; p: PresetRec; dm: Damage; sp: Speeds; showHow: boolean }) {
  const [q, setQ] = useState('');
  const [dt, setDt] = useState(false);
  const t = timed(D, p, dm, sp);
  return (
    <div className="detail">
      {showHow && p.how && <><div className="sub">How it is played</div><div className="how">{p.how}</div></>}
      <EntrySkillsView D={D} lists={[p.access]} />
      <div className="fu-ctl">
        <input type="search" placeholder="Filter follow-ups" aria-label="Filter follow-ups" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div><FollowupBlocks D={D} fus={t.fus} q={q} dm={dm} fromStart={false} /></div>
      <details className="fg dt" onToggle={(e) => setDt((e.target as HTMLDetailsElement).open)}>
        <summary><b>Details</b></summary>
        <div className="dtb">{dt && <DetailsTimeline D={D} p={p} sp={sp} />}</div>
      </details>
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
      <div className="presets">{live.map(row)}</div>
      {cool.length > 0 && (
        <details className="fg" style={{ marginTop: 8 }}>
          <summary><span className="chip c-cool">on cooldown</span><span className="small mut">{cool.length}</span></summary>
          <div className="presets" style={{ padding: 6 }}>{cool.map(row)}</div>
        </details>
      )}
    </>
  );
}

function NoDamage({ D, id, c, sp }: { D: Slice; id: string; c: CardRec; sp: Speeds }) {
  const cool = new Set(D.cool);
  return (
    <>
      {isSummon(c) && <div className="gap">{c.gap || 'deals damage through a summon: needs value'}</div>}
      {(c.timelines || []).map((t, i) => {
        const total = segMs(D.clock, t.segs, sp);
        const ex = mergeFus(D, timeFus(D, cool, t.ex, null, sp));
        const free = t.free ? timeFus(D, cool, [t.free], null, sp)[0] : null;
        return (
          <div className="tl" key={`${id}#${i}`}>
            <div className="row">
              <span>{t.in ? <InputView x={inp(t.in, D.idName)} /> : 'no input'}</span>
              <span className="stat" style={{ textAlign: 'left' }} title={`whole cast ${fmt(total, 1)} ms`}>
                <b>{free ? fmt(free.t, 1) + ' ms' : '–'}</b><span>{free ? 'free to act' : 'no exit into a skill'}</span>
              </span>
            </div>
            {ex.length > 0 && (
              <details className="fg">
                <summary><b>Exits</b><span className="mut small">timed from the cast start</span></summary>
                <div style={{ padding: '0 6px 6px' }}><FollowupBlocks D={D} fus={ex} q="" dm={null} fromStart /></div>
              </details>
            )}
          </div>
        );
      })}
      <EntrySkillsView D={D} lists={[c.access]} />
    </>
  );
}

export function CardHeadExtra({ D, c }: { D: Slice; c: CardRec }) {
  const reach = reachLines(D, c);
  return (
    <>
      {reach.length > 0 && (
        <div className="reach">
          Not pressable in this spec; reached through{' '}
          {reach.map((x, i) => (
            <span key={i}>{i > 0 && ', '}<b>{x.src}</b> <span className="mut">({x.ins.join(' or ')}, from f{String(x.f)})</span></span>
          ))}
        </div>
      )}
      {enteredLines(D, c).map((e, i) => (
        <div className="reach" key={i}>
          {e.text}
          {e.gate.length > 0 && (
            <>
              {' '}
              <details className="raw">
                <summary className="mut small">assumed</summary>
                <span className="small mut">{e.gate.join('; ')}</span>
              </details>
            </>
          )}
        </div>
      ))}
    </>
  );
}

export default function CardView({ data }: { data: CardData }) {
  const D = data.slice;
  const c = D.cards[data.id];
  const { raw, set, settle, speeds, reset } = useSpeeds();
  const dmg = useMemo(() => new Map(data.presets.map((p) => [p.key, damage(p, D.lines)])), [data, D.lines]);
  const main = mainInput(D, c);
  const isDamage = data.presets.length > 0;
  const best = isDamage ? bestOf(D, data.presets, dmg, speeds) : null;
  return (
    <>
      <p className="crumb"><Link href={specPath(D)}>{data.label}</Link></p>
      <SpeedControls raw={raw} set={set} settle={settle} reset={reset} />
      <article className="skill">
        <div className="hd">
          <h1 className="nm">{c.as_name || c.name || `Skill ${data.id}`}</h1>
          {main && <span className="keys"><KeyText text={main} /></span>}
          <KindChip kind={c.kind} />
          {best && <Best best={best.best} lower={best.lower} />}
        </div>
        <CardHeadExtra D={D} c={c} />
        {isDamage
          ? <Presets D={D} ps={data.presets} dmg={dmg} sp={speeds} main={main} />
          : <NoDamage D={D} id={data.id} c={c} sp={speeds} />}
      </article>
    </>
  );
}
