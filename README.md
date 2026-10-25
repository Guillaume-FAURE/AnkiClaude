# AnkiClaude

Application de cartes mémoire (type Anki) boostée par l'IA, pensée d'abord pour le téléphone.

L'application n'est liée à aucune langue : chaque deck définit sa langue étudiée, sa langue de traduction, une traduction secondaire facultative et un système de prononciation. Le premier usage visé est l'apprentissage du cantonais depuis le français.

## Fonctionnalités prévues

- Decks multi-langues, révision par répétition espacée (FSRS)
- Révision en 3 niveaux : « Je ne me souviens plus », « Je me souviens difficilement », « Je me souviens »
- Audio : voix de synthèse du téléphone par langue, ou enregistrement de sa propre voix
- Assistant IA accessible partout : ajouter des mots, corriger des traductions, générer des exemples
- Connexion à l'IA par clé API (Claude / Anthropic), stockée uniquement sur l'appareil
- Données stockées en local, avec export / import de sauvegarde
- 6 thèmes (Clair, Sombre et les palettes [Catppuccin](https://github.com/catppuccin/catppuccin) Latte, Frappé, Macchiato, Mocha) et une couleur d'accent au choix

## Essayer l'application

Version en ligne : https://guillaume-faure.github.io/AnkiClaude/

Sur Android, ouvrez le lien dans Chrome puis menu ⋮ → « Installer l'application » (ou « Ajouter à l'écran d'accueil »). L'application fonctionne ensuite hors ligne ; seules les requêtes à l'IA demandent une connexion.

Pour l'assistant IA, créez une clé API sur [console.anthropic.com](https://console.anthropic.com) et collez-la dans « Mon compte ». La clé reste sur l'appareil et n'est jamais incluse dans les sauvegardes.

Pour la voix en cantonais : Réglages Android → Synthèse vocale → Moteur Google → installer la voix « Chinois (Hong Kong) ».

## Développement

```bash
npm install
npm run dev        # serveur local
npm test           # tests unitaires (Vitest)
npm run build      # typecheck + build de la PWA dans dist/
```

Stack : React, Vite, TypeScript, Dexie (IndexedDB), ts-fsrs, SDK Anthropic, vite-plugin-pwa.
Chaque push sur `main` ou sur la branche de travail est testé, construit et publié sur la branche `gh-pages` par [GitHub Actions](.github/workflows/deploy.yml).

## Design

Maquettes interactives (Claude Design) : https://claude.ai/artifact/KwduyvUVbsWnsZ1MQDz5BL

Les sources sont dans [`design/`](design/) :

| Écran | Fichier | Rôle |
| --- | --- | --- |
| 1 · Mes decks | [`Main.dc.html`](design/screens/Main.dc.html) | Accueil : cartes à revoir aujourd'hui, liste des decks, ajout de cartes / de decks |
| 2 · Détail du deck | [`Deck.dc.html`](design/screens/Deck.dc.html) | Statistiques, langues, aperçu des cartes, bouton « Réviser » |
| 3 · Révision — question | [`ReviewFront.dc.html`](design/screens/ReviewFront.dc.html) | Mot à deviner, bouton audio, toucher pour révéler |
| 4 · Révision — réponse | [`ReviewBack.dc.html`](design/screens/ReviewBack.dc.html) | Prononciation, traduction(s), exemple, 3 boutons de notation |
| 5 · Fin de session | [`SessionDone.dc.html`](design/screens/SessionDone.dc.html) | Bilan de la session et prochaine révision |
| 6 · Assistant IA | [`AI.dc.html`](design/screens/AI.dc.html) | Chat qui propose des cartes à valider |
| 7 · Ajouter / modifier une carte | [`AddCard.dc.html`](design/screens/AddCard.dc.html) | Saisie manuelle, audio, complétion par l'IA |
| 8 · Compte | [`Account.dc.html`](design/screens/Account.dc.html) | Nom, photo, thème, accent, clé API, sauvegarde |
| 9 · Nouveau deck | [`NewDeck.dc.html`](design/screens/NewDeck.dc.html) | Langues, prononciation, voix, sens de révision |

- [`design/canvas.json`](design/canvas.json) : disposition des écrans sur le canevas
- [`design/themes.json`](design/themes.json) : couleurs des thèmes et accents, à réutiliser dans l'application

Les fichiers `.dc.html` sont au format Claude Design : ils s'affichent dans le canevas ci-dessus, pas directement dans un navigateur.

## Modèle de données

- **Deck** : nom, langue étudiée, langue de traduction, langue secondaire (facultatif), transcription (Jyutping, Pinyin, Rōmaji, API, aucune), voix, sens de révision
- **Carte** : mot, prononciation (facultatif), traduction, traduction secondaire (facultatif), exemple (facultatif), audio (facultatif), état de répétition espacée
- **Profil** : nom, photo, thème, accent, fournisseur IA et clé

## État

- [x] PWA installable, hors ligne, données locales (IndexedDB) et thèmes
- [x] Révision avec FSRS (sens aller, retour ou les deux ; nouvelles cartes par jour)
- [x] Assistant IA : ajout de mots, corrections, exemples, avec validation avant application
- [x] Audio : voix de synthèse par langue et enregistrement de sa voix
- [x] Sauvegarde / restauration JSON
- [ ] Statistiques et historique
- [ ] Génération audio de meilleure qualité (TTS en ligne)
