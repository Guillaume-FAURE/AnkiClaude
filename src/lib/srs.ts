import { createEmptyCard, fsrs, Rating, State, type Card as FsrsCard, type Grade } from 'ts-fsrs';
import type { Card, Deck, Direction } from '../db';

export { Rating, State };

const scheduler = fsrs({ enable_fuzz: true });

/** The three answers offered during review. */
export const GRADES = [
  { rating: Rating.Again, label: 'Je ne me souviens plus', tone: 'again' },
  { rating: Rating.Hard, label: 'Je me souviens difficilement', tone: 'hard' },
  { rating: Rating.Good, label: 'Je me souviens', tone: 'good' },
] as const;

export interface QueueItem {
  cardId: number;
  direction: Direction;
}

export function directionsOf(deck: Deck): Direction[] {
  return deck.direction === 'both' ? ['forward', 'reverse'] : [deck.direction];
}

export function srsOf(card: Card, direction: Direction, now = new Date()): FsrsCard {
  return card.srs[direction] ?? createEmptyCard(now);
}

export function isNew(card: Card, direction: Direction): boolean {
  const s = card.srs[direction];
  return !s || s.state === State.New;
}

export function isDue(card: Card, direction: Direction, now = new Date()): boolean {
  const s = card.srs[direction];
  return !!s && s.state !== State.New && s.due.getTime() <= now.getTime();
}

/** A card is "mastered" once it is in review with an interval of three weeks or more. */
export function isMastered(card: Card, direction: Direction): boolean {
  const s = card.srs[direction];
  return !!s && s.state === State.Review && s.scheduled_days >= 21;
}

export interface DeckStats {
  total: number;
  due: number;
  fresh: number;
  /** New cards that would be introduced today, given the daily limit. */
  newToday: number;
  mastery: number;
}

export function deckStats(deck: Deck, cards: Card[], newSeenToday: number, now = new Date()): DeckStats {
  const dirs = directionsOf(deck);
  let due = 0;
  let fresh = 0;
  let mastered = 0;
  let slots = 0;
  for (const card of cards) {
    for (const d of dirs) {
      slots++;
      if (isDue(card, d, now)) due++;
      else if (isNew(card, d)) fresh++;
      if (isMastered(card, d)) mastered++;
    }
  }
  const newToday = Math.min(fresh, Math.max(0, deck.newPerDay - newSeenToday));
  return {
    total: cards.length,
    due,
    fresh,
    newToday,
    mastery: slots ? Math.round((mastered / slots) * 100) : 0,
  };
}

/** Builds a session: due reviews first (most overdue first), then today's new cards. */
export function buildQueue(deck: Deck, cards: Card[], newSeenToday: number, now = new Date()): QueueItem[] {
  const dirs = directionsOf(deck);
  const due: { item: QueueItem; at: number }[] = [];
  const fresh: QueueItem[] = [];
  for (const card of cards) {
    for (const direction of dirs) {
      if (isDue(card, direction, now)) {
        due.push({ item: { cardId: card.id, direction }, at: card.srs[direction]!.due.getTime() });
      } else if (isNew(card, direction)) {
        fresh.push({ cardId: card.id, direction });
      }
    }
  }
  due.sort((a, b) => a.at - b.at);
  const limit = Math.max(0, deck.newPerDay - newSeenToday);
  return [...due.map((d) => d.item), ...fresh.slice(0, limit)];
}

export function grade(card: Card, direction: Direction, rating: Grade, now = new Date()): FsrsCard {
  return scheduler.next(srsOf(card, direction, now), now, rating).card;
}

/** Next due date for each answer, to show on the buttons. */
export function preview(card: Card, direction: Direction, now = new Date()): Record<Grade, Date> {
  const p = scheduler.repeat(srsOf(card, direction, now), now);
  return {
    [Rating.Again]: p[Rating.Again].card.due,
    [Rating.Hard]: p[Rating.Hard].card.due,
    [Rating.Good]: p[Rating.Good].card.due,
    [Rating.Easy]: p[Rating.Easy].card.due,
  } as Record<Grade, Date>;
}

export function formatInterval(due: Date, now = new Date()): string {
  const ms = due.getTime() - now.getTime();
  if (ms < 60000) return '< 1 min';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return '1 jour';
  if (days < 31) return `${days} jours`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} mois`;
  const years = Math.round(days / 365);
  return years === 1 ? '1 an' : `${years} ans`;
}

export function startOfToday(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}
