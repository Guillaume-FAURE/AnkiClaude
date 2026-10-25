import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BackIcon, SparkleIcon } from './Icons';
import { useSetting } from '../lib/settings';

/** Floating button that opens the AI assistant, optionally on a given deck. */
export function AiFab({ deckId, raised = false }: { deckId?: number; raised?: boolean }) {
  return (
    <Link
      to={deckId ? `/ai?deck=${deckId}` : '/ai'}
      className={`fab${raised ? ' fab-raised' : ''}`}
      aria-label="Assistant IA"
    >
      <SparkleIcon size={26} />
    </Link>
  );
}

export function BackButton({ to, label = 'Retour' }: { to?: string; label?: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" className="icon-btn edge-left" aria-label={label} onClick={() => (to ? navigate(to) : navigate(-1))}>
      <BackIcon size={24} />
    </button>
  );
}

export function TopBar({ back, title, right }: { back?: ReactNode; title?: ReactNode; right?: ReactNode }) {
  return (
    <nav className="topbar">
      <div className="topbar-side">{back}</div>
      {title ? <h1 className="topbar-title">{title}</h1> : <span />}
      <div className="topbar-side right">{right}</div>
    </nav>
  );
}

export function Avatar({ size = 44 }: { size?: number }) {
  const profile = useSetting('profile');
  const initial = (profile.name.trim()[0] ?? '?').toUpperCase();
  return profile.photo ? (
    <img className="avatar" src={profile.photo} alt="" style={{ width: size, height: size }} />
  ) : (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initial}
    </span>
  );
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}
