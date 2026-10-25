import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Grade } from 'ts-fsrs';
import { CheckIcon, CloseIcon, SparkleIcon, SpeakerIcon } from '../components/Icons';
import { db, type Card, type Deck } from '../db';
import { languageLabel } from '../lib/languages';
import { newSeenToday } from '../lib/queries';
import { playWord, speak, stopSpeaking } from '../lib/speech';
import { buildQueue, formatInterval, grade, GRADES, preview, shuffle, Rating, srsOf, type QueueItem } from '../lib/srs';
import { wordClass } from './DeckPage';

/** Cards answered within this delay come back in the same session. */
const RELEARN_WINDOW_MS = 20 * 60 * 1000;

interface Session {
  decks: Map<number, Deck>;
  cards: Map<number, Card>;
  queue: QueueItem[];
}

async function loadSession(deckId: number | null): Promise<Session> {
  const decks = deckId === null ? await db.decks.toArray() : [await db.decks.get(deckId)].filter((d): d is Deck => !!d);
  const seen = await newSeenToday();
  const cards = new Map<number, Card>();
  const queue: QueueItem[] = [];
  for (const deck of decks) {
    const deckCards = await db.cards.where('deckId').equals(deck.id).toArray();
    deckCards.forEach((c) => cards.set(c.id, c));
    queue.push(...buildQueue(deck, deckCards, seen.get(deck.id) ?? 0));
  }
  // Mix decks together when reviewing everything.
  return { decks: new Map(decks.map((d) => [d.id, d])), cards, queue: decks.length > 1 ? shuffle(queue) : queue };
}

