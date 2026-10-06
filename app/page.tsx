import Link from 'next/link';
import { classSpecs, specSeg, title } from '../lib/data';

export default function Home() {
  const list = classSpecs();
  return (
    <>
      <h1>Classes</h1>
      <ul className="cls-list">
        {list.map((c) => (
          <li key={`${c.cls}.${c.spec}`} className="skill row">
            <Link className="nm" href={`/${c.cls}/${specSeg(c.spec)}/`}>
              {title(c.cls)} · {c.spec ? title(c.spec) : 'All skills'}
            </Link>{' '}
            <span className="mut small">game build {c.build}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
