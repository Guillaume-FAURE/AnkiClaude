import { useEffect, useState } from 'react';
import themesData from './themes.json';
import { useSetting, type ThemeSettings } from './settings';

export interface Theme {
  id: string;
  name: string;
  dark: boolean;
  source?: string;
  colors: { base: string; surface: string; border: string; strong: string; text: string; sub: string; onAccent: string };
  accents: Record<string, string>;
}

export const THEMES = themesData.themes as unknown as Theme[];

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

function useSystemDark(): boolean {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark;
}

export function resolveTheme(settings: ThemeSettings, systemDark: boolean): { theme: Theme; accent: string } {
  const id = settings.followSystem
    ? systemDark
      ? themesData.followSystem.dark
      : themesData.followSystem.light
    : settings.id;
  const theme = themeById(id);
  const accent = theme.accents[settings.accent] ?? Object.values(theme.accents)[0];
  return { theme, accent };
}

/** Applies the saved theme to the document as CSS variables. */
export function useApplyTheme() {
  const settings = useSetting('theme');
  const systemDark = useSystemDark();
  useEffect(() => {
    const { theme, accent } = resolveTheme(settings, systemDark);
    const root = document.documentElement;
    const c = theme.colors;
    root.style.setProperty('--base', c.base);
    root.style.setProperty('--surface', c.surface);
    root.style.setProperty('--border', c.border);
    root.style.setProperty('--strong', c.strong);
    root.style.setProperty('--text', c.text);
    root.style.setProperty('--sub', c.sub);
    root.style.setProperty('--on-accent', c.onAccent);
    root.style.setProperty('--accent', accent);
    root.dataset.dark = String(theme.dark);
    root.style.colorScheme = theme.dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.base);
  }, [settings, systemDark]);
}
