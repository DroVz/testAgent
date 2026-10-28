# MuscuTrack — Spécification

Application mobile (PWA) de suivi de musculation. Objectif : créer ses séances types, les lancer pendant l'entraînement, et suivre sa progression dans le temps. **Claire et simple** avant tout.

## Stack technique
- React 18 + TypeScript (strict) + Vite.
- Tests : Vitest (+ @testing-library/react pour quelques composants clés).
- Navigation : `react-router-dom` avec `HashRouter` (compatible hébergement statique type GitHub Pages).
- PWA : `vite-plugin-pwa` (manifest, service worker, fonctionnement hors ligne, icônes).
- Persistance : `localStorage`, une seule clé versionnée (`muscutrack:v1`), via une couche `storage` isolée et testée. Pas de backend.
- Graphiques : SVG fait main (pas de lib de charts) pour rester léger.
- Styles : CSS simple (variables CSS), thème sombre, mobile-first, cibles tactiles ≥ 44px. Pas de framework CSS.
- Interface entièrement en **français**. Unités : kg.

## Modèle de données
- `Exercise` : `id`, `name`, `muscleGroup` (Pectoraux, Dos, Jambes, Épaules, Biceps, Triceps, Abdos, Autre), `isCustom`.
  - Bibliothèque pré-remplie d'environ 30 exercices courants (développé couché, squat, soulevé de terre, tractions, etc.).
- `Template` (séance type) : `id`, `name`, `exercises: TemplateExercise[]`, `createdAt`, `updatedAt`.
  - `TemplateExercise` : `exerciseId`, `targetSets`, `targetReps`, `targetWeight?`, `restSeconds` (défaut 90).
- `WorkoutSession` (séance réalisée) : `id`, `templateId?`, `name`, `startedAt`, `endedAt?`, `exercises: SessionExercise[]`, `notes?`.
  - `SessionExercise` : `exerciseId`, `sets: SetEntry[]`.
  - `SetEntry` : `weight` (kg, ≥ 0, décimales autorisées), `reps` (entier ≥ 0), `done: boolean`.
- État racine persistant : `{ version: 1, exercises, templates, sessions, activeSession? }`.

## Fonctionnalités

### 1. Séances types (onglet « Séances »)
- Liste des séances types avec bouton « Démarrer » bien visible sur chacune.
- Créer / modifier / dupliquer / supprimer (avec confirmation intégrée, pas de `window.confirm`).
- Éditeur : nom, ajout d'exercices depuis la bibliothèque (recherche + filtre par groupe musculaire), réordonner (monter/descendre), objectifs séries × reps × poids, temps de repos.
- Création d'un exercice personnalisé depuis le sélecteur.

### 2. Séance en cours
- Démarrer depuis une séance type (ou « séance libre » vide).
- Pour chaque exercice : liste des séries avec champs poids / reps pré-remplis avec **les valeurs de la dernière fois** (sinon les objectifs), et rappel « Dernière fois : 3×10 @ 60 kg ».
- Valider une série d'un tap (coche) → lance un **minuteur de repos** (durée de l'exercice, ±15 s, passer). Vibration en fin de repos si disponible.
- Ajouter / supprimer une série, ajouter un exercice à la volée.
- Chrono de la durée de la séance.
- La séance en cours est sauvegardée en continu : si l'app est fermée, on la retrouve (bannière « Reprendre la séance »).
- Terminer → résumé (durée, volume total, séries, nouveaux records) → enregistrement dans l'historique. Les séries non validées sont ignorées. Option « Abandonner ».
- Proposer à la fin de mettre à jour la séance type avec les poids réalisés (facultatif, si démarrée depuis une séance type).

### 3. Historique (onglet « Historique »)
- Liste chronologique (récent en haut) : date, nom, durée, volume.
- Détail d'une séance ; suppression possible.

### 4. Progression (onglet « Progrès »)
- Choix d'un exercice → graphique dans le temps : poids max, 1RM estimé (Epley : `poids × (1 + reps/30)`, reps = 1 → poids), volume (Σ poids × reps).
- Records personnels : meilleur poids, meilleur 1RM estimé, meilleur volume sur une séance.
- Stats globales simples : nombre de séances, séances cette semaine / ce mois.

### 5. Réglages
- Export des données en JSON (affiché / copiable, et téléchargement si possible) et import (avec validation, confirmation avant écrasement).
- Gestion des exercices personnalisés.
- Réinitialiser les données (confirmation).

## Navigation
Barre d'onglets en bas : **Séances · Historique · Progrès · Réglages**. La séance en cours est un écran plein dédié.

## Qualité
- Logique métier (calculs de stats, records, « dernière fois », storage/migration, import/validation) dans des modules purs (`src/lib/`) **couverts par des tests**.
- `npm test`, `npm run build` et `npx tsc --noEmit` doivent passer.
- Robustesse : données corrompues dans le stockage → l'app démarre quand même (état par défaut + avertissement), champs vides ou invalides gérés.
