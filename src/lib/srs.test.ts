import { describe, expect, it } from 'vitest';
import { createEmptyCard } from 'ts-fsrs';
import type { Card, Deck } from '../db';
import { buildQueue, deckStats, formatInterval, grade, preview, Rating, splitExampleTranslation } from './srs';

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
  it('takes every due card and the oldest new cards up to the daily limit', () => {
    const cards = [card(1), card(2, { forward: reviewed(-1) }), card(3), card(4, { forward: reviewed(-3) }), card(5), card(6, { forward: reviewed(2) })];
    const queue = buildQueue(deck(), cards, 0, now);
    expect(queue.map((q) => q.cardId).sort()).toEqual([1, 2, 3, 4]);
  });

  it('shuffles the order', () => {
    const cards = Array.from({ length: 30 }, (_, i) => card(i + 1));
    const orders = new Set(
      Array.from({ length: 5 }, () => buildQueue(deck({ newPerDay: 30 }), cards, 0, now).map((q) => q.cardId).join(',')),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it('respects new cards already seen today', () => {
    const queue = buildQueue(deck(), [card(1), card(2), card(3)], 1, now);
    expect(queue).toHaveLength(1);
  });

  it('queues both directions when the deck reviews both ways', () => {
    const queue = buildQueue(deck({ direction: 'both', newPerDay: 10 }), [card(1)], 0, now);
    expect(queue).toHaveLength(2);
    expect(new Set(queue.map((q) => q.direction))).toEqual(new Set(['forward', 'reverse']));
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

describe('new cards', () => {
  it('graduate on "Je me souviens" instead of coming back the same session', () => {
    const p = preview(card(1), 'forward', now);
    const day = 86400000;
    expect(p[Rating.Good].getTime() - now.getTime()).toBeGreaterThanOrEqual(day);
    expect(p[Rating.Again].getTime() - now.getTime()).toBeLessThan(day);
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

describe('splitExampleTranslation', () => {
  it('separates the transcription from the translation', () => {
    expect(splitExampleTranslation('nei5 sik6 zo2 faan6 mei6 aa3? — Tu as mangé ?', true)).toEqual({
      pronunciation: 'nei5 sik6 zo2 faan6 mei6 aa3?',
      translation: 'Tu as mangé ?',
    });
  });

  it('leaves the text alone without a transcription', () => {
    expect(splitExampleTranslation('Hola — Bonjour', false)).toEqual({ pronunciation: '', translation: 'Hola — Bonjour' });
  });
});
