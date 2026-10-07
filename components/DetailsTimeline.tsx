'use client';
import {
  type Speeds, atTime, longSegs, segDuration, timelineOf,
} from '../lib/clock';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { type Slice, damage, fmt, fuName, groupNumbers, skillName, timed } from '../lib/present';
import type { PresetRec } from '../lib/view';

/** The Details of a preset: a timeline of its actions (with the part
 * after the final hit muted), exit windows, numbered hits and numbered
 * follow-up groups, running to the last follow-up; then the action list. */
export default function DetailsTimeline({ D, p, sp }: { D: Slice; p: PresetRec; sp: Speeds }) {
  const pre = timelineOf(D.clock, p.segs, sp);
  const tl = timelineOf(D.clock, longSegs(D.clock, p.segs, p.fu.map((f) => D.segs[f.sg]), sp), sp);
  if (!pre || !tl) return <div className="mt-1.5 text-[13px] text-muted-foreground">This path cannot be timed.</div>;
  const finalT = pre.total;
  const fus = timed(D, p, damage(p, D.lines), sp).fus;
  const num = groupNumbers(fus);
  const groups = [...num.entries()].map(([k, n]) => {
    const fs = fus.filter((f) => f.t != null && f.t.toFixed(1) === k);
    return { n, t: +k, skills: new Set(fs.filter((f) => !f.cool).map((f) => fuName(D, f))).size, fs };
  });
  const lastT = groups.length ? groups[groups.length - 1].t : 0;
  const total = Math.max(tl.total, finalT, lastT, 1);
  const G = 58;
  const W = G + Math.max(600, Math.round(total * 0.75)) + 16;
  const X = (t: number) => G + (t / total) * (W - G - 16);
  const Y = { top: 12, act: 18, win: 46, hit: 70, exit: 98, axis: 118 };
  const H = Y.axis + 22;
  const lane = (y: number, label: string) => <text x={4} y={y} fontSize={11} fontWeight={600} fill="var(--muted-foreground)">{label}</text>;

  const acts = tl.segs.map((g, i) => {
    const solidEnd = Math.min(g.t1, finalT);
    const tailStart = Math.max(g.t0, finalT);
    const w = X(g.t1) - X(g.t0);
    const fit = Math.max(0, Math.floor((w - 6) / 6.2));
    return (
      <g key={`a${i}`}>
        {solidEnd > g.t0 && (
          <rect x={X(g.t0)} y={Y.act} width={Math.max(1, X(solidEnd) - X(g.t0))} height={20} rx={3} fill="var(--bar)" opacity={i % 2 ? 0.45 : 0.7}>
            <title>{`${g.a} · ${fmt(g.t0, 1)}–${fmt(solidEnd, 1)} ms`}</title>
          </rect>
        )}
        {g.t1 > tailStart && (
          <rect x={X(tailStart)} y={Y.act} width={Math.max(1, X(g.t1) - X(tailStart))} height={20} rx={3} fill="var(--muted-foreground)" opacity={0.28}>
            <title>{`${g.a} · after the final hit · ${fmt(tailStart, 1)}–${fmt(g.t1, 1)} ms`}</title>
          </rect>
        )}
        {fit >= 3 && (
          <text className="tl-act" x={X(g.t0) + 3} y={Y.act + 14} fontSize={11} fill={g.t0 >= finalT ? 'var(--muted-foreground)' : 'var(--foreground)'}>
            {g.a.length > fit ? g.a.slice(0, fit - 1) + '…' : g.a}
          </text>
        )}
      </g>
    );
  });

  const wins: React.ReactNode[] = [];
  tl.segs.forEach((g, i) => {
    const xw = D.xw[g.a];
    if (!xw) return;
    xw.w.forEach(([lo, hi, to], j) => {
      const a = Math.max(lo, g.f0);
      const b = Math.min(hi, g.f1);
      if (b < a) return;
      const one = { segs: [g], total: g.d };
      const t0 = atTime(D.clock, one, g.a, a, sp) as number;
      const t1 = atTime(D.clock, one, g.a, b, sp) as number;
      wins.push(
        <rect key={`w${i}-${j}`} x={X(t0)} y={Y.win} width={Math.max(2, X(t1) - X(t0))} height={10} rx={2} fill="var(--win)" opacity={0.55}>
          <title>{`${g.a} exit window f${lo}–${hi} (${fmt(t0, 1)}–${fmt(t1, 1)} ms): ${to.map((s) => skillName(D, s)).join(', ') || 'a skill'}`}</title>
        </rect>,
      );
    });
  });

  const hits: React.ReactNode[] = [];
  let hn = 0;
  for (const gr of p.groups) {
    for (const [ls, cond, f] of gr.ticks) {
      hn++;
      if (f == null) continue;
      const t = atTime(D.clock, pre, gr.action as string, f, sp);
      if (t == null) continue;
      const vals = ls.map((l) => (D.lines[l] || { pct: null }).pct);
      const pct = ls.length && vals.every((v) => v != null) ? fmt((vals as number[]).reduce((a, b) => a + b, 0)) + '%' : 'needs value';
      hits.push(
        <g key={`h${hn}`}>
          <title>{`hit ${hn} · ${pct} · ${fmt(t, 1)} ms${cond ? ' · conditional' : ''}`}</title>
          <circle cx={X(t)} cy={Y.hit} r={8} fill="var(--hit)" />
          <text x={X(t)} y={Y.hit + 4} fontSize={10} fontWeight={700} textAnchor="middle" fill="var(--background)">{hn}</text>
        </g>,
      );
    }
  }

  const exits: React.ReactNode[] = [];
  for (const g of groups) {
    exits.push(
      <g key={`e${g.n}`}>
        <title>{`exit ${g.n} · ${fmt(g.t, 1)} ms · ${g.skills} skill${g.skills === 1 ? '' : 's'}`}</title>
        <circle cx={X(g.t)} cy={Y.exit} r={8} fill="var(--acc)" />
        <text x={X(g.t)} y={Y.exit + 4} fontSize={10} fontWeight={700} textAnchor="middle" fill="var(--background)">{g.n}</text>
      </g>,
    );
    const tcs = new Set<string>();
    for (const f of g.fs) {
      if (f.tc && f.cf != null) {
        const tc = atTime(D.clock, pre, (f.ca || f.at) as string, f.cf, sp);
        if (tc != null) tcs.add(tc.toFixed(1));
      }
    }
    for (const k of tcs) {
      const tc = +k;
      exits.push(
        <g key={`tc${g.n}-${k}`}>
          <title>{`exit ${g.n} true cancel · opens at ${fmt(tc, 1)} ms, before the final hit`}</title>
          <rect x={X(tc) - 7} y={Y.exit - 7} width={14} height={14} rx={2} fill="var(--bad)" />
          <text x={X(tc)} y={Y.exit + 4} fontSize={10} fontWeight={700} textAnchor="middle" fill="var(--background)">{g.n}</text>
          <text x={X(tc)} y={Y.exit - 11} fontSize={9} textAnchor="middle" fill="var(--bad)">true cancel</text>
        </g>,
      );
    }
  }

  const step = total < 1500 ? 100 : total < 4000 ? 250 : 500;
  const ticks: React.ReactNode[] = [];
  for (let t = 0; t <= total; t += step) {
    ticks.push(
      <g key={`x${t}`}>
        <line x1={X(t)} x2={X(t)} y1={Y.axis} y2={Y.axis + 4} stroke="var(--muted-foreground)" />
        <text x={X(t)} y={Y.axis + 15} fontSize={10} textAnchor="middle" fill="var(--muted-foreground)">{t}</text>
      </g>,
    );
  }

  // the action list: the preset's segments, then the tail after the final hit
  const tail: [string, number, number][] = [];
  tl.segs.forEach((g, i) => {
    const ps = p.segs[i];
    if (ps && ps[0] === g.a && ps[1] === g.f0) {
      if (g.f1 > ps[2]) tail.push([g.a, ps[2], g.f1]);
    } else if (i >= p.segs.length) tail.push([g.a, g.f0, g.f1]);
  });
  const sw = (cls: string, label: string) => (
    <span className="inline-flex items-center gap-1.5"><i aria-hidden className={'inline-block ' + cls} />{label}</span>
  );
  const rc = 'text-right tabular-nums';

  return (
    <>
      <div className="my-1.5 max-w-full overflow-x-auto rounded-lg border bg-card">
        <svg className="block" width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="timeline of the cast">
          {lane(Y.act + 15, 'Actions')}{lane(Y.win + 8, 'Windows')}{lane(Y.hit + 4, 'Hits')}{lane(Y.exit + 4, 'Exits')}
          {acts}
          {wins}
          {hits}
          <line x1={X(finalT)} x2={X(finalT)} y1={Y.top + 2} y2={Y.exit + 10} stroke="var(--foreground)" strokeDasharray="3,3" opacity={0.7} />
          <text x={X(finalT) + 3} y={Y.top} fontSize={10} fill="var(--foreground)">{`final hit ${fmt(finalT, 1)} ms`}</text>
          {exits}
          <line x1={G} x2={X(total)} y1={Y.axis} y2={Y.axis} stroke="var(--border)" />
          {ticks}
          <text x={4} y={Y.axis + 15} fontSize={10} fill="var(--muted-foreground)">ms</text>
        </svg>
      </div>
      <div className="mt-1 mb-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {sw('h-2.5 w-3.5 rounded-[2px] bg-bar opacity-70', 'action')}
        {sw('h-2.5 w-3.5 rounded-[2px] bg-muted-foreground opacity-35', 'after the final hit')}
        {sw('h-2.5 w-3.5 rounded-[2px] bg-win opacity-60', 'exit window')}
        {sw('size-2.5 rounded-full bg-hit', 'hit (numbered)')}
        {sw('size-2.5 rounded-full bg-acc', 'follow-up group (numbered as above)')}
        {sw('h-2.5 w-3.5 rounded-[2px] bg-bad', 'true cancel opening')}
      </div>
      <Table className="text-[13px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8 font-medium text-muted-foreground">action</TableHead>
            <TableHead className="h-8 text-right font-medium text-muted-foreground">frames</TableHead>
            <TableHead className="h-8 text-right font-medium text-muted-foreground">time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pre.segs.map((g, i) => (
            <TableRow key={`s${i}`}>
              <TableCell className="py-1 font-mono text-xs whitespace-normal [overflow-wrap:anywhere]">{g.a}</TableCell>
              <TableCell className={'py-1 ' + rc}>f{g.f0}–{g.f1}</TableCell>
              <TableCell className={'py-1 ' + rc}>{fmt(g.d, 1)} ms</TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="py-1 text-muted-foreground">to the final hit</TableCell>
            <TableCell className="py-1" />
            <TableCell className={'py-1 ' + rc}><b>{fmt(finalT, 1)} ms</b></TableCell>
          </TableRow>
          {tail.map(([a, f0, f1], i) => (
            <TableRow key={`t${i}`} className="text-muted-foreground">
              <TableCell className="py-1 font-mono text-xs whitespace-normal [overflow-wrap:anywhere]">{a} <span className="font-sans">after the final hit</span></TableCell>
              <TableCell className={'py-1 ' + rc}>f{f0}–{f1}</TableCell>
              <TableCell className={'py-1 ' + rc}>{fmt(segDuration(D.clock, a, f0, f1, sp), 1)} ms</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
