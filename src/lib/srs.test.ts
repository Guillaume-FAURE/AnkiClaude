import { describe, expect, it } from 'vitest';
import { createEmptyCard } from 'ts-fsrs';
import type { Card, Deck } from '../db';
import { buildQueue, deckStats, formatInterval, grade, preview, Rating } from './srs';

const now = new Date('2026-10-25T10:00:00Z');

function deck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: 1,
    name: 'Test',
    description: '',
    targetLang: 'yue',
    nativeLang: 'fr',
    secondaryLang: 'en',
    transcription: 'jyutping',
    direction: 'forward',
    voiceURI: '',
    newPerDay: 2,
    createdAt: now,
    lastReviewedAt: null,
    ...overrides,
  };
}

function card(id: number, srs: Card['srs'] = {}): Card {
  return {
    id,
    deckId: 1,
    word: `w${id}`,
    pronunciation: '',
    translation: `t${id}`,
    secondary: '',
    example: '',
    exampleTranslation: '',
    audio: null,
    srs,
    createdAt: now,
  };
}

function reviewed(dueOffsetDays: number) {
  const base = createEmptyCard(new Date(now.getTime() - 30 * 86400000));
  const learned = grade(card(0, { forward: base }), 'forward', Rating.Good, base.due);
  return { ...learned, due: new Date(now.getTime() + dueOffsetDays * 86400000) };
}

describe('buildQueue', () => {
  it('puts due cards first, most overdue first, then limits new cards', () => {
    const cards = [card(1), card(2, { forward: reviewed(-1) }), card(3), card(4, { forward: reviewed(-3) }), card(5), card(6, { forward: reviewed(2) })];
    const queue = buildQueue(deck(), cards, 0, now);
    expect(queue.map((q) => q.cardId)).toEqual([4, 2, 1, 3]);
  });

  it('respects new cards already seen today', () => {
    const queue = buildQueue(deck(), [card(1), card(2), card(3)], 1, now);
    expect(queue).toHaveLength(1);
  });

  it('queues both directions when the deck reviews both ways', () => {
    const queue = buildQueue(deck({ direction: 'both', newPerDay: 10 }), [card(1)], 0, now);
    expect(queue).toEqual([
      { cardId: 1, direction: 'forward' },
      { cardId: 1, direction: 'reverse' },
    ]);
  });
});

describe('deckStats', () => {
  it('counts due, new and today’s new cards', () => {
    const stats = deckStats(deck(), [card(1), card(2), card(3, { forward: reviewed(-1) })], 0, now);
    expect(stats).toMatchObject({ total: 3, due: 1, fresh: 2, newToday: 2 });
  });
});

describe('scheduling', () => {
  it('schedules "again" sooner than "hard", and "hard" no later than "good"', () => {
    const p = preview(card(1, { forward: reviewed(0) }), 'forward', now);
    expect(p[Rating.Again].getTime()).toBeLessThan(p[Rating.Hard].getTime());
    expect(p[Rating.Hard].getTime()).toBeLessThanOrEqual(p[Rating.Good].getTime());
  });
});

describe('formatInterval', () => {
  it.each([
    [30 * 1000, '< 1 min'],
    [10 * 60 * 1000, '10 min'],
    [3 * 3600 * 1000, '3 h'],
    [86400 * 1000, '1 jour'],
    [5 * 86400 * 1000, '5 jours'],
    [60 * 86400 * 1000, '2 mois'],
    [400 * 86400 * 1000, '1 an'],
  ])('%i ms → %s', (ms, label) => {
    expect(formatInterval(new Date(now.getTime() + ms), now)).toBe(label);
  });
});
