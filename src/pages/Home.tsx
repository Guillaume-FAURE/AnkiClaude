import { Link } from 'react-router-dom';
import { AiFab, Avatar } from '../components/common';
import { ChevronIcon, DeckIcon, PlusIcon } from '../components/Icons';
import { languageLabel } from '../lib/languages';
import { useDeckOverviews } from '../lib/queries';
import { useSetting } from '../lib/settings';

export default function Home() {
  const overviews = useDeckOverviews();
  const profile = useSetting('profile');
  const toReview = overviews?.reduce((n, o) => n + o.stats.due + o.stats.newToday, 0) ?? 0;

  return (
    <main className="screen">
      <header className="spread" style={{ paddingTop: 24 }}>
        <div className="stack" style={{ gap: 4 }}>
          <span className="muted" style={{ fontSize: 14 }}>
            {profile.name ? `Bonjour, ${profile.name}` : 'Bonjour'}
          </span>
          <h1 className="page-title">Mes decks</h1>
        </div>
        <Link to="/account" aria-label="Mon compte">
          <Avatar />
        </Link>
      </header>

      {overviews && overviews.length > 0 && (
        toReview > 0 ? (
          <Link to="/review" className="today">
            <div className="stack" style={{ gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.9 }}>Aujourd’hui</span>
              <span style={{ fontSize: 22, fontWeight: 700 }}>
                {toReview} carte{toReview > 1 ? 's' : ''} à revoir
              </span>
            </div>
            <span className="pill">
              Tout réviser <ChevronIcon size={16} />
            </span>
          </Link>
        ) : (
          <div className="notice">Tout est à jour pour aujourd’hui. Ajoutez des cartes ou revenez demain.</div>
        )
      )}

      {overviews && overviews.length === 0 && (
        <div className="card empty">
          <strong style={{ fontSize: 17 }}>Aucun deck pour l’instant</strong>
          <span className="muted">Créez votre premier deck, puis ajoutez des cartes à la main ou avec l’IA.</span>
          <Link to="/deck/new" className="btn primary">
            <DeckIcon size={18} /> Créer un deck
          </Link>
        </div>
      )}

      <div className="stack">
        {overviews?.map(({ deck, stats }) => {
          const pending = stats.due + stats.newToday;
          return (
            <Link key={deck.id} to={`/deck/${deck.id}`} className="card deck-tile">
              <div className="spread" style={{ alignItems: 'flex-start' }}>
                <div className="stack grow" style={{ gap: 2 }}>
                  <span className="name">{deck.name}</span>
                  <span className="muted" style={{ fontSize: 14 }}>
                    {languageLabel(deck.targetLang)} → {languageLabel(deck.nativeLang)}
                  </span>
                </div>
                <span className={`badge${pending ? '' : ' neutral'}`}>{pending ? `${pending} à revoir` : 'À jour'}</span>
              </div>
              <div className="progress">
                <div style={{ width: `${stats.mastery}%` }} />
              </div>
              <span className="muted small">
                {stats.total} carte{stats.total > 1 ? 's' : ''} · {stats.mastery} % maîtrisées
              </span>
            </Link>
          );
        })}
      </div>

      {overviews && overviews.length > 0 && (
        <div className="row">
          <Link to="/card/new" className="btn grow">
            <PlusIcon size={18} /> Ajouter des cartes
          </Link>
          <Link to="/deck/new" className="btn grow">
            <DeckIcon size={18} /> Nouveau deck
          </Link>
        </div>
      )}

      <AiFab />
    </main>
  );
}