export default function Review() {
  const params = useParams();
  const deckId = params.id ? Number(params.id) : null;
  const navigate = useNavigate();
  const exitTo = deckId !== null ? `/deck/${deckId}` : '/';

  const [session, setSession] = useState<Session | null>(null);
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [counts, setCounts] = useState({ again: 0, hard: 0, good: 0 });
  const [forgotten, setForgotten] = useState<QueueItem[]>([]);
  const [firstPassSize, setFirstPassSize] = useState(0);

  useEffect(() => {
    loadSession(deckId).then((s) => {
      setSession(s);
      setFirstPassSize(s.queue.length);
    });
    return stopSpeaking;
  }, [deckId]);

  const item = session?.queue[position];
  const card = item ? session!.cards.get(item.cardId) : undefined;
  const deck = card ? session!.decks.get(card.deckId) : undefined;
  const intervals = useMemo(() => (card && item && revealed ? preview(card, item.direction) : null), [card, item, revealed]);

  if (!session) return null;

  async function answer(rating: Grade) {
    if (!session || !item || !card || !deck) return;
    const now = new Date();
    const before = srsOf(card, item.direction, now);
    const next = grade(card, item.direction, rating, now);
    const updated: Card = { ...card, srs: { ...card.srs, [item.direction]: next } };
    session.cards.set(card.id, updated);
    await db.transaction('rw', [db.cards, db.logs, db.decks], async () => {
      await db.cards.update(card.id, { srs: updated.srs });
      await db.logs.add({
        cardId: card.id,
        deckId: deck.id,
        direction: item.direction,
        rating,
        prevState: before.state,
        reviewedAt: now,
      });
      await db.decks.update(deck.id, { lastReviewedAt: now });
    });

    const queue = [...session.queue];
    if (next.due.getTime() - now.getTime() < RELEARN_WINDOW_MS) {
      // Put it back at a random place among the remaining cards.
      const at = position + 1 + Math.floor(Math.random() * (queue.length - position));
      queue.splice(at, 0, item);
    }
    setSession({ ...session, queue });
    setCounts((c) => ({
      again: c.again + (rating === Rating.Again ? 1 : 0),
      hard: c.hard + (rating === Rating.Hard ? 1 : 0),
      good: c.good + (rating === Rating.Good ? 1 : 0),
    }));
    if (rating === Rating.Again && !forgotten.some((f) => f.cardId === item.cardId && f.direction === item.direction)) {
      setForgotten((f) => [...f, item]);
    }
    stopSpeaking();
    setRevealed(false);
    setPosition((p) => p + 1);
  }

  function reviewForgotten() {
    if (!session) return;
    setSession({ ...session, queue: forgotten });
    setFirstPassSize(forgotten.length);
    setForgotten([]);
    setCounts({ again: 0, hard: 0, good: 0 });
    setPosition(0);
  }

  // ----- Nothing to review -----
  if (session.queue.length === 0) {
    return (
      <main className="review">
        <nav className="row">
          <Link to={exitTo} className="icon-btn edge-left" aria-label="Retour">
            <CloseIcon />
          </Link>
        </nav>
        <div className="empty grow" style={{ justifyContent: 'center' }}>
          <strong style={{ fontSize: 20 }}>Rien à réviser</strong>
          <span className="muted">Toutes les cartes sont à jour. Revenez plus tard ou ajoutez de nouvelles cartes.</span>
        </div>
        <button type="button" className="btn primary big" onClick={() => navigate(exitTo)}>
          Retour
        </button>
      </main>
    );
  }

  // ----- Session done -----
  if (!item || !card || !deck) {
    const total = counts.again + counts.hard + counts.good;
    const deckName = deckId !== null ? session.decks.get(deckId)?.name : 'Tous les decks';
    return (
      <main className="review" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 72px)', gap: 28 }}>
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 16 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckIcon size={40} />
          </div>
          <h1 className="page-title">Session terminée</h1>
          <p className="muted" style={{ margin: 0, fontSize: 15 }}>
            {deckName} · {total} réponse{total > 1 ? 's' : ''}
          </p>
        </div>
        <div className="card list">
          <div className="list-row">
            <span className="row" style={{ gap: 10 }}>
              <span className="dot" style={{ background: 'var(--accent)' }} />
              Je me souviens
            </span>
            <strong>{counts.good}</strong>
          </div>
          <div className="list-row">
            <span className="row" style={{ gap: 10 }}>
              <span className="dot" style={{ background: 'var(--hard)' }} />
              Difficilement
            </span>
            <strong>{counts.hard}</strong>
          </div>
          <div className="list-row">
            <span className="row" style={{ gap: 10 }}>
              <span className="dot" style={{ background: 'var(--again)' }} />
              Je ne me souviens plus
            </span>
            <strong>{counts.again}</strong>
          </div>
        </div>
        <div className="grow" />
        <div className="stack" style={{ gap: 10 }}>
          {forgotten.length > 0 && (
            <button type="button" className="btn big" onClick={reviewForgotten}>
              Revoir les {forgotten.length} carte{forgotten.length > 1 ? 's' : ''} oubliée{forgotten.length > 1 ? 's' : ''}
            </button>
          )}
          <button type="button" className="btn primary big" onClick={() => navigate(exitTo)}>
            {deckId !== null ? 'Retour au deck' : 'Retour aux decks'}
          </button>
        </div>
      </main>
    );
  }

  // ----- Card -----
  const forward = item.direction === 'forward';
  const promptLang = forward ? deck.targetLang : deck.nativeLang;
  const promptText = forward ? card.word : card.translation;
  const progress = Math.min(100, Math.round((Math.min(position, firstPassSize) / Math.max(1, firstPassSize)) * 100));
  const play = () => playWord(card.word, deck.targetLang, deck.voiceURI, card.audio);

  return (
    <main className="review">
      <nav className="row">
        <Link to={exitTo} className="icon-btn edge-left" aria-label="Quitter la révision">
          <CloseIcon />
        </Link>
        <div className="progress grow">
          <div style={{ width: `${progress}%` }} />
        </div>
        <span className="muted" style={{ fontSize: 14, fontWeight: 600 }}>
          {Math.min(position + 1, session.queue.length)} / {session.queue.length}
        </span>
        <Link
          to={`/ai?deck=${deck.id}&card=${card.id}`}
          className="icon-btn"
          aria-label="Assistant IA"
          style={{ background: 'var(--text)', color: 'var(--base)' }}
        >
          <SparkleIcon size={20} />
        </Link>
      </nav>

      {!revealed ? (
        <>
          <button type="button" className="review-card" onClick={() => setRevealed(true)}>
            <span className="eyebrow">{languageLabel(promptLang)}</span>
            <span className={`prompt-word ${wordClass(promptLang)}`}>{promptText}</span>
            {forward && card.pronunciation && deck.showPronunciationOnFront !== false && (
              <span className="muted" style={{ fontSize: 20 }}>
                {card.pronunciation}
              </span>
            )}
            <span className="muted" style={{ fontSize: 14 }}>
              Touchez la carte pour révéler
            </span>
          </button>
          {forward && (
            <div className="row" style={{ justifyContent: 'center' }}>
              <button type="button" className="round" style={{ width: 72, height: 72 }} aria-label="Écouter la prononciation" onClick={play}>
                <SpeakerIcon size={30} />
              </button>
            </div>
          )}
          <button type="button" className="btn ink big" onClick={() => setRevealed(true)}>
            Afficher la réponse
          </button>
        </>
      ) : (
        <>
          <div className="review-card">
            <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 14 }}>
              <span className={`answer-word ${wordClass(deck.targetLang)}`}>{card.word}</span>
              <button type="button" className="round" style={{ width: 48, height: 48 }} aria-label="Écouter la prononciation" onClick={play}>
                <SpeakerIcon size={22} />
              </button>
            </div>
            {card.pronunciation && <span style={{ fontSize: 17 }} className="muted">{card.pronunciation}</span>}
            <div className="divider" />
            <span className="eyebrow">{languageLabel(deck.nativeLang)}</span>
            <span className="translation">{card.translation}</span>
            {deck.secondaryLang && card.secondary && (
              <span className="muted" style={{ fontSize: 15 }}>
                <strong>{deck.secondaryLang.toUpperCase()}</strong> · {card.secondary}
              </span>
            )}
            {card.example && (
              <div className="example">
                <div className="stack grow" style={{ gap: 4 }}>
                  <span className={wordClass(deck.targetLang)} style={{ fontSize: 18 }}>
                    {card.example}
                  </span>
                  {card.exampleTranslation && (
                    <span className="muted" style={{ fontSize: 14, whiteSpace: 'pre-line' }}>
                      {card.exampleTranslation}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="round"
                  style={{ width: 44, height: 44, border: 0 }}
                  aria-label="Écouter l’exemple"
                  onClick={() => speak(card.example, deck.targetLang, deck.voiceURI)}
                >
                  <SpeakerIcon size={20} />
                </button>
              </div>
            )}
          </div>
          <div className="grades">
            {GRADES.map((g) => (
              <button key={g.rating} type="button" className={`grade ${g.tone}`} onClick={() => answer(g.rating)}>
                {g.label}
                {intervals && <small>{formatInterval(intervals[g.rating])}</small>}
              </button>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
