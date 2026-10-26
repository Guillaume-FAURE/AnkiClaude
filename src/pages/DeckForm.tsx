import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Field, TopBar } from '../components/common';
import { SparkleIcon, TrashIcon } from '../components/Icons';
import { db, type DirectionMode, type NewDeck } from '../db';
import { LANGUAGES, TRANSCRIPTIONS, language, languageLabel, transcriptionLabel } from '../lib/languages';
import { deleteDeck } from '../lib/queries';
import { useVoices, voicesFor } from '../lib/speech';

const DEFAULT_DECK: NewDeck = {
  name: '',
  description: '',
  targetLang: 'yue',
  nativeLang: 'fr',
  secondaryLang: 'en',
  transcription: 'jyutping',
  direction: 'forward',
  voiceURI: '',
  newPerDay: 20,
  createdAt: new Date(),
  lastReviewedAt: null,
};

function LanguageSelect({
  id,
  value,
  onChange,
  allowNone = false,
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
  allowNone?: boolean;
}) {
  const known = LANGUAGES.some((l) => l.code === value);
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {allowNone && <option value="">Aucune</option>}
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
      {!known && value && <option value={value}>{value}</option>}
    </select>
  );
}

export default function DeckForm() {
  const params = useParams();
  const editingId = params.id ? Number(params.id) : null;
  const navigate = useNavigate();
  const voices = useVoices();
  const [deck, setDeck] = useState<NewDeck>(DEFAULT_DECK);
  const [loaded, setLoaded] = useState(editingId === null);

  useEffect(() => {
    if (editingId === null) return;
    db.decks.get(editingId).then((d) => {
      if (d) {
        const { id: _id, ...rest } = d;
        setDeck(rest);
      }
      setLoaded(true);
    });
  }, [editingId]);

  const set = <K extends keyof NewDeck>(key: K, value: NewDeck[K]) => setDeck((d) => ({ ...d, [key]: value }));

  const setTarget = (code: string) =>
    setDeck((d) => ({ ...d, targetLang: code, transcription: language(code).transcription, voiceURI: '' }));

  const targetVoices = voicesFor(voices, deck.targetLang);
  const target = languageLabel(deck.targetLang);
  const native = languageLabel(deck.nativeLang);
  const canSave = deck.name.trim().length > 0 && deck.targetLang !== deck.nativeLang;

  async function save(thenAi = false) {
    const data = { ...deck, name: deck.name.trim(), description: deck.description.trim() };
    if (editingId !== null) {
      await db.decks.update(editingId, data);
      navigate(thenAi ? `/ai?deck=${editingId}` : `/deck/${editingId}`, { replace: true });
    } else {
      const id = await db.decks.add({ ...data, createdAt: new Date() });
      navigate(thenAi ? `/ai?deck=${id}` : `/deck/${id}`, { replace: true });
    }
  }

  async function remove() {
    if (editingId === null) return;
    if (!confirm(`Supprimer le deck « ${deck.name} » et toutes ses cartes ?`)) return;
    await deleteDeck(editingId);
    navigate('/', { replace: true });
  }

  if (!loaded) return null;

  const directions: { id: DirectionMode; label: string }[] = [
    { id: 'forward', label: `${target} → ${native}` },
    { id: 'reverse', label: `${native} → ${target}` },
    { id: 'both', label: 'Les deux' },
  ];

  return (
    <main className="screen tight-bottom">
      <TopBar
        back={
          <button type="button" className="text-btn" onClick={() => navigate(-1)}>
            Annuler
          </button>
        }
        title={editingId !== null ? 'Réglages du deck' : 'Nouveau deck'}
        right={
          <button type="button" className="text-btn strong" disabled={!canSave} onClick={() => save()}>
            {editingId !== null ? 'Enregistrer' : 'Créer'}
          </button>
        }
      />

      <Field label="Nom du deck" htmlFor="d-name">
        <input
          id="d-name"
          className="input"
          placeholder="Ex. : Bases du quotidien"
          value={deck.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </Field>
      <Field label="Description (facultatif)" htmlFor="d-desc">
        <input
          id="d-desc"
          className="input"
          placeholder="Ex. : salutations et politesse"
          value={deck.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </Field>

      <section className="card panel">
        <h2>Langues</h2>
        <Field label="Langue étudiée" htmlFor="d-target">
          <LanguageSelect id="d-target" value={deck.targetLang} onChange={setTarget} />
        </Field>
        <Field label="Langue de traduction" htmlFor="d-native">
          <LanguageSelect id="d-native" value={deck.nativeLang} onChange={(v) => set('nativeLang', v)} />
        </Field>
        <Field label="Traduction secondaire (facultatif)" htmlFor="d-second">
          <LanguageSelect id="d-second" value={deck.secondaryLang} onChange={(v) => set('secondaryLang', v)} allowNone />
        </Field>
        {deck.targetLang === deck.nativeLang && (
          <span className="small" style={{ color: 'var(--danger)' }}>
            Choisissez deux langues différentes.
          </span>
        )}
      </section>

      <section className="card panel">
        <h2>Prononciation et audio</h2>
        <Field label="Transcription" htmlFor="d-roman">
          <select id="d-roman" className="input" value={deck.transcription} onChange={(e) => set('transcription', e.target.value)}>
            {TRANSCRIPTIONS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Voix de lecture" htmlFor="d-voice">
          <select id="d-voice" className="input" value={deck.voiceURI} onChange={(e) => set('voiceURI', e.target.value)}>
            <option value="">{targetVoices.length ? 'Automatique' : 'Aucune voix trouvée sur cet appareil'}</option>
            {targetVoices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </Field>
        {targetVoices.length === 0 && (
          <span className="muted small" style={{ lineHeight: 1.45 }}>
            Installez une voix « {target} » dans les réglages Android : Synthèse vocale → Moteur Google → Installer des données vocales.
          </span>
        )}
      </section>

      <section className="card panel">
        <h2>Révision</h2>
        <div className="stack" style={{ gap: 8 }}>
          <span className="field-label">Sens de révision</span>
          <div className="segmented" role="group" aria-label="Sens de révision">
            {directions.map((d) => (
              <button key={d.id} type="button" aria-pressed={deck.direction === d.id} onClick={() => set('direction', d.id)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        {deck.transcription !== 'none' && deck.direction !== 'reverse' && (
          <button
            type="button"
            className="toggle-row"
            aria-pressed={deck.showPronunciationOnFront !== false}
            onClick={() => set('showPronunciationOnFront', deck.showPronunciationOnFront === false)}
          >
            <span className="stack" style={{ gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 500 }}>
                Afficher le {transcriptionLabel(deck.transcription)} sur la question
              </span>
              <span className="muted small">Sous le mot en {target.toLowerCase()}, avant de révéler la réponse</span>
            </span>
            <span className="switch" />
          </button>
        )}
        {deck.direction !== 'reverse' && (
          <button
            type="button"
            className="toggle-row"
            aria-pressed={deck.showExampleOnFront !== false}
            onClick={() => set('showExampleOnFront', deck.showExampleOnFront === false)}
          >
            <span className="stack" style={{ gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 500 }}>Afficher la phrase d’exemple sur la question</span>
              <span className="muted small">Pour réviser le mot dans son contexte, avant de révéler la traduction</span>
            </span>
            <span className="switch" />
          </button>
        )}
        <Field label="Nouvelles cartes par jour" htmlFor="d-new">
          <input
            id="d-new"
            className="input"
            type="number"
            inputMode="numeric"
            min={0}
            max={500}
            value={deck.newPerDay}
            onChange={(e) => set('newPerDay', Math.max(0, Number(e.target.value) || 0))}
          />
        </Field>
      </section>

      {editingId === null && (
        <button type="button" className="btn soft block" disabled={!canSave} onClick={() => save(true)}>
          <SparkleIcon size={18} /> Créer et remplir le deck avec l’IA
        </button>
      )}
      {editingId !== null && (
        <button type="button" className="btn danger block" onClick={remove}>
          <TrashIcon size={18} /> Supprimer le deck
        </button>
      )}
    </main>
  );
}
