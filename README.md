# MuscuTrack

Application web mobile (PWA) de suivi de musculation : créez vos séances types, lancez-les pendant l’entraînement et suivez votre progression. Interface en français, fonctionne hors ligne, sans compte ni serveur.

## Fonctionnalités

- **Séances types** : création, modification, duplication, réordonnancement des exercices, objectifs séries × reps × poids et temps de repos.
- **Bibliothèque d’exercices** (~30 exercices courants) + exercices personnalisés.
- **Séance en cours** : valeurs de la dernière fois pré-remplies, validation d’une série en un tap, minuteur de repos, chrono, reprise automatique si l’app est fermée.
- **Historique** des séances avec détail, suppression et mise à jour de la séance type.
- **Progrès** : courbes par exercice (poids max, 1RM estimé, volume), records personnels, statistiques de la semaine et du mois.
- **Réglages** : export / import JSON, gestion des exercices personnalisés, réinitialisation.

## Utilisation en local

Prérequis : Node.js 22.12 ou plus récent (24 recommandé).

```bash
npm ci          # installe les dépendances
npm run dev     # lance le serveur de développement (http://localhost:5173)
```

Pour tester sur votre téléphone (connecté au **même Wi-Fi** que l’ordinateur) :

```bash
npm run dev -- --host
```

Ouvrez ensuite sur le téléphone l’adresse « Network » affichée dans le terminal (par exemple `http://192.168.1.20:5173`).

## Build et tests

```bash
npm run build      # vérifie les types puis génère le site statique dans dist/
npm run preview    # sert dist/ en local pour vérification
npm test           # lance les tests (Vitest)
npm run e2e        # build, puis test de bout en bout Playwright (première séance en 5 taps, clair et sombre)
npm run typecheck  # vérification TypeScript seule
npm run build:native  # app iOS : build sans service worker (--mode native), puis cap sync ios
```

L’app iPhone (Capacitor, dossier `ios/`) part du même code : voir `docs/product/lot4-app-store.md`. Compiler et signer le projet Xcode demande un Mac ou une CI macOS.

`npm run e2e` sert le build avec `vite preview` sur un port libre (jamais 5199), joue le parcours de `e2e/premiere-seance.spec.ts` à 390 × 844, puis arrête le serveur. Il faut Chromium pour Playwright : `npx playwright install chromium` la première fois.

Pour régénérer les icônes PWA (`public/`) : `node scripts/generate-icons.mjs` (nécessite `npx playwright install chromium`).

## Déploiement sur GitHub Pages

L’application est 100 % statique (routes en `#/…`, chemins relatifs) : elle fonctionne dans un sous-dossier comme `https://<utilisateur>.github.io/<depot>/`.

**Option 1 — GitHub Action (recommandée)**

1. Poussez le dépôt sur GitHub.
2. Dans *Settings → Pages*, choisissez la source **GitHub Actions**.
3. Chaque push sur `main` lance `.github/workflows/deploy.yml` : installation, tests, build, puis publication de `dist/`. Un lancement manuel est possible depuis l’onglet *Actions*.

**Option 2 — Manuelle**

1. `npm run build`
2. Publiez le contenu du dossier `dist/` sur une branche dédiée (par exemple `gh-pages`), puis dans *Settings → Pages* choisissez *Deploy from a branch* avec cette branche.

## Installation sur le téléphone

Une fois le site ouvert (HTTPS requis, ce qui est le cas sur GitHub Pages) :

- **iPhone (Safari)** : bouton Partager → **« Sur l’écran d’accueil »** (Ajouter à l’écran d’accueil).
- **Android (Chrome)** : menu ⋮ → **« Ajouter à l’écran d’accueil »** (ou « Installer l’application »).

L’application s’ouvre alors en plein écran et fonctionne hors ligne.

## Vos données

Toutes les données sont stockées **uniquement sur l’appareil**, dans le navigateur. Elles peuvent être perdues en cas de changement de téléphone, de nettoyage des données du navigateur ou de désinstallation. **Exportez-les régulièrement** depuis *Réglages → Exporter mes données*, et réimportez le fichier au besoin.
