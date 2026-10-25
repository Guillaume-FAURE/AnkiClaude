export interface Language {
  code: string;
  label: string;
  /** BCP 47 tag used to pick a speech synthesis voice. */
  speech: string;
  /** Default transcription id for new decks. */
  transcription: string;
}

export const LANGUAGES: Language[] = [
  { code: 'yue', label: 'Cantonais', speech: 'zh-HK', transcription: 'jyutping' },
  { code: 'zh', label: 'Mandarin', speech: 'zh-CN', transcription: 'pinyin' },
  { code: 'ja', label: 'Japonais', speech: 'ja-JP', transcription: 'romaji' },
  { code: 'ko', label: 'Coréen', speech: 'ko-KR', transcription: 'romanization' },
  { code: 'fr', label: 'Français', speech: 'fr-FR', transcription: 'none' },
  { code: 'en', label: 'Anglais', speech: 'en-US', transcription: 'none' },
  { code: 'es', label: 'Espagnol', speech: 'es-ES', transcription: 'none' },
  { code: 'de', label: 'Allemand', speech: 'de-DE', transcription: 'none' },
  { code: 'it', label: 'Italien', speech: 'it-IT', transcription: 'none' },
  { code: 'pt', label: 'Portugais', speech: 'pt-PT', transcription: 'none' },
  { code: 'ru', label: 'Russe', speech: 'ru-RU', transcription: 'romanization' },
  { code: 'ar', label: 'Arabe', speech: 'ar-SA', transcription: 'romanization' },
  { code: 'th', label: 'Thaï', speech: 'th-TH', transcription: 'romanization' },
  { code: 'vi', label: 'Vietnamien', speech: 'vi-VN', transcription: 'none' },
];

export const TRANSCRIPTIONS = [
  { id: 'jyutping', label: 'Jyutping' },
  { id: 'pinyin', label: 'Pinyin' },
  { id: 'romaji', label: 'Rōmaji' },
  { id: 'romanization', label: 'Romanisation' },
  { id: 'ipa', label: 'Alphabet phonétique (API)' },
  { id: 'none', label: 'Aucune' },
];

export function language(code: string): Language {
  return (
    LANGUAGES.find((l) => l.code === code) ?? {
      code,
      label: code,
      speech: code,
      transcription: 'none',
    }
  );
}

export function languageLabel(code: string): string {
  return code ? language(code).label : '';
}

export function transcriptionLabel(id: string): string {
  return TRANSCRIPTIONS.find((t) => t.id === id)?.label ?? id;
}
