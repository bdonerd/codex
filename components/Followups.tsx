'use client';
import Link from 'next/link';
import {
  type Damage, type Slice, type TimedFu, entrySkills, fmt, fmtRate, fuBlocks, fuParts, inp,
} from '../lib/present';
import { FuNameView, InputView, ReqAs, UltChip, cardHref } from './bits';

function FuLine({ D, f }: { D: Slice; f: TimedFu }) {
  const x = inp(f.i, D.idName);
  return (
    <div className={'fu' + (f.tc ? ' tc' : '')}>
      <b><FuNameView D={D} parts={fuParts(D, f)} /></b>
      <UltChip name={f.ul} />
      {f.cool && <> <span className="chip c-cool">on cooldown</span></>}
      {f.un && <> <span className="chip g-need">unresolved</span></>}
      {f.tc && <> <span className="chip c-tc">true cancel</span></>}
      <div className="in"><InputView x={x} /><ReqAs D={D} x={x} ul={f.ul} /></div>
    </div>
  );
}

/** Follow-ups (or a no-damage cast's exits) grouped by the moment they
 * open; each group shows its time and %/s and expands into its skills. */
export function FollowupBlocks({ D, fus, q, dm, fromStart }: {
  D: Slice; fus: TimedFu[]; q: string; dm: Damage | null; fromStart: boolean;
}) {
  if (!fus.length) return <div className="none">{fromStart ? 'No exit into a skill while the cast plays.' : 'No follow-up.'}</div>;
  const { blocks, maxRate, shown } = fuBlocks(D, fus, q);
  if (!shown) return <div className="none">No follow-up matches the filter.</div>;
  const filtering = Boolean(q.trim());
  return (
    <>
      {blocks.map((b) => {
        const n = b.skills;
        return (
          <details key={b.key} className={'fg' + (b.anyTc ? ' tc' : '')} open={filtering || undefined}>
            <summary>
              <span className="tm">
                {b.num != null && <span className="gnum">{b.num}</span>}
                <span className="t">{b.t == null ? '–' : fmt(b.t, 1) + ' ms'}</span>
                {!fromStart && (dm && dm.pct == null
                  ? <> · <span className="mut">%/s needs value</span></>
                  : b.rate != null ? <> · <b>{fmtRate(b.rate, dm)}</b> %/s</> : null)}
                <span className="mut small">
                  {n} skill{n === 1 ? '' : 's'}{b.cool.length ? ` + ${b.cool.length} on cooldown` : ''}
                </span>
                {b.anyTc && <> <span className="chip c-tc">true cancel</span></>}
              </span>
              {!fromStart && b.rate != null && (
                <span className="barwrap" aria-hidden="true"><i style={{ width: `${((b.rate / maxRate) * 100).toFixed(1)}%` }} /></span>
              )}
            </summary>
            {b.live.map((f, i) => <FuLine key={i} D={D} f={f} />)}
            {b.cool.length > 0 && <><div className="sub" style={{ padding: '0 10px' }}>On cooldown</div>{b.cool.map((f, i) => <FuLine key={i} D={D} f={f} />)}</>}
            {b.un.length > 0 && <><div className="sub" style={{ padding: '0 10px' }}>Unresolved skill press</div>{b.un.map((f, i) => <FuLine key={i} D={D} f={f} />)}</>}
          </details>
        );
      })}
    </>
  );
}

/** the skills that lead into a preset or card */
export function EntrySkillsView({ D, lists }: { D: Slice; lists: (string | null | undefined)[] }) {
  const es = entrySkills(D, lists);
  return (
    <details className="fg acc">
      <summary><b>Entry Skills</b><span className="mut small">{es.head}</span></summary>
      <div style={{ padding: '0 10px 8px' }}>
        {es.cmd && <div className="small">Skill command</div>}
        {es.hot && <div className="small">Hotbar</div>}
        {es.items.map((x) => {
          const href = x.card ? cardHref(D, x.card) : null;
          const acts = x.acts.map((a) => (
            <li key={a.label}>
              {a.label}
              {a.ult === 'only' && <> <span className="chip c-ult">Ultimate</span></>}
              {a.ult === 'also' && <> <span className="chip c-ult">also via Ultimate</span></>}
            </li>
          ));
          return (
            <details key={x.name} className="fg es">
              <summary>
                <b>{href ? <Link href={href} prefetch={false}>{x.name}</Link> : x.name}</b>
                {x.allUlt && <> <span className="chip c-ult">Ultimate</span></>}
              </summary>
              <ul>{x.all ? <><li>All actions</li>{x.anyUlt && !x.allUlt && acts}</> : acts}</ul>
            </details>
          );
        })}
      </div>
    </details>
  );
}
