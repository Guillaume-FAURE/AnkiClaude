import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createEmptyCard } from 'ts-fsrs';
import { db, emptyCard } from '../db';
import { exportBackup, importBackup } from './backup';
import { setSetting, getSetting } from './settings';

describe('backup', () => {
  it('round-trips decks, cards, audio and dates, and never exports the API key', async () => {
    const deckId = await db.decks.add({
      name: 'Cantonais',
      description: '',
      targetLang: 'yue',
      nativeLang: 'fr',
      secondaryLang: '',
      transcription: 'jyutping',
      direction: 'forward',
      voiceURI: '',
      newPerDay: 20,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      lastReviewedAt: null,
    });
    const due = new Date('2026-11-01T00:00:00Z');
    await db.cards.add({
      ...emptyCard(deckId),
      word: '你好',
      translation: 'Bonjour',
      audio: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' }),
      srs: { forward: createEmptyCard(due) },
    });
    await setSetting('ai', { apiKey: 'sk-ant-secret' });

    const blob = await exportBackup();
    const text = await blob.text();
    expect(text).not.toContain('sk-ant-secret');

    await db.cards.clear();
    await setSetting('ai', { apiKey: 'sk-ant-other-device' });
    await importBackup(new Blob([text]));

    const [card] = await db.cards.toArray();
    expect(card.word).toBe('你好');
    expect(card.srs.forward?.due).toEqual(due);
    expect(new Uint8Array(await card.audio!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect((await getSetting('ai')).apiKey).toBe('sk-ant-other-device');
  });
});
