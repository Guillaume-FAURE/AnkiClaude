import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Field, TopBar } from '../components/common';
import { RecordIcon, SparkleIcon, SpeakerIcon, StopIcon, TrashIcon } from '../components/Icons';
import { db, emptyCard, type NewCard } from '../db';
import { cardFieldsFromDraft, completeCard, draftFromCard } from '../lib/ai';
import { languageLabel, transcriptionLabel } from '../lib/languages';
import { getSetting } from '../lib/settings';
import { playWord, speak } from '../lib/speech';
import { directionsOf, formatDueDate, GRADES, scheduleSummary, stateLabel } from '../lib/srs';
import { wordClass } from './DeckPage';

function useRecorder(onDone: (blob: Blob) => void) {
  const recorder = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');

  async function start() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        onDone(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
        setRecording(false);
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      setError('Micro inaccessible. Autorisez-le dans les réglages du navigateur.');
    }
  }

  function stop() {
    recorder.current?.stop();
    recorder.current = null;
  }

  return { recording, error, start, stop };
}

export default function CardForm() {
  const params = useParams();
  const [search] = useSearchParams();
  const editingId = params.id ? Number(params.id) : null;
  const navigate = useNavigate();
  const decks = useLiveQuery(() => db.decks.toArray());
  const history = useLiveQuery(
    () => (editingId === null ? [] : db.logs.where('cardId').equals(editingId).reverse().sortBy('reviewedAt')),
    [editingId],
  );
  const [card, setCard] = useState<NewCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const recorder = useRecorder((blob) => setCard((c) => (c ? { ...c, audio: blob } : c)));

  useEffect(() => {
    if (!decks) return;
    if (editingId !== null) {
      db.cards.get(editingId).then((c) => {
        if (c) {
          const { id: _id, ...rest } = c;
          setCard(rest);
        }
      });
    } else if (!card) {
      const requested = Number(search.get('deck'));
      const deckId = decks.some((d) => d.id === requested) ? requested : decks[decks.length - 1]?.id;
      if (deckId !== undefined) setCard(emptyCard(deckId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decks, editingId]);

  if (decks && decks.length === 0) {
    return (
      <main className="screen">
        <TopBar back={<button type="button" className="text-btn" onClick={() => navigate(-1)}>Annuler</button>} title="Nouvelle carte" />
        <div className="card empty">
          <span className="muted">Créez d’abord un deck pour y ranger vos cartes.</span>
          <Link to="/deck/new" className="btn primary">Créer un deck</Link>
        </div>
      </main>
    );
  }
  if (!card || !decks) return null;

  const deck = decks.find((d) => d.id === card.deckId)!;
  const set = <K extends keyof NewCard>(key: K, value: NewCard[K]) => setCard((c) => (c ? { ...c, [key]: value } : c));
  const canSave = card.word.trim() !== '' && card.translation.trim() !== '';
  const target = languageLabel(deck.targetLang);

  async function save(another: boolean) {
    if (!card) return;
    const data = {
      ...card,
      word: card.word.trim(),
      pronunciation: card.pronunciation.trim(),
      translation: card.translation.trim(),
      secondary: card.secondary.trim(),
      example: card.example.trim(),
      exampleTranslation: card.exampleTranslation.trim(),
    };
    if (editingId !== null) {
      await db.cards.update(editingId, data);
      navigate(-1);
    } else {
      await db.cards.add({ ...data, createdAt: new Date() });
      if (another) setCard(emptyCard(card.deckId));
      else navigate(`/deck/${card.deckId}`, { replace: true });
    }
  }

  async function remove() {
    if (editingId === null || !confirm('Supprimer cette carte ?')) return;
    await db.transaction('rw', [db.cards, db.logs], async () => {
      await db.logs.where('cardId').equals(editingId).delete();
      await db.cards.delete(editingId);
    });
    navigate(-1);
  }

  async function aiComplete() {
    if (!card) return;
    setBusy(true);
    setAiError('');
    try {
      const filled = await completeCard(await getSetting('ai'), deck, draftFromCard({ ...card, id: 0 }));
      setCard((c) => (c ? { ...c, ...cardFieldsFromDraft(filled) } : c));
    } catch (err) {
      setAiError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen tight-bottom">
      <TopBar
        back={
          <button type="button" className="text-btn" onClick={() => navigate(-1)}>
            Annuler
          </button>
        }
        title={editingId !== null ? 'Modifier la carte' : 'Nouvelle carte'}
        right={
          <button type="button" className="text-btn strong" disabled={!canSave} onClick={() => save(false)}>
            Enregistrer
          </button>
        }
      />

      <Field label="Deck" htmlFor="f-deck">
        <select id="f-deck" className="input" value={card.deckId} onChange={(e) => set('deckId', Number(e.target.value))}>
          {decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`Mot · ${target}`} htmlFor="f-word">
        <input
          id="f-word"
          className={`input big ${wordClass(deck.targetLang)}`}
          value={card.word}
          lang={deck.targetLang}
          onChange={(e) => set('word', e.target.value)}
        />
      </Field>
      {deck.transcription !== 'none' && (
        <Field label={`Prononciation · ${transcriptionLabel(deck.transcription)} (facultatif)`} htmlFor="f-pron">
          <input id="f-pron" className="input" value={card.pronunciation} onChange={(e) => set('pronunciation', e.target.value)} />
        </Field>
      )}
      <Field label={`Traduction · ${languageLabel(deck.nativeLang)}`} htmlFor="f-tr">
        <input id="f-tr" className="input" value={card.translation} onChange={(e) => set('translation', e.target.value)} />
      </Field>
      {deck.secondaryLang && (
        <Field label={`Traduction secondaire · ${languageLabel(deck.secondaryLang)} (facultatif)`} htmlFor="f-sec">
          <input id="f-sec" className="input" value={card.secondary} onChange={(e) => set('secondary', e.target.value)} />
        </Field>
      )}
      <Field label="Exemple (facultatif)" htmlFor="f-ex">
        <textarea
          id="f-ex"
          className={`input ${wordClass(deck.targetLang)}`}
          rows={2}
          placeholder="Une phrase d’exemple…"
          value={card.example}
          onChange={(e) => set('example', e.target.value)}
        />
      </Field>
      {card.example && (
        <Field label="Traduction de l’exemple (facultatif)" htmlFor="f-ext">
          <textarea
            id="f-ext"
            className="input"
            rows={2}
            value={card.exampleTranslation}
            onChange={(e) => set('exampleTranslation', e.target.value)}
          />
        </Field>
      )}

      <div className="stack" style={{ gap: 8 }}>
        <span className="field-label">Audio</span>
        <div className="row">
          <button
            type="button"
            className="btn grow"
            disabled={!card.word}
            onClick={() => (card.audio ? playWord(card.word, deck.targetLang, deck.voiceURI, card.audio) : speak(card.word, deck.targetLang, deck.voiceURI))}
          >
            <SpeakerIcon size={18} /> {card.audio ? 'Écouter mon enregistrement' : 'Voix de synthèse'}
          </button>
          {recorder.recording ? (
            <button type="button" className="btn grow danger" onClick={recorder.stop}>
              <StopIcon size={18} /> Arrêter
            </button>
          ) : (
            <button type="button" className="btn grow" onClick={recorder.start}>
              <RecordIcon size={18} /> {card.audio ? 'Réenregistrer ma voix' : 'Enregistrer ma voix'}
            </button>
          )}
        </div>
        {card.audio && (
          <button type="button" className="text-btn" style={{ alignSelf: 'flex-start', fontSize: 14 }} onClick={() => set('audio', null)}>
            Supprimer l’enregistrement (revenir à la voix de synthèse)
          </button>
        )}
        {recorder.error && <div className="notice error">{recorder.error}</div>}
      </div>

      <button type="button" className="btn soft block" disabled={busy || !card.word} onClick={aiComplete}>
        <SparkleIcon size={18} /> {busy ? 'L’IA complète la carte…' : 'Compléter avec l’IA'}
      </button>
      {aiError && <div className="notice error">{aiError}</div>}

      {editingId !== null && (
        <section className="card panel">
          <h2>Révision</h2>
          {directionsOf(deck).map((d) => {
            const srs = card.srs[d];
            const label =
              d === 'forward'
                ? `${languageLabel(deck.targetLang)} → ${languageLabel(deck.nativeLang)}`
                : `${languageLabel(deck.nativeLang)} → ${languageLabel(deck.targetLang)}`;
            return (
              <div key={d} className="stack" style={{ gap: 4 }}>
                <span className="field-label">{label}</span>
                <span style={{ fontSize: 15, fontWeight: 600 }}>Prochaine révision : {scheduleSummary({ ...card, id: 0 }, d)}</span>
                {srs && srs.reps > 0 && (
                  <span className="muted small">
                    {stateLabel(srs.state)} · intervalle {srs.scheduled_days} j · {srs.reps} révision{srs.reps > 1 ? 's' : ''} ·{' '}
                    {srs.lapses} oubli{srs.lapses > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            );
          })}
          {history && history.length > 0 && (
            <div className="stack" style={{ gap: 6 }}>
              <span className="field-label">Historique</span>
              {history.slice(0, 15).map((log) => (
                <span key={log.id} className="small spread">
                  <span className="muted">
                    {formatDueDate(log.reviewedAt)}
                    {directionsOf(deck).length > 1 ? (log.direction === 'forward' ? ' · →' : ' · ←') : ''}
                  </span>
                  <span>{GRADES.find((g) => g.rating === log.rating)?.label ?? log.rating}</span>
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {editingId === null ? (
        <button type="button" className="btn block" disabled={!canSave} onClick={() => save(true)}>
          Enregistrer et ajouter une autre carte
        </button>
      ) : (
        <button type="button" className="btn danger block" onClick={remove}>
          <TrashIcon size={18} /> Supprimer la carte
        </button>
      )}
    </main>
  );
}
