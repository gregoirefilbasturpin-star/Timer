# Timer

Minuteur d'intervalles (HIIT) hors-ligne, installable sur Android (PWA).

## Commandes

```bash
npm install        # dépendances
npm run dev        # serveur de développement
npm test           # tests du moteur et du modèle
npm run build      # vérification TypeScript + build dans dist/
npm run preview    # sert dist/ en local (service worker actif)
npm run icons      # régénère les icônes PNG dans public/icons/
```

## Déploiement Vercel

```bash
npx vercel login
npx vercel --prod
```

Vercel détecte Vite automatiquement (build `npm run build`, sortie `dist`).

## Architecture

| Dossier | Rôle |
|---|---|
| `src/model` | Types (étapes, blocs ≤ 3 niveaux), opérations sur l'arbre, aplatissement en étapes exécutables, validation des imports |
| `src/engine` | Moteur pur : horodatages absolus, événements (étape, décompte, fin), textes des annonces |
| `src/services` | Navigateur : IndexedDB (Dexie), sons WAV générés, synthèse vocale, Wake Lock, vibrations, sauvegarde, PWA |
| `src/store` | État Zustand : séance en cours (sauvegardée pour reprise), paramètres |
| `src/screens` | Accueil, éditeur, séance, paramètres |

`src/services/feedback.ts` est le seul point qui relie le moteur aux API audio/voix/vibration :
c'est lui qu'il faudrait remplacer pour passer à des modules natifs (Capacitor).

## Limites connues (PWA sur Chrome Android)

- Si l'app passe en arrière-plan ou si l'écran est verrouillé, les sons s'arrêtent ; le chrono se recale à l'heure réelle au retour.
- La baisse du volume de la musique pendant les bips et annonces dépend d'Android : non garantie.
- Les annonces hors-ligne nécessitent une voix française installée (Paramètres › Synthèse vocale › Moteur Google).
