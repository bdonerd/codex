'use client';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import {
  type Damage, type Slice, type TimedFu, entrySkills, fmt, fmtRate, fuBlocks, fuParts, inp, routeChips, routeName,
} from '../lib/present';
import { Chip, Chips, Fold, FuNameView, InputView, LateBadge, ReqAs, Sub, cardHref } from './bits';

function FuLine({ D, f }: { D: Slice; f: TimedFu }) {
  const x = inp(f.i, D.idName);
  return (
    <div className={'border-t px-2.5 py-1.5 text-[13px]' + (f.tc ? ' border-l-4 border-l-bad' : '')}>
      <b className="[overflow-wrap:anywhere]"><FuNameView D={D} parts={fuParts(D, f)} /></b>
      <Chips list={routeChips(f.ro, f.ul)} />
      {f.cool && <> <Chip tone="bad">on cooldown</Chip></>}
      {f.un && <> <Chip tone="warn">unresolved</Chip></>}
      {f.tc && <> <Chip tone="tc">true cancel</Chip></>}
      {f.sw && <LateBadge texts={[f.sw.t]} />}
      <div className="text-xs text-muted-foreground [overflow-wrap:anywhere]"><InputView x={x} /><ReqAs D={D} x={x} ul={routeName(f.ro, f.ul)} /></div>
    </div>
  );
}

const None = ({ children }: { children: React.ReactNode }) => <div className="mt-1.5 text-[13px] text-muted-foreground">{children}</div>;

/** Follow-ups (or a no-damage cast's exits) grouped by the moment they
 * open; each group shows its time and %/s and expands into its skills. */
export function FollowupBlocks({ D, fus, q, dm, fromStart }: {
  D: Slice; fus: TimedFu[]; q: string; dm: Damage | null; fromStart: boolean;
}) {
  if (!fus.length) return <None>{fromStart ? 'No exit into a skill while the cast plays.' : 'No follow-up.'}</None>;
  const { blocks, maxRate, shown } = fuBlocks(D, fus, q);
  if (!shown) return <None>No follow-up matches the filter.</None>;
  const filtering = Boolean(q.trim());
  return (
    <div className="flex flex-col gap-1.5">
      {blocks.map((b) => {
        const n = b.skills;
        return (
          <Fold
            key={b.key}
            forceOpen={filtering}
            tone={b.anyTc ? 'tc' : undefined}
            summary={
              <>
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  {b.num != null && (
                    <span className="inline-block min-w-[18px] rounded-full bg-acc px-1 text-center text-[11px] leading-[18px] font-bold text-background">{b.num}</span>
                  )}
                  <span className="font-semibold tabular-nums">{b.t == null ? '–' : fmt(b.t, 1) + ' ms'}</span>
                  {!fromStart && (dm && dm.pct == null
                    ? <span className="text-muted-foreground">%/s needs value</span>
                    : b.rate != null ? <span><b className="tabular-nums">{fmtRate(b.rate, dm)}</b> %/s</span> : null)}
                  <span className="text-[13px] text-muted-foreground">
                    {n} skill{n === 1 ? '' : 's'}{b.cool.length ? ` + ${b.cool.length} on cooldown` : ''}
                  </span>
                  {b.anyTc && <Chip tone="tc">true cancel</Chip>}
                </span>
                {!fromStart && b.rate != null && (
                  <span className="mt-1 block h-[3px] rounded-sm bg-muted" aria-hidden="true">
                    <i className="block h-[3px] rounded-sm bg-bar" style={{ width: `${((b.rate / maxRate) * 100).toFixed(1)}%` }} />
                  </span>
                )}
              </>
            }
          >
            {b.live.map((f, i) => <FuLine key={i} D={D} f={f} />)}
            {b.cool.length > 0 && <><Sub className="px-2.5">On cooldown</Sub>{b.cool.map((f, i) => <FuLine key={i} D={D} f={f} />)}</>}
            {b.un.length > 0 && <><Sub className="px-2.5">Unresolved skill press</Sub>{b.un.map((f, i) => <FuLine key={i} D={D} f={f} />)}</>}
          </Fold>
        );
      })}
    </div>
  );
}

/** one entry skill: its actions fold away; its name links to its section */
function EntryItem({ D, x }: { D: Slice; x: ReturnType<typeof entrySkills>['items'][number] }) {
  const [open, setOpen] = useState(false);
  const href = x.card ? cardHref(D, x.card) : null;
  const acts = x.acts.map((a) => (
    <li key={a.label}>
      {a.label}
      {a.ult === 'only' && <> <Chip tone="acc">Ultimate</Chip></>}
      {a.ult === 'also' && <> <Chip tone="acc">also via Ultimate</Chip></>}
      {a.route && !x.allRoute && <> <Chip tone="acc">{a.route.only ? a.route.name : `also via ${a.route.name}`}</Chip></>}
      <LateBadge texts={a.late} />
    </li>
  ));
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-start gap-1.5 px-2.5 py-1.5">
        <button
          type="button"
          aria-expanded={open}
          aria-label={`Actions of ${x.name}`}
          onClick={() => setOpen(!open)}
          className="mt-[1px] cursor-pointer rounded text-muted-foreground hover:text-foreground"
        >
          <ChevronRight aria-hidden className={'size-4 transition-transform' + (open ? ' rotate-90' : '')} />
        </button>
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          <b>{href ? <a href={href} className="text-foreground">{x.name}</a> : x.name}</b>
          {x.allUlt && <> <Chip tone="acc">Ultimate</Chip></>}
          {x.allRoute && <> <Chip tone="acc">{x.allRoute}</Chip></>}
          <LateBadge texts={x.late} />
        </span>
      </div>
      {open && (
        <ul className="mt-0.5 mb-1.5 list-disc pl-10 text-[13px] [overflow-wrap:anywhere] [&>li]:my-0.5">
          {x.all ? <><li>All actions</li>{x.anyUlt && !x.allUlt && acts}</> : acts}
        </ul>
      )}
    </div>
  );
}

/** the skills that lead into a preset or card */
export function EntrySkillsView({ D, lists }: { D: Slice; lists: (string | null | undefined)[] }) {
  const es = entrySkills(D, lists);
  return (
    <Fold summary={<><b>Entry Skills</b> <span className="text-[13px] text-muted-foreground">{es.head}</span></>}>
      <div className="flex flex-col gap-1.5 px-2.5 pb-2">
        {es.cmd && <div className="text-[13px]">Skill command</div>}
        {es.hot && <div className="text-[13px]">Hotbar</div>}
        {es.items.map((x) => <EntryItem key={x.name} D={D} x={x} />)}
      </div>
    </Fold>
  );
}
