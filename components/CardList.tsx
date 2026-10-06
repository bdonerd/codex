'use client';
import Link from 'next/link';
import { useState } from 'react';
import { type Speeds, ratePerSec, segMs } from '../lib/clock';
import type { ListCard, ListData } from '../lib/data';
import { byRate, fmt } from '../lib/present';
import { KeyText } from './bits';
import { Best, KindChip } from './CardView';
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

export default function CardList({ data: L }: { data: ListData }) {
  const { raw, set, settle, speeds, reset } = useSpeeds();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('name');
  const ql = q.trim().toLowerCase();
  const shown = L.cards.filter((c) => !ql || c.search.includes(ql));
  const best = new Map(shown.map((c) => [c.id, bestOf(L, c, speeds)]));
  const byName = (a: ListCard, b: ListCard) => a.name.localeCompare(b.name);
  const cmp = sort === 'rate'
    ? (a: ListCard, b: ListCard) => byRate({ rate: best.get(a.id)!.best }, { rate: best.get(b.id)!.best }) || byName(a, b)
    : byName;
  const href = (c: ListCard) => `/${L.cls}/${L.spec ?? 'all'}/${c.slug}/`;

  const row = (c: ListCard) => {
    const b = best.get(c.id)!;
    const free = c.section === 'nd' ? freeOf(L, c, speeds) : null;
    return (
      <article className="skill row" key={c.id}>
        <div className="hd">
          <span className="nm"><Link href={href(c)}>{c.name}</Link></span>
          {c.keys && <span className="keys"><KeyText text={c.keys} /></span>}
          <KindChip kind={c.kind} />
          {(c.section === 'skill' || c.section === 'bs' || c.section === 'summon') && <Best best={b.best} lower={b.lower} />}
          {c.section === 'nd' && free != null && <span className="best">free to act <b>{fmt(free, 1)}</b> ms</span>}
        </div>
      </article>
    );
  };
  const sections: [string, ListCard[]][] = [
    ['Skills', shown.filter((c) => c.section === 'skill').sort(cmp)],
    ['Black Spirit', shown.filter((c) => c.section === 'bs').sort(cmp)],
    ['Damage through a summon', shown.filter((c) => c.section === 'summon').sort(byName)],
    ['No damage of its own', shown.filter((c) => c.section === 'nd').sort(byName)],
  ];
  const rest = L.rest.filter((r) => !ql || r.name.toLowerCase().includes(ql));
  const n = L.counts;
  return (
    <>
      <header className="top">
        <div>
          <h1>{L.label}</h1>
          <div className="meta">
            <span>game build {L.build}</span>
            <span>export schema {L.schema}</span>
            <span>{n.damage} damage cards</span>
            <span>{n.noDamage} no-damage cards</span>
            <span>{n.summon} summon card{n.summon === 1 ? '' : 's'}</span>
            <span>{n.presets} presets</span>
            <span>{n.followups.toLocaleString('en-US')} follow-ups</span>
          </div>
        </div>
      </header>
      <SpeedControls raw={raw} set={set} settle={settle} reset={reset} />
      <div className="controls">
        <input type="search" placeholder="Find a skill" aria-label="Find a skill" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="small mut">
          Sort{' '}
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">by name</option>
            <option value="rate">by best %/s</option>
          </select>
        </label>
      </div>
      <main>
        {sections.map(([label, cs]) => cs.length > 0 && (
          <section key={label}>
            <h2 className="sect">{label} · {cs.length}</h2>
            {cs.map(row)}
          </section>
        ))}
        {rest.length > 0 && (
          <details className="fg" style={{ marginTop: 18 }}>
            <summary><b>Skills with no card in this spec</b><span className="mut small">{rest.length}</span></summary>
            {rest.map((r, i) => (
              <div className="fu" key={i}>
                <b>{r.name}</b>
                {r.reached && <> <span className="chip c-reach">reached through another skill</span></>}
                <div className="in">{r.why}</div>
              </div>
            ))}
          </details>
        )}
        {!shown.length && !rest.length && <p className="mut">No skill matches.</p>}
      </main>
    </>
  );
}
