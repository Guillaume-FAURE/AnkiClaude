import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Card, type Deck } from '../db';
import { deckStats, startOfToday, type DeckStats } from './srs';

/** New cards already introduced today, per deck (to respect the daily limit). */
export async function newSeenToday(): Promise<Map<number, number>> {
  const logs = await db.logs.where('reviewedAt').aboveOrEqual(startOfToday()).toArray();
  const counts = new Map<number, number>();
  for (const log of logs) {
    if (log.prevState === 0) counts.set(log.deckId, (counts.get(log.deckId) ?? 0) + 1);
  }
  return counts;
}

export interface DeckOverview {
  deck: Deck;
  cards: Card[];
  stats: DeckStats;
}

export function useDeckOverviews(): DeckOverview[] | undefined {
  return useLiveQuery(async () => {
    const [decks, cards, seen] = await Promise.all([db.decks.toArray(), db.cards.toArray(), newSeenToday()]);
    const byDeck = new Map<number, Card[]>();
    for (const c of cards) byDeck.set(c.deckId, [...(byDeck.get(c.deckId) ?? []), c]);
    return decks
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((deck) => {
        const deckCards = byDeck.get(deck.id) ?? [];
        return { deck, cards: deckCards, stats: deckStats(deck, deckCards, seen.get(deck.id) ?? 0) };
      });
  });
}

export function useDeckOverview(deckId: number): DeckOverview | null | undefined {
  return useLiveQuery(async () => {
    const deck = await db.decks.get(deckId);
    if (!deck) return null;
    const [cards, seen] = await Promise.all([db.cards.where('deckId').equals(deckId).toArray(), newSeenToday()]);
    return { deck, cards, stats: deckStats(deck, cards, seen.get(deckId) ?? 0) };
  }, [deckId]);
}

export async function deleteDeck(deckId: number) {
  await db.transaction('rw', [db.decks, db.cards, db.logs], async () => {
    await db.cards.where('deckId').equals(deckId).delete();
    await db.logs.where('deckId').equals(deckId).delete();
    await db.decks.delete(deckId);
  });
}
