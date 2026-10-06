import type { Metadata } from 'next';
import CardList from '../../../components/CardList';
import { classSpecs, listData, specSeg } from '../../../lib/data';

type Params = { cls: string; spec: string };
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return classSpecs().map((c) => ({ cls: c.cls, spec: specSeg(c.spec) }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { cls, spec } = await params;
  return { title: listData(cls, spec).label };
}

export default async function SpecPage({ params }: { params: Promise<Params> }) {
  const { cls, spec } = await params;
  return <CardList data={listData(cls, spec)} />;
}
