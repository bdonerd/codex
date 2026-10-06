import type { Metadata } from 'next';
import CardView from '../../../../components/CardView';
import { cardData, cardParams, classSpecs, specSeg } from '../../../../lib/data';

type Params = { cls: string; spec: string; card: string };
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return classSpecs().flatMap((c) => {
    const spec = specSeg(c.spec);
    return cardParams(c.cls, spec).map((card) => ({ cls: c.cls, spec, card }));
  });
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { cls, spec, card } = await params;
  const d = cardData(cls, spec, card);
  const c = d.slice.cards[d.id];
  return { title: `${c.as_name || c.name || `Skill ${d.id}`} · ${d.label}` };
}

export default async function CardPage({ params }: { params: Promise<Params> }) {
  const { cls, spec, card } = await params;
  return <CardView data={cardData(cls, spec, card)} />;
}
