import { createEmptyCard, fsrs, Rating, State, type Card as FsrsCard, type Grade } from 'ts-fsrs';
import type { Card, Deck, Direction } from '../db';

export { Rating, State };

// One 10-minute learning step: a new card answered "Je me souviens" graduates
// straight away (about two days) instead of coming back ten minutes later.
const scheduler = fsrs({ enable_fuzz: true, learning_steps: ['10m'] });

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

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Builds a session from due reviews and today's new cards (oldest first), in random order. */
export function buildQueue(
  deck: Deck,
  cards: Card[],
  newSeenToday: number,
  now = new Date(),
  random: () => number = Math.random,
): QueueItem[] {
  const dirs = directionsOf(deck);
  const due: QueueItem[] = [];
  const fresh: QueueItem[] = [];
  for (const card of cards) {
    for (const direction of dirs) {
      if (isDue(card, direction, now)) due.push({ cardId: card.id, direction });
      else if (isNew(card, direction)) fresh.push({ cardId: card.id, direction });
    }
  }
  const limit = Math.max(0, deck.newPerDay - newSeenToday);
  return shuffle([...due, ...fresh.slice(0, limit)], random);
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

const STATE_LABELS: Record<number, string> = {
  [State.New]: 'Nouvelle',
  [State.Learning]: 'En apprentissage',
  [State.Review]: 'En révision',
  [State.Relearning]: 'À réapprendre',
};

export function stateLabel(state: State): string {
  return STATE_LABELS[state] ?? '';
}

/** "aujourd’hui à 14:30", "demain à 09:00", "mer. 29 oct." */
export function formatDueDate(due: Date, now = new Date()): string {
  const days = Math.round((startOfToday(due).getTime() - startOfToday(now).getTime()) / 86400000);
  const time = due.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (days === 0) return `aujourd’hui à ${time}`;
  if (days === 1) return `demain à ${time}`;
  return due.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(due.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/** Short schedule summary for a card in one direction. */
export function scheduleSummary(card: Card, direction: Direction, now = new Date()): string {
  const s = card.srs[direction];
  if (!s || s.state === State.New) return 'Nouvelle';
  if (s.due.getTime() <= now.getTime()) return 'À revoir maintenant';
  return `${formatDueDate(s.due, now)} · dans ${formatInterval(s.due, now)}`;
}
