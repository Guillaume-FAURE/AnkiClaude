import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CloseIcon, MicIcon, SendIcon, SparkleIcon } from '../components/Icons';
import { db, emptyCard, type Card } from '../db';
import { askAssistant, cardFieldsFromDraft, type AssistantReply, type CardDraft, type ChatTurn } from '../lib/ai';
import { languageLabel } from '../lib/languages';
import { getSetting, useSetting } from '../lib/settings';
import { wordClass } from './DeckPage';

interface Entry {
  role: 'user' | 'assistant';
  text: string;
  reply?: AssistantReply;
  /** Checked proposals: `n<i>` for new cards, `u<i>` for updates. */
  selected?: Set<string>;
  /** Cards targeted by the updates, as they were when the reply arrived. */
  originals?: Map<number, Card>;
  applied?: string;
  error?: boolean;
}

const FIELD_LABELS: Record<keyof CardDraft, string> = {
  word: 'Mot',
  pronunciation: 'Prononciation',
  translation: 'Traduction',
  secondary: 'Traduction secondaire',
  example: 'Exemple',
  example_translation: 'Traduction de l’exemple',
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

function recognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}

export default function Assistant() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const decks = useLiveQuery(() => db.decks.toArray());
  const ai = useSetting('ai');
  const [deckId, setDeckId] = useState<number | null>(null);
  const cards = useLiveQuery(() => (deckId === null ? [] : db.cards.where('deckId').equals(deckId).toArray()), [deckId]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const logEnd = useRef<HTMLDivElement>(null);
  const focusCardId = Number(search.get('card')) || null;

  useEffect(() => {
    if (!decks || deckId !== null) return;
    const requested = Number(search.get('deck'));
    const initial = decks.find((d) => d.id === requested) ?? decks[decks.length - 1];
    if (initial) setDeckId(initial.id);
  }, [decks, deckId, search]);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, busy]);

  const deck = decks?.find((d) => d.id === deckId);
  const focusCard = cards?.find((c) => c.id === focusCardId);

  async function send(text: string) {
    const prompt = text.trim();
    if (!prompt || !deck || !cards || busy) return;
    const turns: ChatTurn[] = entries.filter((e) => !e.error).map((e) => ({ role: e.role, text: e.text }));
    setEntries((list) => [...list, { role: 'user', text: prompt }]);
    setInput('');
    setBusy(true);
    try {
      const reply = await askAssistant(await getSetting('ai'), deck, cards, turns, prompt);
      const selected = new Set([...reply.newCards.map((_, i) => `n${i}`), ...reply.updates.map((_, i) => `u${i}`)]);
      const originals = new Map(cards.filter((c) => reply.updates.some((u) => u.card_id === c.id)).map((c) => [c.id, c]));
      setEntries((list) => [...list, { role: 'assistant', text: reply.message || 'Voici mes propositions.', reply, selected, originals }]);
    } catch (err) {
      setEntries((list) => [...list, { role: 'assistant', text: (err as Error).message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  function toggle(index: number, key: string) {
    setEntries((list) =>
      list.map((e, i) => {
        if (i !== index || !e.selected) return e;
        const selected = new Set(e.selected);
        if (selected.has(key)) selected.delete(key);
        else selected.add(key);
        return { ...e, selected };
      }),
    );
  }

  async function apply(index: number) {
    const entry = entries[index];
    if (!entry.reply || !entry.selected || !deck) return;
    const toAdd = entry.reply.newCards.filter((_, i) => entry.selected!.has(`n${i}`));
    const toUpdate = entry.reply.updates.filter((u, i) => entry.selected!.has(`u${i}`) && entry.originals?.has(u.card_id));
    await db.transaction('rw', db.cards, async () => {
      await db.cards.bulkAdd(toAdd.map((d) => ({ ...emptyCard(deck.id), ...cardFieldsFromDraft(d) })));
      for (const u of toUpdate) await db.cards.update(u.card_id, cardFieldsFromDraft(u.changes));
    });
    const parts = [
      toAdd.length && `${toAdd.length} carte${toAdd.length > 1 ? 's' : ''} ajoutée${toAdd.length > 1 ? 's' : ''}`,
      toUpdate.length && `${toUpdate.length} carte${toUpdate.length > 1 ? 's' : ''} modifiée${toUpdate.length > 1 ? 's' : ''}`,
    ].filter(Boolean);
    setEntries((list) => list.map((e, i) => (i === index ? { ...e, applied: parts.join(' · ') || 'Rien n’a été appliqué' } : e)));
  }

  function toggleDictation() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'fr-FR';
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join(' ');
      setInput((v) => (v ? `${v} ${text}` : text));
    };
    rec.onend = () => setListening(false);
    recognition.current = rec;
    setListening(true);
    rec.start();
  }

  const suggestions = deck
    ? [
        focusCard ? `Vérifie et corrige la carte « ${focusCard.word} »` : null,
        'Ajoute 10 mots courants du quotidien',
        'Vérifie et corrige les traductions',
        'Ajoute un exemple aux cartes qui n’en ont pas',
        deck.secondaryLang ? `Ajoute la traduction en ${languageLabel(deck.secondaryLang).toLowerCase()} quand elle manque` : null,
      ].filter((s): s is string => !!s)
    : [];

  return (
    <div className="chat">
      <header className="chat-head">
        <div className="spread">
          <div className="row" style={{ gap: 10 }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                background: 'var(--text)',
                color: 'var(--base)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SparkleIcon size={18} />
            </span>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Assistant IA</h1>
          </div>
          <button type="button" className="icon-btn edge-right" aria-label="Fermer l’assistant" onClick={() => navigate(-1)}>
            <CloseIcon />
          </button>
        </div>
        {decks && decks.length > 0 && (
          <div>
            <label htmlFor="ai-deck" className="visually-hidden">
              Deck
            </label>
            <select
              id="ai-deck"
              className="input"
              style={{ minHeight: 40, fontSize: 14, width: 'auto', maxWidth: '100%' }}
              value={deckId ?? ''}
              onChange={(e) => {
                setDeckId(Number(e.target.value));
                setEntries([]);
              }}
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  Deck : {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      <div className="chat-log">
        {decks && decks.length === 0 && (
          <div className="notice">
            Créez d’abord un deck : l’assistant y ajoutera ses cartes. <Link to="/deck/new" style={{ fontWeight: 600, textDecoration: 'underline' }}>Créer un deck</Link>
          </div>
        )}
        {!ai.apiKey && (
          <div className="notice">
            Pour utiliser l’assistant, ajoutez votre clé API Anthropic dans <Link to="/account" style={{ fontWeight: 600, textDecoration: 'underline' }}>Mon compte</Link>.
          </div>
        )}
        {entries.length === 0 && deck && ai.apiKey && (
          <p className="muted" style={{ fontSize: 15, lineHeight: 1.5, margin: 0 }}>
            Demandez-moi d’ajouter des mots à « {deck.name} », de corriger des traductions ou d’ajouter des exemples. Je vous montre mes propositions avant de modifier quoi que ce soit.
          </p>
        )}
        {entries.map((e, i) =>
          e.role === 'user' ? (
            <div key={i} className="bubble-user">
              {e.text}
            </div>
          ) : (
            <div key={i} className="bubble-ai">
              <span style={e.error ? { color: 'var(--again)' } : undefined}>{e.text}</span>
              {e.reply && (e.reply.newCards.length > 0 || e.reply.updates.length > 0) && deck && (
                <>
                  <div className="card">
                    {e.reply.newCards.map((c, j) => (
                      <label key={`n${j}`} className="proposal">
                        <input type="checkbox" checked={e.selected?.has(`n${j}`)} disabled={!!e.applied} onChange={() => toggle(i, `n${j}`)} />
                        <span className="stack grow" style={{ gap: 2 }}>
                          <span className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                            <span className={wordClass(deck.targetLang)} style={{ fontSize: 18, fontWeight: 500 }}>
                              {c.word}
                            </span>
                            {c.pronunciation && <span className="muted small">{c.pronunciation}</span>}
                          </span>
                          <span style={{ fontSize: 14 }}>
                            {c.translation}
                            {c.secondary && <span className="muted"> · {c.secondary}</span>}
                          </span>
                          {c.example && (
                            <span className="muted small">
                              <span className={wordClass(deck.targetLang)}>{c.example}</span>
                              {c.example_translation && ` — ${c.example_translation}`}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                    {e.reply.updates.map((u, j) => {
                      const original = e.originals?.get(u.card_id);
                      return (
                        <label key={`u${j}`} className="proposal">
                          <input
                            type="checkbox"
                            checked={e.selected?.has(`u${j}`)}
                            disabled={!!e.applied || !original}
                            onChange={() => toggle(i, `u${j}`)}
                          />
                          <span className="stack grow" style={{ gap: 4 }}>
                            <span className={wordClass(deck.targetLang)} style={{ fontSize: 16, fontWeight: 600 }}>
                              Modifier « {original?.word ?? `#${u.card_id}`} »
                            </span>
                            {(Object.keys(u.changes) as (keyof CardDraft)[]).map((f) => (
                              <span key={f} className="small">
                                <span className="muted">{FIELD_LABELS[f]} : </span>
                                {original && <span className="old">{fieldOf(original, f) || '—'}</span>} → {u.changes[f] || '—'}
                              </span>
                            ))}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {e.applied ? (
                    <span className="small" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      ✓ {e.applied}
                    </span>
                  ) : (
                    <button type="button" className="btn primary" disabled={!e.selected?.size} onClick={() => apply(i)}>
                      Appliquer ({e.selected?.size ?? 0})
                    </button>
                  )}
                </>
              )}
            </div>
          ),
        )}
        {busy && <span className="typing">L’assistant réfléchit…</span>}
        <div ref={logEnd} />
      </div>

      {deck && ai.apiKey && entries.length === 0 && (
        <div className="chips">
          {suggestions.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <label htmlFor="ai-prompt" className="visually-hidden">
          Message à l’assistant
        </label>
        <textarea
          id="ai-prompt"
          rows={1}
          placeholder="Demandez à l’IA…"
          value={input}
          disabled={!deck || !ai.apiKey}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        {recognitionCtor() && (
          <button type="button" className="mic" aria-label="Dicter" aria-pressed={listening} onClick={toggleDictation}>
            <MicIcon size={20} />
          </button>
        )}
        <button type="submit" className="send" aria-label="Envoyer" disabled={!input.trim() || busy || !deck || !ai.apiKey}>
          <SendIcon size={20} />
        </button>
      </form>
    </div>
  );
}

function fieldOf(card: Card, field: keyof CardDraft): string {
  return field === 'example_translation' ? card.exampleTranslation : card[field];
}
