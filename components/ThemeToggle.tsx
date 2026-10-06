'use client';

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
    <button type="button" onClick={flip} aria-label="Switch light or dark theme">Light / dark</button>
  );
}
