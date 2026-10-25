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

## Modèle de données (prévu)

- **Deck** : nom, langue étudiée, langue de traduction, langue secondaire (facultatif), transcription (Jyutping, Pinyin, Rōmaji, API, aucune), voix, sens de révision
- **Carte** : mot, prononciation (facultatif), traduction, traduction secondaire (facultatif), exemple (facultatif), audio (facultatif), état de répétition espacée
- **Profil** : nom, photo, thème, accent, fournisseur IA et clé

## Prochaines étapes

1. Application web installable (PWA) : stockage local (IndexedDB), hors ligne, thèmes
2. Révision avec FSRS
3. Assistant IA (API Anthropic)
4. Audio (synthèse vocale + enregistrement)
5. Déploiement sur GitHub Pages
