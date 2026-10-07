'use client';
import { ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  type ChipData, type FuNamePart, type InputWords, type Slice, keyPieces, reqAs,
} from '../lib/present';

/** a card's section on its spec page */
export const cardHref = (D: Pick<Slice, 'slugs'>, id: string) => (D.slugs[id] ? `#${D.slugs[id]}` : null);

// ---- chips -----------------------------------------------------------------

const TONE: Record<string, string> = {
  neutral: 'bg-muted text-muted-foreground',
  warn: 'bg-warn-bg text-warn',
  acc: 'bg-acc-bg text-acc',
  bad: 'bg-bad-bg text-bad',
  tc: 'bg-bad-bg text-bad border-bad',
  meas: 'bg-meas-bg text-meas',
  good: 'bg-good-bg text-good',
  inf: 'bg-inf-bg text-inf',
};
// the chip classes lib/present.ts names
const CLS_TONE: Record<string, string> = {
  'c-req': 'warn', 'c-ult': 'acc', 'c-cool': 'bad', 'c-tc': 'tc', 'c-bs': 'meas', 'c-reach': 'acc',
  'c-flip': 'warn', 'g-need': 'warn', 'g-game': 'good', 'g-meas': 'meas', 'g-inf': 'inf',
};
export type Tone = keyof typeof TONE;

export function Chip({ tone = 'neutral', title, children, className }: {
  tone?: Tone; title?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <Badge
      variant="outline"
      title={title}
      className={cn('max-w-full border-transparent align-middle whitespace-normal text-left leading-tight font-medium', TONE[tone], className)}
    >
      {children}
    </Badge>
  );
}

const toneOf = (cls: string) => {
  for (const c of cls.split(/\s+/)) if (CLS_TONE[c]) return CLS_TONE[c] as Tone;
  return 'neutral' as Tone;
};

export function Chips({ list }: { list: ChipData[] }) {
  return <>{list.map((c, i) => <Fragment key={i}> <Chip tone={toneOf(c.cls)} title={c.title}>{c.label}</Chip></Fragment>)}</>;
}

// ---- keys and inputs ---------------------------------------------------------

export const Kbd = ({ k }: { k: string }) => (
  <kbd className="inline-block rounded-[5px] border border-b-2 border-input/60 bg-muted px-1.5 font-sans text-xs leading-[1.35] text-foreground">{k}</kbd>
);

/** text with its key names drawn as keys */
export function KeyText({ text }: { text: string }) {
  return <>{keyPieces(text).map(([s, isKey], i) => (isKey ? <Kbd key={i} k={s} /> : <Fragment key={i}>{s}</Fragment>))}</>;
}

/** an input in plain words: "hold Shift + LMB, press F" */
export function InputView({ x }: { x: InputWords }) {
  if (x.keyText != null) return <KeyText text={x.keyText} />;
  return (
    <>
      {x.parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && ', '}
          {'verb' in p
            ? <>{p.verb} {p.keys.map((k, j) => <Fragment key={j}>{j > 0 && ' + '}<Kbd k={k} /></Fragment>)}</>
            : p.text}
        </Fragment>
      ))}
    </>
  );
}

/** an input's requirements as chips, its profile assumptions folded away */
export function ReqAs({ D, x, ul }: { D: Pick<Slice, 'spec' | 'class'>; x: InputWords; ul?: string | null }) {
  return (
    <>
      <Chips list={reqAs(x, ul, D.spec, D.class)} />
      {x.as.length > 0 && <> <Assumed text={x.as.join(', ')} /></>}
    </>
  );
}

/** "assumed": a small toggle that shows the assumptions */
export function Assumed({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="cursor-pointer text-xs text-muted-foreground underline decoration-dotted underline-offset-2"
      >
        assumed
      </button>
      {open && <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">{text}</span>}
    </>
  );
}

/** "press late": a shadowed exit (an earlier exit takes the same input);
 * its text shows on hover (title) and on tap / Enter (it toggles) */
export function LateBadge({ texts }: { texts: string[] }) {
  const [open, setOpen] = useState(false);
  if (!texts.length) return null;
  const t = texts.join(' · ');
  return (
    <>
      {' '}
      <button
        type="button"
        aria-expanded={open}
        title={t}
        onClick={() => setOpen(!open)}
        className="inline-flex cursor-pointer items-center rounded-full bg-warn-bg px-2 py-0.5 align-middle text-xs leading-tight font-medium text-warn underline decoration-dotted underline-offset-2"
      >
        press late
      </button>
      {open && <span className="mt-0.5 block text-xs font-normal text-foreground [overflow-wrap:anywhere]">{t}</span>}
    </>
  );
}

/** a follow-up's name: each card it enters, linked to the card's section */
export function FuNameView({ D, parts }: { D: Pick<Slice, 'slugs'>; parts: FuNamePart[] }) {
  return (
    <>
      {parts.map((x, i) => {
        const href = x.card ? cardHref(D, x.card) : null;
        return <Fragment key={i}>{i > 0 && ' + '}{href ? <a href={href} className="text-foreground">{x.name}</a> : x.name}</Fragment>;
      })}
    </>
  );
}

// ---- a fold: a summary that opens into its content ----------------------------

export function Fold({ summary, children, defaultOpen = false, forceOpen = false, className, tone, onOpenChange }: {
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** shown open whatever was toggled (a filter is on) */
  forceOpen?: boolean;
  className?: string;
  tone?: 'tc';
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible
      open={open || forceOpen}
      onOpenChange={(o) => {
        setOpen(o);
        onOpenChange?.(o);
      }}
      className={cn('rounded-lg border bg-card', tone === 'tc' && 'border-l-4 border-l-bad border-bad/60', className)}
    >
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-left hover:bg-muted/60">
        <ChevronRight aria-hidden className="mt-[3px] size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        <span className="min-w-0 flex-1">{summary}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

/** a small heading inside a fold */
export const Sub = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('mt-2 mb-0.5 text-xs text-muted-foreground', className)}>{children}</div>
);
