import { useEffect, useRef, useState } from 'react';
import { Avatar, BackButton, Field, TopBar } from '../components/common';
import { CameraIcon, ChevronIcon, KeyIcon, PaletteIcon } from '../components/Icons';
import { testConnection } from '../lib/ai';
import { downloadBlob, exportBackup, importBackup } from '../lib/backup';
import { AI_MODELS, setSetting, useSetting } from '../lib/settings';
import { THEMES, resolveTheme, themeById } from '../lib/theme';

/** Resizes the chosen picture so it stays small in the database. */
async function toAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  canvas.getContext('2d')!.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export default function Account() {
  const profile = useSetting('profile');
  const themeSettings = useSetting('theme');
  const ai = useSetting('ai');
  const photoInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(profile.name);
  const [key, setKey] = useState(ai.apiKey);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');

  // Settings load asynchronously: sync the local inputs once they arrive.
  useEffect(() => setName(profile.name), [profile.name]);
  useEffect(() => setKey(ai.apiKey), [ai.apiKey]);

  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const { theme: activeTheme, accent: activeAccent } = resolveTheme(themeSettings, systemDark);
  const accentTheme = themeSettings.followSystem ? activeTheme : themeById(themeSettings.id);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    await setSetting('profile', { photo: await toAvatarDataUrl(file) });
  }

  async function test() {
    setTesting(true);
    setStatus(null);
    await setSetting('ai', { apiKey: key.trim() });
    try {
      const model = await testConnection({ ...ai, apiKey: key.trim() });
      setStatus({ ok: true, text: `Connexion réussie : ${model} est disponible.` });
    } catch (err) {
      setStatus({ ok: false, text: (err as Error).message });
    } finally {
      setTesting(false);
    }
  }

  async function doExport() {
    const blob = await exportBackup();
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `ankiclaude-${date}.json`);
    setBackupMsg('Sauvegarde exportée (sans la clé API).');
  }

  async function doImport(file: File | undefined) {
    if (!file) return;
    if (!confirm('Importer cette sauvegarde remplacera tous les decks et cartes de cet appareil. Continuer ?')) return;
    try {
      const { decks, cards } = await importBackup(file);
      setBackupMsg(`Sauvegarde importée : ${decks} deck${decks > 1 ? 's' : ''}, ${cards} carte${cards > 1 ? 's' : ''}.`);
    } catch (err) {
      setBackupMsg((err as Error).message);
    }
  }

  return (
    <main className="screen tight-bottom">
      <TopBar back={<BackButton to="/" label="Retour aux decks" />} title="Mon compte" />

      <div className="stack" style={{ alignItems: 'center', gap: 10 }}>
        <div className="photo">
          <Avatar size={96} />
          <button type="button" className="camera" aria-label="Changer la photo de profil" onClick={() => photoInput.current?.click()}>
            <CameraIcon size={18} />
          </button>
          <input ref={photoInput} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
        </div>
        {profile.photo ? (
          <button type="button" className="text-btn" style={{ fontSize: 14 }} onClick={() => setSetting('profile', { photo: '' })}>
            Retirer la photo
          </button>
        ) : (
          <span className="muted" style={{ fontSize: 14 }}>
            Photo de profil
          </span>
        )}
      </div>

      <Field label="Nom" htmlFor="f-name">
        <input
          id="f-name"
          className="input"
          placeholder="Votre nom"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setSetting('profile', { name: name.trim() })}
        />
      </Field>

      <section className="card panel">
        <h2>
          <PaletteIcon size={18} /> Apparence
        </h2>
        <button
          type="button"
          className="toggle-row"
          aria-pressed={themeSettings.followSystem}
          onClick={() => setSetting('theme', { followSystem: !themeSettings.followSystem, accent: '' })}
        >
          <span className="stack" style={{ gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 500 }}>Suivre le thème du système</span>
            <span className="muted small">Clair le jour (Clair), sombre la nuit (Mocha)</span>
          </span>
          <span className="switch" />
        </button>

        {!themeSettings.followSystem && (
          <>
            <span className="field-label">Thème</span>
            <div className="themes">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="theme-tile"
                  aria-pressed={themeSettings.id === t.id}
                  aria-label={`Thème ${t.name}`}
                  onClick={() => setSetting('theme', { id: t.id, accent: '' })}
                >
                  <span className="theme-preview" style={{ background: t.colors.base, borderColor: t.colors.border }}>
                    <span className="line" style={{ background: t.colors.text }} />
                    <span className="box" style={{ background: t.colors.surface }}>
                      <span style={{ background: Object.values(t.accents)[0] }} />
                    </span>
                  </span>
                  {t.name}
                </button>
              ))}
            </div>
            <span className="muted small">Latte, Frappé, Macchiato et Mocha : palettes Catppuccin</span>
          </>
        )}

        <span className="field-label">Couleur d’accent</span>
        <div className="accents">
          {Object.entries(accentTheme.accents).map(([id, color]) => (
            <button
              key={id}
              type="button"
              className="accent-swatch"
              style={{ background: color }}
              aria-label={`Accent ${id}`}
              aria-pressed={color === activeAccent}
              onClick={() => setSetting('theme', { accent: id })}
            />
          ))}
        </div>
      </section>

      <section className="card panel">
        <h2>
          <KeyIcon size={18} /> Connexion IA
        </h2>
        <Field label="Fournisseur" htmlFor="f-provider">
          <select id="f-provider" className="input" value={ai.provider} disabled>
            <option value="anthropic">Claude (Anthropic)</option>
          </select>
        </Field>
        <Field label="Modèle" htmlFor="f-model">
          <select id="f-model" className="input" value={ai.model} onChange={(e) => setSetting('ai', { model: e.target.value })}>
            {AI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Clé d’accès (API)" htmlFor="f-key">
          <input
            id="f-key"
            className="input"
            type="password"
            autoComplete="off"
            placeholder="sk-ant-…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onBlur={() => setSetting('ai', { apiKey: key.trim() })}
          />
        </Field>
        <p className="muted small" style={{ margin: 0, lineHeight: 1.45 }}>
          La clé reste enregistrée uniquement sur ce téléphone. Créez-la sur console.anthropic.com (facturation à l’usage).
        </p>
        <button type="button" className="btn outline-accent" disabled={!key.trim() || testing} onClick={test}>
          {testing ? 'Test en cours…' : 'Tester la connexion'}
        </button>
        {status && <div className={`notice${status.ok ? '' : ' error'}`}>{status.text}</div>}
      </section>

      <section className="card list">
        <button type="button" className="list-row" onClick={doExport}>
          Exporter une sauvegarde <ChevronIcon size={18} />
        </button>
        <button type="button" className="list-row" onClick={() => backupInput.current?.click()}>
          Importer une sauvegarde <ChevronIcon size={18} />
        </button>
        <input ref={backupInput} type="file" accept="application/json,.json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
      </section>
      {backupMsg && <div className="notice">{backupMsg}</div>}
      <p className="muted small" style={{ margin: 0, textAlign: 'center' }}>
        Version {__APP_VERSION__}
      </p>
    </main>
  );
}
