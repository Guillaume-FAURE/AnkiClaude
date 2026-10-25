import Dexie, { type EntityTable } from 'dexie';
import type { Card as FsrsCard } from 'ts-fsrs';

export type Direction = 'forward' | 'reverse';
export type DirectionMode = Direction | 'both';

export interface Deck {
  id: number;
  name: string;
  description: string;
  /** Code from LANGUAGES (or a custom BCP 47 tag). */
  targetLang: string;
  nativeLang: string;
  /** Optional second translation language, '' when unused. */
  secondaryLang: string;
  /** Transcription system id from TRANSCRIPTIONS. */
  transcription: string;
  direction: DirectionMode;
  /** speechSynthesis voiceURI, '' = best voice for the language. */
  voiceURI: string;
  newPerDay: number;
  createdAt: Date;
  lastReviewedAt: Date | null;
}

export interface Card {
  id: number;
  deckId: number;
  word: string;
  pronunciation: string;
  translation: string;
  secondary: string;
  example: string;
  exampleTranslation: string;
  /** Recorded pronunciation, played instead of the synthetic voice when present. */
  audio: Blob | null;
  srs: Partial<Record<Direction, FsrsCard>>;
  createdAt: Date;
}

export interface ReviewLog {
  id: number;
  cardId: number;
  deckId: number;
  direction: Direction;
  rating: number;
  /** FSRS state of the card before this review (0 = new). */
  prevState: number;
  reviewedAt: Date;
}

export interface Setting {
  key: string;
  value: unknown;
}

export const db = new Dexie('ankiclaude') as Dexie & {
  decks: EntityTable<Deck, 'id'>;
  cards: EntityTable<Card, 'id'>;
  logs: EntityTable<ReviewLog, 'id'>;
  settings: EntityTable<Setting, 'key'>;
};

db.version(1).stores({
  decks: '++id, name',
  cards: '++id, deckId',
  logs: '++id, deckId, cardId, reviewedAt',
  settings: 'key',
});

export type NewDeck = Omit<Deck, 'id'>;
export type NewCard = Omit<Card, 'id'>;

export function emptyCard(deckId: number): NewCard {
  return {
    deckId,
    word: '',
    pronunciation: '',
    translation: '',
    secondary: '',
    example: '',
    exampleTranslation: '',
    audio: null,
    srs: {},
    createdAt: new Date(),
  };
}
