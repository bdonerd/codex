// One card's own data (lib/data.ts cardPayload), written as a static file
// at build: /cards/<class>/<spec>/<card id>.json. A spec page loads it when
// the card's section opens.
import { cardIds, cardPayload, classSpecs, specSeg } from '../../../../../lib/data';

type Params = { cls: string; spec: string; card: string };
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return classSpecs().flatMap((c) => {
    const spec = specSeg(c.spec);
    return cardIds(c.cls, spec).map((id) => ({ cls: c.cls, spec, card: `${id}.json` }));
  });
}

export async function GET(_req: Request, { params }: { params: Promise<Params> }) {
  const { cls, spec, card } = await params;
  return Response.json(cardPayload(cls, spec, card.replace(/\.json$/, '')));
}
