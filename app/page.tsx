import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { classSpecs, specSeg, title } from '../lib/data';

export default function Home() {
  const list = classSpecs();
  return (
    <>
      <section aria-labelledby="leaderboard" className="rounded-xl border border-dashed bg-card p-4">
        <h1 id="leaderboard" className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="mt-1 text-muted-foreground">Coming later.</p>
      </section>
      <h2 className="mt-6 mb-2 text-[13px] font-medium tracking-wider text-muted-foreground uppercase">Classes</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <li key={`${c.cls}.${c.spec}`}>
            <Link href={`/${c.cls}/${specSeg(c.spec)}/`} className="group block rounded-xl text-foreground no-underline hover:no-underline">
              <Card className="gap-1 py-4 transition-colors group-hover:border-primary">
                <CardHeader className="px-4">
                  <CardTitle className="text-lg">{title(c.cls)}</CardTitle>
                </CardHeader>
                <CardContent className="px-4">
                  <div>{c.spec ? title(c.spec) : 'All skills'}</div>
                  <div className="text-[13px] text-muted-foreground">game build {c.build}</div>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
