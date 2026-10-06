import Link from 'next/link';
import { Fragment } from 'react';
import {
  type ChipData, type FuNamePart, type InputWords, type Slice, keyPieces, reqAs,
} from '../lib/present';

export const specPath = (D: Pick<Slice, 'class' | 'spec'>) => `/${D.class}/${D.spec ?? 'all'}/`;
export const cardHref = (D: Pick<Slice, 'class' | 'spec' | 'slugs'>, id: string) =>
  D.slugs[id] ? `${specPath(D)}${D.slugs[id]}/` : null;

export const Kbd = ({ k }: { k: string }) => <span className="kbd">{k}</span>;

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

export function Chips({ list }: { list: ChipData[] }) {
  return <>{list.map((c, i) => <Fragment key={i}> <span className={c.cls} title={c.title}>{c.label}</span></Fragment>)}</>;
}

export const UltChip = ({ name }: { name: string | null | undefined }) =>
  name ? <> <span className="chip c-ult" title={name}>Ultimate</span></> : null;

/** an input's requirements as chips, its profile assumptions folded away */
export function ReqAs({ D, x, ul }: { D: Pick<Slice, 'spec' | 'class'>; x: InputWords; ul?: string | null }) {
  return (
    <>
      <Chips list={reqAs(x, ul, D.spec, D.class)} />
      {x.as.length > 0 && (
        <>
          {' '}
          <details className="raw">
            <summary className="mut small">assumed</summary>
            <span className="small mut">{x.as.join(', ')}</span>
          </details>
        </>
      )}
    </>
  );
}

/** a follow-up's name: each card it enters, linked to the card's page */
export function FuNameView({ D, parts }: { D: Pick<Slice, 'class' | 'spec' | 'slugs'>; parts: FuNamePart[] }) {
  return (
    <>
      {parts.map((x, i) => {
        const href = x.card ? cardHref(D, x.card) : null;
        return <Fragment key={i}>{i > 0 && ' + '}{href ? <Link href={href} prefetch={false}>{x.name}</Link> : x.name}</Fragment>;
      })}
    </>
  );
}
