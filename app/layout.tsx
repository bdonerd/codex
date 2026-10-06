import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import ThemeToggle from '../components/ThemeToggle';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Codex', template: '%s · Codex' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

// applies a stored theme choice before the first paint
const THEME = "try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
      </head>
      <body>
        <div className="wrap">
          <nav className="site" aria-label="Site">
            <Link className="home" href="/">Codex</Link>
            <ThemeToggle />
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
