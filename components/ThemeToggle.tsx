'use client';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ThemeToggle() {
  const flip = () => {
    const r = document.documentElement;
    const cur = r.getAttribute('data-theme');
    const dark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    r.setAttribute('data-theme', dark ? 'light' : 'dark');
    try {
      localStorage.setItem('theme', r.getAttribute('data-theme') as string);
    } catch {
      // storage unavailable: the choice lasts for this page only
    }
  };
  return (
    <Button type="button" variant="ghost" size="icon" onClick={flip} aria-label="Switch light or dark theme" title="Light / dark">
      <Sun aria-hidden className="dark:hidden" />
      <Moon aria-hidden className="hidden dark:block" />
    </Button>
  );
}
