import { describe, expect, it } from 'vitest';
import { parseReply } from './ai';

describe('parseReply', () => {
  it('keeps complete new cards and only the changed fields of updates', () => {
    const reply = parseReply(
      JSON.stringify({
        message: ' Voici 1 carte. ',
        new_cards: [
          { word: '埋單', pronunciation: 'maai4 daan1', translation: 'L’addition', secondary: 'the bill', example: '', example_translation: '' },
          { word: '', pronunciation: '', translation: 'vide', secondary: '', example: '', example_translation: '' },
        ],
        updates: [
          { card_id: 3, word: null, pronunciation: null, translation: 'Merci (service)', secondary: null, example: null, example_translation: null },
          { card_id: 4, word: null, pronunciation: null, translation: null, secondary: null, example: null, example_translation: null },
        ],
      }),
    );
    expect(reply.message).toBe('Voici 1 carte.');
    expect(reply.newCards).toHaveLength(1);
    expect(reply.newCards[0].word).toBe('埋單');
    expect(reply.updates).toEqual([{ card_id: 3, changes: { translation: 'Merci (service)' } }]);
  });

  it('rejects text that is not JSON', () => {
    expect(() => parseReply('pas du json')).toThrow();
  });
});
