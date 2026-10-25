import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

export interface Profile {
  name: string;
  /** Small JPEG data URL. */
  photo: string;
}

export interface ThemeSettings {
  id: string;
  /** Accent key inside the theme's accents, '' = the theme's first accent. */
  accent: string;
  followSystem: boolean;
}

export const AI_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (le plus précis)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (équilibré)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (rapide, économique)' },
] as const;

export interface AiSettings {
  provider: 'anthropic';
  apiKey: string;
  model: string;
}

interface SettingsMap {
  profile: Profile;
  theme: ThemeSettings;
  ai: AiSettings;
}

export const DEFAULTS: SettingsMap = {
  profile: { name: '', photo: '' },
  theme: { id: 'clair', accent: '', followSystem: false },
  ai: { provider: 'anthropic', apiKey: '', model: 'claude-opus-5-5' },
};

export async function getSetting<K extends keyof SettingsMap>(key: K): Promise<SettingsMap[K]> {
  const row = await db.settings.get(key);
  return { ...DEFAULTS[key], ...((row?.value as Partial<SettingsMap[K]>) ?? {}) };
}

export async function setSetting<K extends keyof SettingsMap>(key: K, patch: Partial<SettingsMap[K]>) {
  const current = await getSetting(key);
  await db.settings.put({ key, value: { ...current, ...patch } });
}

/** Live value of a setting; defaults while loading. */
export function useSetting<K extends keyof SettingsMap>(key: K): SettingsMap[K] {
  return useLiveQuery(() => getSetting(key), [key]) ?? DEFAULTS[key];
}
