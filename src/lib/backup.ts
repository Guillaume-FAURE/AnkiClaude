import { db, type Card, type Deck, type ReviewLog } from '../db';

const FORMAT = 'ankiclaude-backup';

interface StoredAudio {
  type: string;
  data: string;
}

async function blobToBase64(blob: Blob): Promise<StoredAudio> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { type: blob.type, data: btoa(binary) };
}

function base64ToBlob(a: StoredAudio): Blob {
  const binary = atob(a.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: a.type });
}

const DATE_KEYS = new Set(['due', 'last_review', 'createdAt', 'lastReviewedAt', 'reviewedAt']);

function reviveDates(_key: string, value: unknown) {
  return DATE_KEYS.has(_key) && typeof value === 'string' ? new Date(value) : value;
}

/** Everything except the API key, which stays on the device. */
export async function exportBackup(): Promise<Blob> {
  const [decks, cards, logs, settings] = await Promise.all([
    db.decks.toArray(),
    db.cards.toArray(),
    db.logs.toArray(),
    db.settings.toArray(),
  ]);
  const storedCards = await Promise.all(
    cards.map(async (c) => ({ ...c, audio: c.audio ? await blobToBase64(c.audio) : null })),
  );
  const storedSettings = settings.map((s) =>
    s.key === 'ai' ? { ...s, value: { ...(s.value as object), apiKey: '' } } : s,
  );
  const payload = { format: FORMAT, version: 1, exportedAt: new Date(), decks, cards: storedCards, logs, settings: storedSettings };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

/** Replaces all local data with the backup's content. */
export async function importBackup(file: Blob): Promise<{ decks: number; cards: number }> {
  const payload = JSON.parse(await file.text(), reviveDates);
  if (payload?.format !== FORMAT) throw new Error('Ce fichier n’est pas une sauvegarde AnkiClaude.');
  const decks = payload.decks as Deck[];
  const cards = (payload.cards as (Omit<Card, 'audio'> & { audio: StoredAudio | null })[]).map((c) => ({
    ...c,
    audio: c.audio ? base64ToBlob(c.audio) : null,
  }));
  const logs = payload.logs as ReviewLog[];
  const settings = (payload.settings ?? []) as { key: string; value: unknown }[];
  const currentAi = await db.settings.get('ai');
  await db.transaction('rw', [db.decks, db.cards, db.logs, db.settings], async () => {
    await Promise.all([db.decks.clear(), db.cards.clear(), db.logs.clear()]);
    await db.decks.bulkAdd(decks);
    await db.cards.bulkAdd(cards);
    await db.logs.bulkAdd(logs);
    for (const s of settings) {
      // Keep the key already on this device.
      if (s.key === 'ai' && currentAi) {
        await db.settings.put({ key: 'ai', value: { ...(s.value as object), apiKey: (currentAi.value as { apiKey: string }).apiKey } });
      } else {
        await db.settings.put(s);
      }
    }
  });
  return { decks: decks.length, cards: cards.length };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
