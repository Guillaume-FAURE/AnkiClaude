import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AiFab, BackButton, TopBar } from '../components/common';
import { DotsIcon, SearchIcon } from '../components/Icons';
import { languageLabel, transcriptionLabel } from '../lib/languages';
import { useDeckOverview } from '../lib/queries';
import { directionsOf, scheduleSummary } from '../lib/srs';

const CJK = new Set(['yue', 'zh', 'ja', 'ko']);

export function wordClass(lang: string) {
  return CJK.has(lang) ? 'cjk' : '';
}

function relativeDay(date: Date | null): string {
  if (!date) return 'Jamais';
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return 'Aujourd’hui';
  if (days === 1) return 'Hier';
  return `Il y a ${days} jours`;
}

export default function DeckPage() {
  const deckId = Number(useParams().id);
  const overview = useDeckOverview(deckId);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  if (overview === null) {
    return (
      <main className="screen">
        <TopBar back={<BackButton to="/" />} />
        <p className="muted">Ce deck n’existe plus.</p>
      </main>
    );
  }
  if (!overview) return null;

  const { deck, cards, stats } = overview;
  const pending = stats.due + stats.newToday;
  const dirs = directionsOf(deck).length;
  const q = query.trim().toLowerCase();
  const shown = [...cards]
    .reverse()
    .filter(
      (c) =>
        !q ||
        [c.word, c.pronunciation, c.translation, c.secondary].some((f) => f.toLowerCase().includes(q)),
    );

  return (
    <main className="screen with-footer">
      <TopBar
        back={<BackButton to="/" label="Retour aux decks" />}
        right={
          <Link to={`/deck/${deck.id}/edit`} className="icon-btn edge-right" aria-label="Réglages du deck">
            <DotsIcon />
          </Link>
        }
      />
      <header className="stack" style={{ gap: 6 }}>
        <h1 className="page-title">{deck.name}</h1>
        {deck.description && (
          <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
            {deck.description}
          </p>
        )}
      </header>

      <div className="stats">
        <div className="card">
          <strong style={{ color: 'var(--accent)' }}>{stats.due}</strong>
          <span className="muted small">À revoir</span>
        </div>
        <div className="card">
          <strong>{stats.fresh}</strong>
          <span className="muted small">Nouvelles</span>
        </div>
        <div className="card">
          <strong>{stats.total}</strong>
          <span className="muted small">Cartes</span>
        </div>
      </div>

      <div className="card list">
        <div className="list-row">
          <span className="muted">Langues</span>
          <span className="value">
            {languageLabel(deck.targetLang)} → {languageLabel(deck.nativeLang)}
          </span>
        </div>
        {deck.secondaryLang && (
          <div className="list-row">
            <span className="muted">Traduction secondaire</span>
            <span className="value">{languageLabel(deck.secondaryLang)}</span>
          </div>
        )}
        {deck.transcription !== 'none' && (
          <div className="list-row">
            <span className="muted">Prononciation</span>
            <span className="value">{transcriptionLabel(deck.transcription)}</span>
          </div>
        )}
        <div className="list-row">
          <span className="muted">Maîtrise</span>
          <span className="value">{stats.mastery} %</span>
        </div>
        <div className="list-row">
          <span className="muted">Dernière révision</span>
          <span className="value">{relativeDay(deck.lastReviewedAt)}</span>
        </div>
      </div>

      <section className="stack" style={{ gap: 4 }}>
        <div className="spread">
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Cartes</h2>
          <Link to={`/card/new?deck=${deck.id}`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)', padding: '12px 0' }}>
            + Ajouter
          </Link>
        </div>
        {cards.length > 6 && (
          <div className="row" style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, color: 'var(--sub)', display: 'flex' }}>
              <SearchIcon size={18} />
            </span>
            <label htmlFor="card-search" className="visually-hidden">
              Rechercher une carte
            </label>
            <input
              id="card-search"
              className="input"
              style={{ paddingLeft: 40 }}
              placeholder="Rechercher"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}
        {cards.length === 0 && (
          <p className="muted" style={{ fontSize: 15 }}>
            Ce deck est vide. Ajoutez des cartes ou demandez à l’assistant IA de le remplir.
          </p>
        )}
        {shown.map((c) => (
          <Link key={c.id} to={`/card/${c.id}`} className="word-row" style={{ flexWrap: 'wrap', rowGap: 4 }}>
            <span className="row grow" style={{ gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span className={`word ${wordClass(deck.targetLang)}`}>{c.word}</span>
              {c.pronunciation && <span className="muted small">{c.pronunciation}</span>}
            </span>
            <span style={{ fontSize: 15, textAlign: 'right' }}>{c.translation}</span>
            <span className="muted small" style={{ flexBasis: '100%' }}>
              {directionsOf(deck)
                .map((d) => (dirs > 1 ? `${d === 'forward' ? '→' : '←'} ` : '') + scheduleSummary(c, d))
                .join('   ')}
            </span>
          </Link>
        ))}
      </section>

      <div className="footer-bar">
        <button
          type="button"
          className="btn primary big block"
          disabled={pending === 0}
          onClick={() => navigate(`/deck/${deck.id}/review`)}
        >
          {pending ? `Réviser · ${pending} carte${pending > 1 ? 's' : ''}` : 'Rien à réviser pour l’instant'}
        </button>
      </div>
      <AiFab deckId={deck.id} raised />
    </main>
  );
}
