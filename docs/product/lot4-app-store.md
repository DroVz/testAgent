# Lot 4 : préparation App Store (Capacitor iOS, fonctions natives, fiche Store)

*Product owner, 29 octobre 2026. Ce document précise le lot 4 de `vision-et-roadmap.md` et remplace le détail qui s'y trouvait (§4.A et §4.B). En cas d'écart, ce document fait foi.*

Lu avant d'écrire : `docs/identity.md` (§2, §3, §6, §9.2, §9.3), `vision-et-roadmap.md` (lot 4 du 28 octobre, questions 3 à 6), `lot2-programmes.md`, `lot3-rythme.md` (§2.1 « séance comptée », §4.5 Réglages, §6 persistance), `docs/SPEC.md`, `package.json`, `vite.config.ts`, `index.html`, `src/lib/storage.ts` (`StorageLike`, `loadState`, `saveState`, `exportState`), `src/state/AppStore.tsx` (sauvegarde à chaque changement, `replaceAndSave`), `src/lib/restTimer.ts`, `src/components/RestTimer.tsx` (`navigator.vibrate`), `src/pages/SettingsPage.tsx` (`downloadText`, import `accept=".json,application/json"`), `src/styles.css` (zones sûres déjà gérées), `public/icons/icon.svg`, `docs/brand/hybride-b/` (`icon.svg`, `tokens.css`).

Vérifié sur le web et sur npm le 29 octobre 2026 (sources en fin de document) : versions Capacitor, exigences Xcode/SDK, tailles de captures, règles 4.2, 4.5.4, 5.1.1, manifeste de confidentialité, classification par âge, statut DSA.

---

## 0. En bref

- **Partie A, dans le code, sur Windows** : 9 sous-lots (4.1 à 4.9) livrés en 3 vagues. Chaque sous-lot se teste sans iPhone : tests unitaires Vitest avec des mocks des plugins Capacitor, build web inchangé, e2e Playwright, et vérification de fichiers (Info.plist, PNG, manifeste) par des tests Node.
- **Partie B, chez le propriétaire** : 14 étapes ordonnées. Coût minimal : **99 € par an** (Apple Developer Program), plus éventuellement un Mac ou des minutes de CI macOS. Délai réaliste entre l'inscription et la publication : **2 à 4 semaines**.
- **Règle 4.2** : la réponse ne tient pas à un plugin isolé. Elle tient à une app entièrement locale, sans aucune page web chargée, avec cinq comportements qu'un site ne peut pas avoir sur iPhone, tous visibles dans le parcours principal. Voir §C.

### Vagues de livraison
| Vague | Sous-lots | Effort | Dépend de |
|---|---|---|---|
| **4a · Socle** | 4.1 Capacitor et plateforme, 4.2 Stockage durable, 4.6 Export natif, 4.8 Confidentialité | M + M + S + S | Lot 3 livré (4.2 sauvegarde ses réglages) |
| **4b · En séance** | 4.3 Notification de fin de repos, 4.5 Haptique et écran allumé | M + S | 4a |
| **4c · Store** | 4.4 Rappels de séance, 4.7 Icônes et écran de lancement, 4.9 Métadonnées et captures | M + S + M | 4a, lot 3 (`countedSessions`) |

Chaque vague se termine par `npm test`, `npm run build`, `npm run e2e` au vert, **et un build web identique au comportement actuel** (aucune régression PWA).

---

# Partie A — Ce qui se fait dans le code, sans Mac ni compte Apple

## A.0 Principes communs

1. **Une seule base de code.** Le même `src/` sert la PWA et l'app iOS. Rien ne bifurque dans les pages : elles appellent des **services de plateforme** (`src/platform/`) qui ont chacun une implémentation web et une implémentation native.
2. **Détection** : `isNative()` = `Capacitor.isNativePlatform()` (de `@capacitor/core`), lu une fois. `platformName()` = `Capacitor.getPlatform()` (`'web'` ou `'ios'`). Aucune détection par `userAgent`.
3. **Repli web propre** : chaque service a un comportement web défini ci-dessous. Une fonction absente sur le web est **cachée**, jamais affichée grisée ni accompagnée de « disponible dans l'app ». Le web ne dit jamais « téléchargez l'app ».
4. **Jamais d'exception vers l'écran** : un plugin qui échoue (refus, plugin indisponible) n'affiche rien et ne bloque rien, sauf mention contraire. Même règle que `saveRestEndsAt` aujourd'hui.
5. **Testable sans iPhone** : chaque service reçoit ses dépendances (plugin, horloge) en paramètre ou via `vi.mock`. Patron de test commun :
   ```ts
   vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } }));
   vi.mock('@capacitor/haptics', () => ({ Haptics: { impact: vi.fn(), notification: vi.fn() }, ImpactStyle: { Light: 'LIGHT' }, NotificationType: { Success: 'SUCCESS' } }));
   ```
   Chaque sous-lot a **deux jeux de tests** : « natif » (plugins mockés, on vérifie les appels) et « web » (`isNativePlatform: () => false`, on vérifie le repli et l'absence d'appel au plugin).
6. **Textes** : mêmes règles que les lots précédents (`format.ts`, `COLON`, `NBSP`, apostrophes typographiques, aucun « ! » sauf record, aucun emoji, aucun mot d'échec de `identity.md` §9.3).

### Versions à installer (vérifiées sur npm le 29 octobre 2026)

Le projet épingle des versions exactes. On prend la dernière version stable publiée depuis plus de deux semaines ; la toute dernière est notée pour la mise à jour suivante.

| Paquet | Version à épingler | Dernière stable (date) | Rôle |
|---|---|---|---|
| `@capacitor/core` | **8.5.3** | 8.6.0 (28/10/2026, trop récente) | Pont JS ↔ natif, `isNativePlatform` |
| `@capacitor/cli` (dev) | **8.5.3** | 8.6.0 | `cap add`, `cap sync` |
| `@capacitor/ios` | **8.5.3** | 8.6.0 (pair : `@capacitor/core ^8.5.0`) | Projet Xcode |
| `@capacitor/filesystem` | **8.1.5** (15/10) | 8.1.5 | Fichier de données, fichier d'export |
| `@capacitor/local-notifications` | **8.3.1** (19/08) | 8.3.1 | Fin de repos, rappels |
| `@capacitor/haptics` | **8.0.2** (27/03) | 8.0.2 | Retour haptique |
| `@capacitor/share` | **8.0.3** (02/10) | 8.0.3 | Feuille de partage |
| `@capacitor/status-bar` | **8.0.4** (02/10) | 8.0.4 | Barre d'état clair/sombre |
| `@capacitor/splash-screen` | **8.0.2** (15/07) | 8.0.2 | Écran de lancement maîtrisé |
| `@capacitor/app` | **8.1.2** (02/10) | 8.1.2 | Événements `pause` / `resume` |
| `@capacitor-community/keep-awake` | **8.0.1** (16/04) | 8.0.1 | Écran maintenu allumé |
| `sharp` (dev) | **0.35.5** (27/09) | 0.35.5 | Génération des icônes et du splash sans canal alpha |

Exigences de Capacitor 8 : **Node 22 ou plus** (le README demande déjà 22.12+), **Xcode 26 ou plus**, cible de déploiement **iOS 15.0**. Le CLI crée désormais des projets iOS en **Swift Package Manager** par défaut (pas de CocoaPods), ce qui facilite la génération du dossier `ios/` hors Mac.

Écartés volontairement :
- `@capacitor/preferences` : inutile, le fichier de données suffit (voir 4.2). Une dépendance de moins.
- `@capacitor/assets` (3.0.5, dernière publication en mars 2024, dépend du CLI 5 et de `sharp` 0.32) : abandonné. On génère les images avec `sharp` (4.7).
- `@capacitor/android` : Android reste hors lot (non-objectif ci-dessous).
- Capacitor 9 : encore en alpha. On n'y va pas.

---

## 4.1 Socle Capacitor, structure et détection de plateforme · effort M · vague 4a

**User story** — **US4.0** En tant que propriétaire, je veux que la même base de code produise la PWA et l'app iPhone, pour ne maintenir qu'une seule app.

### Structure attendue
```
capacitor.config.ts          appId, appName, webDir, plugins
ios/                         projet Xcode généré (SPM), versionné
src/platform/
  index.ts                   isNative(), platformName()
  storage.ts                 4.2
  notifications.ts           4.3, 4.4
  haptics.ts                 4.5
  keepAwake.ts               4.5
  share.ts                   4.6
  systemUi.ts                barre d'état, splash (4.1, 4.7)
  *.test.ts                  un fichier de test par service
scripts/generate-assets.mjs  4.7
scripts/store-screenshots.ts 4.9
```

### Configuration
- `capacitor.config.ts` :
  - `appId: 'fr.muscutrack.app'` (défaut de la question 3 de la roadmap ; **il ne pourra plus changer après la première publication**) ;
  - `appName: 'MuscuTrack'`, `webDir: 'dist'` ;
  - `plugins.SplashScreen: { launchAutoHide: false, backgroundColor: '#F5F5FA' }` (caché par le code, voir plus bas) ;
  - `plugins.LocalNotifications: { presentationOptions: [] }` (rien n'est présenté quand l'app est au premier plan, voir 4.3) ;
  - **aucune clé `server.url`** (pas de contenu chargé depuis le réseau, argument 4.2).
- **Deux builds** :
  - `npm run build` : PWA, **strictement inchangé** (service worker, manifest).
  - `npm run build:native` : `tsc --noEmit && vite build --mode native && cap sync ios`. En mode `native`, `VitePWA` est désactivé (`disable: true`) : pas de `sw.js`, pas de `registerSW.js`, pas de `manifest.webmanifest`. Le service worker sert à la PWA ; dans l'app, les fichiers sont déjà dans le paquet.
- **Info.plist** (texte XML, éditable et testable sous Windows) : `CFBundleDisplayName` = `MuscuTrack` ; `CFBundleDevelopmentRegion` = `fr` ; `UISupportedInterfaceOrientations` = portrait seul ; `ITSAppUsesNonExemptEncryption` = `false` ; aucune clé `NS…UsageDescription` (on n'utilise ni caméra, ni photos, ni position, ni santé).
- **Projet Xcode** : `TARGETED_DEVICE_FAMILY = 1` (iPhone seul : pas de captures iPad exigées), `IPHONEOS_DEPLOYMENT_TARGET = 15.0`, `MARKETING_VERSION = 1.0.0`, `CURRENT_PROJECT_VERSION = 1` (incrémenté à chaque envoi par la CI).
- `ios/` est **généré une fois** par `npx cap add ios` et **versionné**. Si le CLI refuse de le générer sous Windows, la CI macOS le génère au premier passage (étape B.6) et le dossier est commité ensuite ; tout le reste du sous-lot reste faisable sous Windows.

### Intégration iOS
- **Zones sûres** : déjà gérées dans `styles.css` (`env(safe-area-inset-*)`, `viewport-fit=cover`). On vérifie seulement qu'aucun élément fixe n'en manque : barre d'onglets, bouton fixe de séance, toasts, en-tête.
- **Barre d'état** (`systemUi.ts`) : texte sombre en thème clair, texte clair en thème sombre, mis à jour à chaque changement de `prefers-color-scheme`. Web : rien (les `<meta name="theme-color">` existants suffisent).
- **Écran de lancement** : caché par `SplashScreen.hide()` **après** le chargement des données (4.2), ou au plus tard 3 s après le démarrage. Web : rien.
- **Liens externes** : aucun lien de l'app ne s'ouvre dans la WebView. Aujourd'hui il n'y en a aucun (`href="http` absent de `src/`) ; un test le garde.
- **Aucun texte de navigateur en natif** : les messages qui parlent du navigateur (« Téléchargement indisponible sur ce navigateur… ») ne peuvent pas apparaître en natif, parce que l'export y passe par la feuille de partage (4.6).

### Critères d'acceptation
1. `npm run build` produit les mêmes fichiers qu'avant le lot (dont `sw.js` et `manifest.webmanifest`) ; `npm run e2e` passe sans modification des tests existants.
2. `vite build --mode native` produit un `dist/` **sans** `sw.js`, `registerSW.js` ni `manifest.webmanifest`, et son `index.html` ne référence aucun des trois (test Node sur `dist/`).
3. `isNative()` renvoie `false` dans Vitest/jsdom et dans Playwright ; avec `@capacitor/core` mocké en natif, il renvoie `true`. Aucun fichier de `src/pages/` ou `src/components/` n'importe un paquet `@capacitor/*` directement (test qui balaie les imports) : tout passe par `src/platform/`.
4. `capacitor.config.ts` contient `appId: 'fr.muscutrack.app'`, `webDir: 'dist'` et aucune clé `server` (test qui importe la config).
5. Test Node sur `ios/App/App/Info.plist` : présence de `ITSAppUsesNonExemptEncryption` à `false`, `CFBundleDisplayName` = `MuscuTrack`, orientation portrait seule, aucune clé `NS…UsageDescription`.
6. Aucun `href` absolu (`http:`/`https:`) ni `target="_blank"` dans `src/` (test de balayage).
7. Le bundle JS web (gzip) ne grossit pas de plus de **25 Ko** par rapport à avant le lot (les plugins Capacitor sont de fines façades).

### Tester sans iPhone
Vitest (mocks de `@capacitor/core`), tests Node sur `dist/` et `Info.plist`, e2e Playwright existants. Premier test sur un vrai iPhone à l'étape B.8 (TestFlight).

---

## 4.2 Stockage durable et migration sans perte · effort M · vague 4a

**User story** — **US4.3a** En tant que pratiquant, je veux que mon historique survive aux mises à jour de l'app et au manque de place sur le téléphone, pour ne jamais perdre mes séances.

### Pourquoi
Dans l'app, le `localStorage` vit dans le dossier de données de la WebView. La documentation Capacitor rappelle que le système peut récupérer ce stockage quand l'appareil manque de place. Pour un carnet d'entraînement, c'est inacceptable : les données passent dans un **fichier** de l'app.

### Choix : un fichier JSON, pas Preferences
| | `@capacitor/preferences` (UserDefaults) | `@capacitor/filesystem` (fichier JSON) | `localStorage` WebView |
|---|---|---|---|
| Purgeable par iOS | Non | Non (dossier `Library`, hors `Caches`) | **Oui** |
| Sauvegardé par iCloud / l'ordinateur | Oui | Oui | Variable |
| Adapté à 1 à 5 Mo réécrits à chaque série | Non (tout le plist est réécrit et gardé en mémoire) | **Oui** | Oui |
| Décision | Écarté | **Retenu en natif** | **Conservé sur le web** |

### Fonctionnement
- **Interface inchangée pour le store** : `AppStore` continue d'appeler `loadState(storage)` / `saveState(state, storage)` de façon synchrone avec un `StorageLike`. En natif, ce `StorageLike` est un **miroir en mémoire** :
  - préchargé **avant le premier rendu** (`main.tsx` attend `await durableStorage.hydrate()` en natif ; sur le web, rien n'est attendu) ;
  - `getItem` lit le miroir ; `setItem` met à jour le miroir et programme une écriture du fichier ;
  - les écritures sont **sérialisées** (une à la fois, la dernière gagne) et regroupées sur 300 ms ;
  - l'événement `pause` de `@capacitor/app` (app mise en arrière-plan) **force l'écriture immédiate** ;
  - si une écriture échoue, le miroir appelle `onWriteError`, qui affiche le bandeau d'échec de sauvegarde existant (`saveFailed`).
- **Fichiers** (répertoire `Directory.Library`, dossier `muscutrack/`) :
  - `state.json` : l'état courant, au même format que l'export (`version: 1`) ;
  - `state.bak.json` : l'état précédent.
  - Écriture atomique : écrire `state.tmp.json`, renommer `state.json` en `state.bak.json`, renommer `state.tmp.json` en `state.json`.
- **Lecture au démarrage**, dans l'ordre :
  1. `state.json` valide (`validateImport`) → on l'utilise ;
  2. sinon `state.bak.json` valide → on l'utilise et on affiche l'avertissement de chargement existant, avec le texte « Les dernières modifications n’ont pas pu être relues. La sauvegarde précédente a été restaurée. » ;
  3. sinon, **migration** : clé `muscutrack:v1` du `localStorage` de la WebView, si elle existe et qu'elle est valide ;
  4. sinon état par défaut (premier lancement), ou avertissement « données illisibles » existant si quelque chose d'illisible a été trouvé.
- **Migration** (étape 3) : on écrit `state.json`, on le **relit et on le compare** au contenu migré, et seulement ensuite on le considère comme la source. **On ne supprime pas** la clé `localStorage` : elle reste comme filet jusqu'à une version ultérieure. Une fois `state.json` présent, le `localStorage` n'est plus jamais relu, même s'il change.
- **Ce que la migration couvre** : les testeurs TestFlight dont la version précédente utilisait le `localStorage`. **Elle ne couvre pas** le passage de la PWA (Safari) à l'app : ce sont deux origines distinctes, iOS ne permet pas de lire l'une depuis l'autre. Ce passage se fait par Réglages › Sauvegarde › « Exporter mes données » sur le web, puis « Importer » dans l'app. Aucun écran ne l'annonce (le web ne fait pas la promotion de l'app).
- **« Pas de sauvegarde au démarrage »** (règle actuelle d'`AppStore`) reste vraie : des données illisibles ne sont pas écrasées tant que l'utilisateur n'a rien modifié. En natif, on ne réécrit `state.json` au démarrage **que** pour une migration réussie.
- **Ce qui reste dans le stockage de la WebView** (commodités, perte acceptable) : l'exercice affiché sur Progrès (`ProgressPage`), le minuteur de repos en cours (`muscutrack:repos`, `sessionStorage`).
- **Web** : `localStorage`, comme aujourd'hui. En plus, à la première sauvegarde, `navigator.storage?.persist?.()` est appelé une fois (sans message, résultat ignoré) pour demander au navigateur de ne pas purger les données.

### Critères d'acceptation
1. **Migration complète sans perte** : avec un `localStorage` contenant un état complet (60 séances, 5 séances types, 3 exercices personnalisés, une séance en cours avec séries validées et non validées, `settings` avec `suggestLoad: false`, `weeklyGoal: 3`, `weeklyGoalAsked: true`), et un `Filesystem` mocké vide, `hydrate()` puis `loadState()` renvoie un état **profondément égal** (`toEqual`) à l'état d'origine. `state.json` existe et vaut `exportState(état)`.
2. Après migration, la clé `muscutrack:v1` du `localStorage` est **toujours présente et inchangée**.
3. Deuxième lancement : `state.json` présent et `localStorage` modifié entre-temps → c'est `state.json` qui est chargé.
4. `state.json` illisible et `state.bak.json` valide → l'état de `state.bak.json` est chargé et l'avertissement « Les dernières modifications n’ont pas pu être relues. La sauvegarde précédente a été restaurée. » est affiché.
5. Les deux fichiers illisibles et `localStorage` illisible → état par défaut, avertissement « données illisibles » existant, **et aucun fichier n'est écrit** tant que l'utilisateur ne modifie rien.
6. 10 `setItem` en moins de 300 ms → **une seule** écriture de fichier, avec le dernier état. Deux écritures ne se chevauchent jamais (mock de `writeFile` qui se résout lentement).
7. Événement `pause` → écriture immédiate de l'état en attente.
8. `writeFile` rejette → `onWriteError` est appelé et le bandeau d'échec de sauvegarde existant s'affiche (test du `AppStoreProvider` avec le miroir mocké).
9. Écriture atomique : l'ordre des appels mockés est `writeFile(tmp)`, `rename(state → bak)`, `rename(tmp → state)`.
10. Web : aucun appel à `@capacitor/filesystem` ; `navigator.storage.persist` appelé au plus une fois ; le comportement de `loadState` / `saveState` est inchangé (les tests existants de `storage.test.ts` passent tels quels).
11. Import et Réinitialiser, en natif, écrivent bien `state.json` (mock vérifié).

### Tester sans iPhone
Mock en mémoire de `Filesystem` (`readFile`, `writeFile`, `rename`, `stat`) et de `App.addListener('pause')`. Le vrai test de survie (mise à jour de l'app par TestFlight, données conservées) est dans la liste de vérification de l'étape B.8.

---

## 4.3 Notification locale de fin de repos · effort M · vague 4b

**User story** — **US4.1** En tant que pratiquant, je veux être prévenu de la fin du repos même écran verrouillé, pour ne pas surveiller le minuteur.

### Comportement
- **Programmation** : quand un minuteur de repos démarre (validation d'une série) et que la notification de repos est autorisée, on programme **une** notification locale d'identifiant fixe `1`, à `endsAt` (le timestamp déjà persisté par `restTimer.ts`).
- **Annulation** (identifiant `1`) : « Passer », « Série suivante », nouveau minuteur (remplace l'ancien), fin de séance, « Abandonner ». **−15 s / +15 s** : annulation puis reprogrammation à la nouvelle fin. Minuteur déjà écoulé au moment d'un ajustement : rien n'est programmé.
- **Premier plan** : `presentationOptions: []` dans la config. Si l'app est ouverte à la fin du repos, iOS n'affiche rien ; c'est l'écran « Repos terminé. » et l'haptique (4.5) qui préviennent.
- **Textes** (fonctions pures dans `format.ts`, `formatRestNotification(nextSet)`) :
  - titre : « Repos terminé. »
  - corps, série avec charge : « Série suivante : Développé couché, 82,5 kg × 8. »
  - corps, poids du corps (charge 0) : « Série suivante : Tractions, 8 reps. »
  - corps, plus aucune série à faire : « Toutes les séries sont faites. Tu peux terminer la séance. »
  - « Série suivante » = première série non validée de l'exercice en cours, sinon première série non validée de l'exercice suivant. Calcul pur, `nextPendingSet(session, exerciseIndex)`.
  - *Changement par rapport à la roadmap* : le nom de l'exercice garde sa majuscule telle qu'elle est enregistrée (les noms personnalisés ne se mettent pas en minuscules proprement).
- **Toucher la notification** : ouvre l'app sur la séance en cours (comportement de reprise existant). Aucun lien profond à ajouter.

### Autorisation : demandée au bon moment, une seule fois
- Jamais au lancement. Au **premier minuteur** de repos en natif, si `settings.restNotifications` est absent, une feuille s'ouvre (composant `ConfirmDialog` existant) :
  - titre : « Être prévenu à la fin du repos ? »
  - texte : « Une notification t’avertit quand le repos est fini, même écran verrouillé. »
  - boutons : « Autoriser » (principal) et « Pas maintenant ».
  - Le minuteur tourne derrière la feuille, sans pause.
- « Autoriser » → `requestPermissions()` (la fenêtre système d'iOS s'affiche) → accordé : `restNotifications: true` et programmation du repos en cours ; refusé : `restNotifications: false`, sans message.
- « Pas maintenant » → `restNotifications: false`. **On ne redemande jamais.** Le réglage reste dans Réglages.
- **Garde-fou important** : depuis la version 8.3.0 du plugin, `schedule()` demande lui-même l'autorisation si elle n'a pas été donnée. On appelle donc **toujours `checkPermissions()` avant `schedule()`**, et on ne programme que si l'état est `granted`. Ainsi la fenêtre système n'apparaît jamais en dehors de la feuille ou d'un geste dans Réglages.

### Réglages › section « Notifications » (natif seulement)
- Placée après la section « Séance » (lot 3). Cachée sur le web.
- Interrupteur « Prévenir à la fin du repos », aide : « Une notification à la fin de chaque repos, même écran verrouillé. »
- Activer → `checkPermissions()` ; si `prompt`, `requestPermissions()` ; si `denied` : l'interrupteur reste activé et le texte suivant s'affiche dessous : « Les notifications sont coupées pour MuscuTrack. Tu peux les réactiver dans Réglages de l’iPhone › MuscuTrack › Notifications. »
- Désactiver → `restNotifications: false` et annulation de l'identifiant `1`.

### Persistance
- `AppSettings.restNotifications?: boolean` ; absent = jamais demandé. Exporté avec le reste. `parseSettings` : booléen, sinon échec qui nomme `settings.restNotifications`. `version` reste `1`.

### Repli web
Aucune notification, aucune feuille, aucune section « Notifications ». Le minuteur et la vibration existante (Android) sont inchangés. Raison : une notification web programmée à l'avance exige un service worker et des notifications push ; c'est peu fiable sur iPhone et contraire à « aucune donnée envoyée ».

### Critères d'acceptation
1. Natif, autorisation `granted`, `restNotifications: true` : valider une série avec 90 s de repos appelle `schedule` une fois avec `id: 1`, `schedule.at` = `endsAt`, titre « Repos terminé. » et le corps attendu.
2. « Passer », « Série suivante », « Terminer », « Abandonner » appellent `cancel({ notifications: [{ id: 1 }] })`. « +15 s » appelle `cancel` puis `schedule` à `endsAt + 15 000`.
3. `checkPermissions` renvoie `prompt` ou `denied` → `schedule` n'est **jamais** appelé (test explicite du garde-fou).
4. Premier minuteur, `restNotifications` absent → la feuille s'affiche avec les textes exacts ; « Pas maintenant » → `restNotifications: false`, aucun appel à `requestPermissions` ; la feuille ne réapparaît pas au minuteur suivant ni après rechargement.
5. `formatRestNotification` : 4 cas testés (charge décimale « 82,5 kg », charge entière « 80 kg », poids du corps, plus rien à faire), avec espaces insécables avant « : » et « kg ».
6. Web : aucun appel au plugin, aucune feuille, section « Notifications » absente du DOM de Réglages.
7. Import d'un fichier avec `restNotifications: "oui"` → échec qui nomme `settings.restNotifications`.

### Tester sans iPhone
Mock de `LocalNotifications` (`checkPermissions`, `requestPermissions`, `schedule`, `cancel`) et horloge injectée. Le test sur appareil (écran verrouillé, son, premier plan) est dans la liste B.8.

---

## 4.4 Rappels de séance optionnels · effort M · vague 4c

**User story** — **US4.2** En tant que pratiquant, je veux des rappels de séance aux jours et à l'heure que je choisis, pour tenir mon rythme, sans que l'app me relance.

Conforme à `identity.md` §9.2 (« Désactivé par défaut ; jours et heure choisis ; texte neutre ; pas de rappel si la séance du jour est déjà faite ») et §9.3 (aucune relance qui pointe une absence, aucune notification non demandée).

### Réglage (Réglages › Notifications, natif seulement)
- Interrupteur « Rappels de séance », **désactivé par défaut**.
- Aide : « Un rappel les jours choisis, à l’heure choisie. Pas de rappel si tu t’es déjà entraîné ce jour-là. »
- Une fois activé apparaissent :
  - les jours : 7 pastilles de 48 px « L », « M », « M », « J », « V », « S », « D », remplies en encre quand elles sont choisies (même style que les pastilles d'objectif du lot 3, **pas d'accent**), noms accessibles « lundi » … « dimanche », rôle `checkbox` ;
  - **aucun jour présélectionné**, et tant qu'aucun jour n'est choisi : « Choisis les jours de rappel. » ;
  - l'heure : champ `<input type="time">`, libellé « Heure », 18:00 par défaut.
- Activer l'interrupteur demande l'autorisation (geste explicite) avec la même logique et le même texte de refus qu'en 4.3.

### Textes
- Titre : « C’est l’heure de ta séance. »
- Corps : « Suggérée : Jambes. » (nom de la séance suggérée par `stats.suggestedTemplateId` au moment de la programmation) ; sans aucune séance type : « Ouvre MuscuTrack pour commencer. »
- Interdits (test) : tout nombre de jours, « depuis », « encore », « toujours pas », « ! », et les mots de `identity.md` §9.3.

### Programmation : des rappels ponctuels, recalculés
Un rappel hebdomadaire répété par iOS ne sait pas sauter un jour où l'on s'est déjà entraîné. On programme donc des **rappels ponctuels** sur un horizon de **28 jours**, recalculés souvent.
- Fonction pure `planReminders(settings, sessions, templates, now)` → liste de `{ id, at, title, body }` :
  - pour chaque jour des 28 prochains jours (aujourd'hui compris) dont le jour de la semaine est choisi, à l'heure choisie, heure locale ;
  - on saute aujourd'hui si l'heure est passée **ou** si une séance comptée (`countedSessions`, lot 3 §2.1) a commencé aujourd'hui ;
  - identifiants `100` à `127`, dans l'ordre chronologique.
- **Recalcul** (annuler les identifiants 100 à 127, puis programmer la nouvelle liste) : au démarrage, à l'événement `resume`, à la fin d'une séance, à chaque changement du réglage, après un import et après Réinitialiser.
- Conséquence assumée : sans ouvrir l'app pendant 4 semaines, les rappels s'arrêtent d'eux-mêmes. C'est cohérent avec « pas de relance ».
- Limite d'iOS : 64 notifications en attente par app. Au maximum 28 rappels + 1 repos : on reste loin de la limite.

### Persistance
- `AppSettings.reminders?: { days: number[]; time: string }` ; absent = désactivé. `days` : entiers de 1 (lundi) à 7 (dimanche), sans doublon, triés ; `time` : `HH:MM` sur 24 h. Désactiver **retire** le champ.
- `parseSettings` : tout écart échoue avec un message qui nomme `settings.reminders.days` ou `settings.reminders.time`.

### Repli web
Section absente. Aucun rappel.

### Critères d'acceptation
1. `planReminders` avec jours `[1, 3, 5]` (lundi, mercredi, vendredi), 18:00, `now` = lundi 2 novembre 2026 10:00 → 12 rappels, le premier lundi 2 novembre 18:00 heure locale, le dernier vendredi 27 novembre 18:00.
2. Même cas avec une séance comptée commencée ce lundi à 08:00 → 11 rappels, le premier le mercredi 4 novembre.
3. Même cas avec seulement une séance **vide** ce lundi (non comptée, lot 3) → 12 rappels.
4. `now` = lundi 19:00 → le rappel de ce lundi est sauté.
5. Changement d'heure : `now` = lundi 19 octobre 2026 10:00, fuseau `Europe/Paris` (passage à l'heure d'hiver le dimanche 25 octobre) → les rappels du 21 octobre et du 26 octobre sont tous deux à 18:00 heure locale (calcul par `setDate`, jamais par `+ 24 h`).
6. Fin de séance → `cancel` des identifiants 100 à 127 puis `schedule` de la nouvelle liste, sans le rappel du jour.
7. Interrupteur désactivé → `reminders` absent de l'état et identifiants 100 à 127 annulés.
8. Aucun texte produit par `planReminders` ne contient « ! », « depuis », un chiffre de jours ou un mot de §9.3 (test qui balaie 0, 1 et 5 séances types).
9. Web : section absente, aucun appel au plugin.
10. Garde-fou 4.3 : sans autorisation `granted`, `schedule` n'est jamais appelé.

### Tester sans iPhone
`planReminders` est pur (horloge injectée, fuseau `Europe/Paris` fixé par `TZ` dans le script de test). Le plugin est mocké pour le recalcul. Le test sur appareil est dans B.8.

---

## 4.5 Haptique et écran maintenu allumé · effort S · vague 4b

**User stories** — **US4.4** En tant que pratiquant, je veux sentir que ma série est validée sans regarder l'écran. **US4.5** En tant que pratiquant, je veux que l'écran ne se mette pas en veille pendant la séance.

### Haptique (`src/platform/haptics.ts`, `@capacitor/haptics`)
| Moment | Natif | Web (repli) |
|---|---|---|
| « Valider la série » (passage de non validée à validée ; **pas** quand on dé-valide) | `impact({ style: Light })` | rien |
| Fin du repos, app au premier plan | `notification({ type: Success })` | `navigator.vibrate([200, 100, 200])`, comme aujourd'hui |
| Ouverture du récap **juste après « Terminer »**, s'il affiche au moins un record | `notification({ type: Success })`, une fois | rien |

- Le record est ressenti au moment où il est **lu** : le récap est aujourd'hui le seul écran qui l'annonce. Une vibration différente pendant la séance, sans texte, serait inexpliquée (pilier clarté). Si l'item « Record annoncé pendant la séance » (roadmap, Plus tard) est fait, l'haptique de record passe à la validation de la série, en même temps que le texte.
- Rouvrir un récap depuis l'Historique ne déclenche rien.
- **Pas d'haptique en retard** : au retour au premier plan après la fin du repos (`visibilitychange`), aucune haptique ni vibration si la fin date de plus de 2 s. *Corrige un comportement actuel : `RestTimer` vibre au retour de veille.*
- Pas de réglage dédié : iOS respecte déjà Réglages › Sons et vibrations › Retour haptique système.

### Écran allumé (`src/platform/keepAwake.ts`)
- Natif : `KeepAwake.keepAwake()` à l'ouverture de l'écran de séance, `KeepAwake.allowSleep()` à sa fermeture (Terminer, Abandonner, démontage), réactivé à l'événement `resume` si l'écran de séance est affiché.
- Web : Screen Wake Lock (`navigator.wakeLock.request('screen')`) si disponible, relâché à la sortie, redemandé au `visibilitychange` (le navigateur le libère quand la page est cachée). Indisponible ou refusé : rien.
- Aucun texte à l'écran. Pas de réglage (non-objectif ci-dessous).

### Critères d'acceptation
1. Natif : valider une série appelle `Haptics.impact` une fois avec `Light` ; dé-valider ne l'appelle pas.
2. Natif : fin du repos au premier plan → `Haptics.notification` avec `Success` une fois ; `navigator.vibrate` n'est pas appelé.
3. Retour au premier plan 30 s après la fin du repos → aucun appel haptique ni `vibrate` (natif et web).
4. Récap atteint par « Terminer » avec 1 record → une notification `Success` ; même récap rouvert depuis l'Historique → aucun appel ; récap sans record → aucun appel.
5. Web : les tests existants de vibration de `RestTimer` (`components.test.tsx`) passent, sauf le cas du retour tardif, qui change volontairement (critère 3).
6. Natif : entrer dans la séance appelle `keepAwake` ; Terminer, Abandonner et le démontage appellent `allowSleep` ; `resume` sur l'écran de séance rappelle `keepAwake`.
7. Web : `navigator.wakeLock.request('screen')` est appelé si présent, et le verrou est relâché en sortie ; absent, aucune erreur.

### Tester sans iPhone
Mocks de `Haptics` et `KeepAwake`, faux `navigator.wakeLock`. Sur Android Chrome, le repli web de vibration et de Wake Lock se vérifie à la main. Le ressenti sur iPhone est dans B.8.

---

## 4.6 Export par la feuille de partage native · effort S · vague 4a

**User story** — **US4.3b** En tant que pratiquant, je veux enregistrer ma sauvegarde où je veux (Fichiers, AirDrop, mail), pour la garder hors du téléphone.

### Comportement
- Natif, « Exporter mes données » :
  1. `Filesystem.writeFile` du JSON (`exportState`) dans `Directory.Cache`, nom `exportFileName()` existant (`muscutrack-AAAA-MM-JJ.json`) ;
  2. `Share.share({ title: 'Sauvegarde MuscuTrack', files: [uri] })` ouvre la feuille de partage d'iOS ;
  3. partage terminé : message « Sauvegarde prête. Garde-la dans Fichiers ou envoie-la où tu veux. » ; **annulé par l'utilisateur** : aucun message (ce n'est pas une erreur) ; échec : « Partage impossible. Tu peux copier le texte ci-dessous. ». Le texte JSON et le bouton « Copier » restent affichés comme aujourd'hui.
- Web : **inchangé** (téléchargement, sinon copie).
- Import : inchangé. Le sélecteur de fichier (`accept=".json,application/json"`, déjà en place) ouvre Fichiers sur iPhone.

### Critères d'acceptation
1. Natif : `writeFile` appelé avec `directory: Cache`, `path` = `muscutrack-2026-10-29.json` (date injectée), contenu = `exportState(state)`, puis `Share.share` avec l'URI renvoyée.
2. `Share.share` rejette avec l'annulation → aucun message d'erreur ; rejette autrement → message « Partage impossible. Tu peux copier le texte ci-dessous. »
3. Natif : `downloadText` n'est jamais appelé et le texte « navigateur » n'apparaît pas.
4. Web : les tests existants de l'export passent sans modification ; `Share` n'est jamais appelé.

### Tester sans iPhone
Mocks de `Filesystem` et `Share`. Sur appareil (B.8) : enregistrer dans Fichiers, puis réimporter ce fichier.

---

## 4.7 Icônes et écran de lancement, depuis la marque Améthyste · effort S · vague 4c

### Source
`public/icons/icon.svg` = `docs/brand/hybride-b/icon.svg` (fond `#584CAD`, deux crans blancs inclinés). Problème : il a des coins arrondis (`rx="112"`). L'icône App Store doit être **carrée, opaque, sans canal alpha** ; c'est iOS qui arrondit.

### Script `scripts/generate-assets.mjs` (`npm run assets`, avec `sharp`)
- Variante carrée : même SVG, `rx` mis à 0, rendu à **1024 × 1024**, `flatten` + `removeAlpha` → `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png` et un `Contents.json` à une seule taille (format universel accepté par Xcode 14 et plus).
- PWA : `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (motif dans la zone sûre centrale de 80 %), `apple-touch-icon.png` (180 × 180, carré, opaque), régénérés depuis la même source. Le manifest ne change pas.
- Écran de lancement : 2732 × 2732, fond `#F5F5FA` (clair) et `#0B0B12` (sombre, valeur de `index.html`), avec les deux crans au centre en `#584CAD`, largeur 360 px, sans texte. Écrits dans `ios/App/App/Assets.xcassets/Splash.imageset/` avec la variante sombre déclarée dans `Contents.json`.
- Le script est relançable et produit des fichiers identiques à chaque fois (pas d'horodatage dans les PNG).

### Critères d'acceptation (tests Node qui lisent l'en-tête PNG)
1. `AppIcon-1024.png` : 1024 × 1024, type de couleur PNG 2 (RVB, **sans alpha**), pixel (0, 0) = `#584CAD` (coin non transparent).
2. PNG PWA : dimensions exactes 192, 512, 512, 180 ; `apple-touch-icon.png` sans alpha.
3. Splash : 2732 × 2732, sans alpha, pixel (0, 0) = `#F5F5FA` pour le clair et `#0B0B12` pour le sombre.
4. Relancer `npm run assets` ne modifie aucun fichier (`git status` propre).
5. Hors périmètre : variantes d'icône sombre et teintée d'iOS 18. On les ajoutera si la marque les dessine.

---

## 4.8 Politique de confidentialité et déclarations · effort S · vague 4a

La règle 5.1.1 (i) exige un lien vers la politique **dans la fiche App Store Connect et dans l'app, facile d'accès**. La politique doit dire quelles données sont collectées, quels tiers y ont accès, combien de temps elles sont gardées et comment les supprimer.

### Dans l'app
- Nouvelle section de Réglages, en dernier, « À propos » : « Version 1.0.0 » (lue dans `package.json`, comme aujourd'hui) et un lien interne « Confidentialité » vers `#/confidentialite`.
- Page `ConfidentialitePage` (route `/confidentialite`), titre « Confidentialité », bouton retour vers Réglages, le texte ci-dessous. Visible sur le web **et** en natif.

### Public
- `public/confidentialite.html` : page statique autonome (styles inline, aucune ressource externe), même texte, publiée avec la PWA. Son URL publique (voir question 2) va dans App Store Connect, en « URL de politique de confidentialité » et en « URL d'assistance ».
- Un test vérifie que le texte de la page de l'app et celui de `confidentialite.html` sont identiques (source unique dans `src/lib/privacyText.ts`, injectée dans le HTML au build).

### Texte (à reprendre mot pour mot, `<contact>` fourni par le propriétaire)
> **Confidentialité**
>
> *Dernière mise à jour : <date de publication>.*
>
> **MuscuTrack ne collecte aucune donnée.** L’app n’a ni compte, ni serveur, ni publicité, ni outil de mesure d’audience. Elle ne se connecte pas à Internet.
>
> **Ce qui est enregistré, et où.** Tes séances, séances types, exercices et réglages sont enregistrés uniquement sur ton téléphone. Personne d’autre que toi n’y a accès, pas même nous.
>
> **Tiers.** Aucune donnée n’est transmise à un tiers. Si tu sauvegardes ton iPhone sur iCloud ou sur un ordinateur, cette sauvegarde peut contenir les données de l’app ; elle est alors gérée par Apple ou par toi, selon tes réglages.
>
> **Notifications.** Les rappels et la fin de repos sont des notifications locales, programmées par le téléphone lui-même. Rien n’est envoyé.
>
> **Export.** Quand tu exportes tes données, c’est toi qui choisis où le fichier va.
>
> **Durée et suppression.** Les données restent tant que l’app est installée. Pour tout effacer : Réglages › Zone sensible › Réinitialiser, ou supprime l’app.
>
> **Contact** : <contact>.

### Manifeste de confidentialité (`ios/App/App/PrivacyInfo.xcprivacy`)
- `NSPrivacyTracking` = `false`, `NSPrivacyTrackingDomains` vide, `NSPrivacyCollectedDataTypes` vide.
- `NSPrivacyAccessedAPITypes` : les API « à raison requise » utilisées par **notre** code natif (aucun pour l'instant). Les plugins Capacitor 8 embarquent leur propre manifeste ; la CI vérifie à l'étape B.6 que le rapport de confidentialité d'Xcode (« Generate Privacy Report ») ne signale aucune API sans raison.

### Étiquettes de confidentialité (texte prêt pour l'étape B.11)
- « Collectez-vous des données à partir de cette app ? » → **Non, nous ne collectons pas de données à partir de cette app.** Résultat affiché sur la fiche : « Aucune donnée collectée ».

### Critères d'acceptation
1. Réglages affiche « À propos », « Version 1.0.0 » et le lien « Confidentialité » ; le lien ouvre `#/confidentialite`, qui affiche le titre et les 8 blocs du texte ; le retour ramène à Réglages.
2. `dist/confidentialite.html` existe dans les deux builds, ne charge aucune ressource externe (aucun `http` dans `src=` / `href=`) et contient le même texte que la page de l'app (test).
3. Test Node sur `PrivacyInfo.xcprivacy` : `NSPrivacyTracking` faux, tableau des données collectées vide.
4. **Aucune requête réseau** : un test e2e Playwright intercepte toutes les requêtes pendant le parcours « première séance » (lot 2) et la visite de chaque onglet, et n'en trouve **aucune hors de l'origine locale** (polices comprises). C'est la preuve de « Aucune donnée collectée ».

---

## 4.9 Métadonnées et captures du Store · effort M · vague 4c

### 4.9.1 Métadonnées (fichier `store/metadata.fr.md`, à coller dans App Store Connect)
| Champ | Limite | Valeur |
|---|---|---|
| Nom | 30 car. | « MuscuTrack » (10) ; repli si pris : « MuscuTrack · Carnet de muscu » (28) |
| Sous-titre | 30 car. | « Ton carnet de muscu, clair » (26) |
| Texte promotionnel | 170 car. | « Ta charge proposée à chaque séance, tes records et ta semaine en un coup d’œil. Hors ligne, sans compte, aucune donnée collectée. » (129) |
| Mots-clés | 100 car. | `musculation,salle,séance,charge,progression,record,entraînement,force,poids,haltères,programme` (94). Sans espaces, sans répéter les mots du nom et du sous-titre (« muscu », « carnet » y sont déjà) |
| Catégorie principale | – | Santé et forme |
| Catégorie secondaire | – | Aucune |
| Classification par âge | – | Questionnaire 2026 : « Aucun » partout (pas de contenu médical, pas d'échanges entre utilisateurs, pas de contenu généré, pas de navigateur web, pas d'achats). Attendu : **4+** |
| Prix | – | Gratuit, sans achat intégré |
| Langue principale | – | Français |
| Copyright | – | « 2026 <nom légal du propriétaire> » |
| URL de confidentialité et d'assistance | – | URL publique de `confidentialite.html` (question 2) |

**Description** (≤ 4 000 caractères) :
> MuscuTrack est un carnet de musculation simple et clair. À chaque écran, tu sais où tu en es, quoi faire et ce qui a changé.
>
> Commence en deux minutes avec un programme prêt à l’emploi (Full body, Haut / Bas ou Poids du corps), ou crée tes propres séances. Pendant la séance, un exercice à la fois : les valeurs de la dernière fois sont déjà remplies, tu valides une série d’un geste et le minuteur de repos se lance. Une notification te prévient de la fin du repos, même écran verrouillé, et l’écran reste allumé tant que tu t’entraînes.
>
> MuscuTrack te propose la charge suivante quand tu as réussi toutes tes séries, et te dit toujours pourquoi. Tu suis tes records, tes courbes par exercice et ta semaine, avec un objectif que tu choisis toi-même. Pas de points, pas de badges, pas de reproches.
>
> L’app fonctionne entièrement hors ligne, sans compte. Tes données restent sur ton téléphone et ne sont jamais collectées. Tu peux les exporter quand tu veux par la feuille de partage.

**Notes pour l'App Review** (champ « Notes », en anglais, car le relecteur peut ne pas lire le français) :
> MuscuTrack is a fully offline workout log (French UI). No account, no network access, no data collected. All screens are bundled in the app; nothing is loaded from the web.
> To test in under 2 minutes: tap "Choisir un programme" → "Full body" → "Démarrer la séance" → tap the check mark to complete a set. The rest timer starts.
> Native features: local notification at the end of each rest period (works with the screen locked; permission asked at the first rest timer), optional workout reminders on chosen days (Réglages › Notifications), haptic feedback when completing a set and on personal records, screen kept awake during a workout, backup export through the iOS share sheet, data stored in the app container.

### 4.9.2 Captures

**Exigences actuelles (aide App Store Connect, vérifiée le 29 octobre 2026)** : pour l'iPhone, **au moins une capture « iPhone with Dynamic Island (medium display) »** est obligatoire, en **1179 × 2556** ou **1206 × 2622** (portrait). Les autres tailles sont facultatives et déduites par réduction ; la taille « large display » (**1260 × 2736, 1290 × 2796 ou 1320 × 2868**) sert aux grands iPhone. De 1 à 10 captures par taille, en PNG ou JPEG, **sans canal alpha ni transparence**. App réservée à l'iPhone : aucune capture iPad. *Changement par rapport à la roadmap, qui ne prévoyait que 1320 × 2868.*

**On fournit deux jeux** :
- **1206 × 2622** (402 × 874 points @3x, iPhone 17 Pro) : obligatoire ;
- **1320 × 2868** (440 × 956 points @3x, iPhone 17 Pro Max) : pour les grands écrans.

**5 captures, thème clair, sans cadre d'appareil ni texte ajouté** (l'écran réel est notre argument de clarté) :
1. Séances : carte suggérée « Full body A » en accent, ligne « Cette semaine : 2 séances sur 3. »
2. Séance en cours : note « Charge proposée : 82,5 kg » et « Dernière fois ».
3. Séance en cours, minuteur de repos ouvert.
4. Récap avec un record (« Nouveau record en développé couché : 82,5 kg ! ») et un jalon (« 25ᵉ séance enregistrée. »).
5. Progrès : courbe du développé couché sur 8 semaines, phrase de progression.

**Données de démo** : `e2e/fixtures/demo-state.json`, 8 semaines d'historique réaliste (Full body, 3 séances par semaine, progression de 2,5 kg toutes les 2 semaines), date de référence fixe.

**Deux façons de les produire** :
- **Brouillon, sur Windows** : `scripts/store-screenshots.ts` (Playwright, déjà installé) charge le build web, injecte la démo dans le `localStorage`, fige l'horloge, et capture les 5 écrans aux deux tailles (`deviceScaleFactor: 3`), puis retire le canal alpha avec `sharp`. Sert à valider le cadrage et les données. Limite : pas de barre d'état iOS ni de zone sûre réelle.
- **Final, en CI macOS** (étape B.6) : la même démo est chargée dans le simulateur iOS (build `--mode screenshots`, qui charge la démo si le stockage est vide), barre d'état forcée (`xcrun simctl status_bar … override --time 9:41 --batteryLevel 100`), capture par `xcrun simctl io booted screenshot` sur iPhone 17 Pro et iPhone 17 Pro Max.

### Critères d'acceptation
1. `store/metadata.fr.md` existe ; un test vérifie les limites : nom ≤ 30, sous-titre ≤ 30, texte promotionnel ≤ 170, mots-clés ≤ 100 sans espace après les virgules, description ≤ 4 000.
2. `npm run screenshots` produit 10 fichiers : 5 en 1206 × 2622 et 5 en 1320 × 2868, PNG sans alpha (test d'en-tête), dans `store/screenshots/brouillon/`.
3. Les données de démo n'existent pas dans les builds `web` et `native` : le bundle ne contient pas le nom de fichier ni une chaîne propre à la démo (test sur `dist/`).
4. Aucune capture ne montre de texte de §9.3, de « ! » hors record, ni de séance vide.

---

## Ce qu'on ne fait pas dans ce lot (non-objectifs)

| On refuse | Pourquoi |
|---|---|
| Android / Play Store | iPhone d'abord. Ajoutable plus tard avec `@capacitor/android`, sans toucher à `src/platform/` |
| Notifications push, serveur, analytics, rapport de plantage tiers | Contraire à « aucune donnée collectée » et à l'étiquette « Aucune donnée collectée » |
| Notifications sur le web | Exige un service worker push, peu fiable sur iPhone. La fonction est cachée, pas imitée |
| Réglage « Garder l'écran allumé » | Un réglage de plus pour un cas rare. À ajouter si un utilisateur le demande |
| Rappels « intelligents » (heure apprise, relance après absence) | `identity.md` §9.3 : aucune relance, aucune notification non demandée |
| Bannière « Installez l'app » sur la PWA | Le web n'est pas une vitrine de l'app |
| HealthKit, widgets, Live Activity, Apple Watch | Bons arguments natifs, mais revue plus stricte (HealthKit) ou effort L. Gardés en plan B pour la règle 4.2 (§C) |
| Icônes sombres et teintées | Tant que la marque ne les a pas dessinées |
| Cadres d'appareil et slogans sur les captures | L'écran réel montre la clarté ; des slogans ajoutent du bruit |

---

# Partie B — Ce qui demande le propriétaire

Ordre conseillé. Les durées sont des ordres de grandeur constatés en 2026 ; Apple ne garantit aucun délai.

| # | Étape | Coût | Délai | Ce que l'équipe prépare à l'avance |
|---|---|---|---|---|
| B.1 | **Trancher les questions** de la fin de ce document (identifiant, contact, URL, Mac ou CI, pays, DSA) | 0 € | 1 jour | Ce document, avec un choix par défaut pour chaque question |
| B.2 | **Compte Apple** avec double authentification activée, sur un appareil Apple ou par le web | 0 € | 15 min | – |
| B.3 | **Inscription à l'Apple Developer Program**, en individuel (ton nom légal apparaîtra comme vendeur). Se fait au mieux depuis l'app Apple Developer sur iPhone, avec une pièce d'identité. Une entreprise demanderait un numéro D-U-N-S en plus | **99 € par an** | quelques heures à quelques jours (parfois 1 à 2 semaines si une vérification d'identité est demandée) | Rien : à lancer **dès maintenant**, c'est l'étape la plus longue et elle ne dépend pas du code |
| B.4 | **Accords** dans App Store Connect : seul l'accord des apps gratuites est nécessaire. Pas d'informations bancaires ni fiscales pour une app gratuite | 0 € | 10 min | – |
| B.5 | **Choisir où construire** : soit un **Mac** (Apple Silicon, macOS récent, Xcode 26 ou plus ; un Mac mini neuf coûte environ 700 €, un modèle M1 d'occasion environ 400 €), soit une **CI macOS dans le cloud** (runners macOS de GitHub Actions, gratuits pour un dépôt public, facturés à la minute pour un dépôt privé ; ou Codemagic, qui a une offre gratuite limitée en minutes). Un build iOS prend 10 à 15 min | 0 € (dépôt public ou offre gratuite) à quelques € par mois ; ou un Mac | 1 h de mise en place | Fichier de workflow CI (`.github/workflows/ios.yml`) : `npm ci`, `npm test`, `npm run build:native`, `xcodebuild archive`, export, envoi vers TestFlight, captures sur simulateur. Liste des secrets attendus |
| B.6 | **Signature** : créer une **clé d'API App Store Connect** (rôle Admin ou App Manager, fichier `.p8`, téléchargeable une seule fois) et l'enregistrer dans les secrets de la CI avec son Key ID et son Issuer ID. Enregistrer l'identifiant `fr.muscutrack.app` (Certificates, IDs & Profiles), sans capacité particulière (les notifications locales n'en demandent pas). La signature automatique d'Xcode crée le certificat de distribution et le profil | 0 € | 30 min | Workflow configuré pour la signature automatique par clé d'API ; procédure pas à pas avec captures d'écran ; premier passage qui génère `ios/` si Windows n'a pas pu le faire, et qui vérifie le rapport de confidentialité d'Xcode |
| B.7 | **Créer l'app dans App Store Connect** : nom (vérifie que « MuscuTrack » est libre ; sinon le repli de 4.9.1), langue principale français, identifiant de bundle, SKU `muscutrack-ios` | 0 € | 15 min | Valeurs prêtes dans `store/metadata.fr.md` |
| B.8 | **TestFlight** : installer TestFlight sur ton iPhone, t'ajouter comme testeur interne (aucune revue Apple pour les testeurs internes, build disponible quelques minutes après le traitement). Chaque build expire après 90 jours | 0 € ; un iPhone sous iOS 15 ou plus | 1 à 2 h de tests par build | **Liste de vérification sur appareil** : fin de repos écran verrouillé (son et bannière), rien au premier plan, feuille d'autorisation une seule fois, rappel reçu un jour choisi et absent après une séance, haptique à la validation et au record, écran qui ne s'éteint pas pendant 10 min de séance, export vers Fichiers puis réimport, **mise à jour de l'app par un nouveau build TestFlight sans perte de données**, mode sombre, Dynamic Type et VoiceOver sur le parcours lot 2 |
| B.9 | **Fiche App Store** : coller les textes, envoyer les 10 captures, catégorie, prix gratuit, disponibilité (pays : question 5), copyright | 0 € | 1 h | `store/metadata.fr.md` et les captures finales de la CI (4.9) |
| B.10 | **Classification par âge** : répondre au questionnaire 2026 (« Aucun » partout) | 0 € | 10 min | Les réponses attendues (4.9.1) |
| B.11 | **Étiquettes de confidentialité** : « Non, nous ne collectons pas de données » ; renseigner l'URL de confidentialité | 0 € | 10 min | Texte de 4.8 publié à l'URL publique ; preuve « aucune requête réseau » (test e2e 4.8) |
| B.12 | **Statut DSA (UE)** : obligatoire pour être distribué dans l'UE. Pour une app gratuite, sans revenu ni activité commerciale, le défaut est « non commerçant » : simple déclaration, sans vérification. Se déclarer commerçant obligerait à publier une adresse, un téléphone et un e-mail vérifiés par Apple, ce qui prend parfois plusieurs semaines en 2026. C'est une qualification juridique : c'est à toi de la faire | 0 € | 5 min (non commerçant) ; jusqu'à plusieurs semaines (commerçant) | Rappel au moment de l'envoi ; ce document ne vaut pas conseil juridique |
| B.13 | **Envoyer en revue** : choisir le build, coller les notes pour l'App Review (4.9.1), choisir la **publication manuelle** après acceptation | 0 € | revue en 24 à 48 h le plus souvent | Notes prêtes ; réponse type en cas de refus 4.2 (§C) |
| B.14 | **Publier** et répondre aux éventuels retours. Chaque mise à jour repasse par B.8 puis B.13 | 0 € | – | Procédure de mise à jour : incrémenter `MARKETING_VERSION`, relancer la CI |

Déjà traité dans le code, sans action du propriétaire : conformité à l'export de chiffrement (`ITSAppUsesNonExemptEncryption = false`, la question n'est plus posée), manifeste de confidentialité, icône.

**Coût total minimal la première année : 99 €.** Plus un Mac, ou quelques euros de CI si le dépôt est privé et dépasse l'offre gratuite.

---

# C. Comment ce lot répond au risque de refus au titre de la règle 4.2

**La règle** (« Minimum Functionality », texte actuel) : l'app doit inclure « des fonctions, du contenu et une interface qui l'élèvent au-delà d'un site web reconditionné ». En 2026, c'est toujours le premier motif de refus des apps emballées. Les retours publiés montrent deux choses : **la technique ne compte pas**, c'est l'expérience qui est jugée (Capacitor n'est ni un problème ni une protection), et **une fonction native isolée ne suffit pas** (un partage ou une position ajoutés à un site ont déjà été refusés).

**Notre réponse, en quatre points :**
1. **Ce n'est pas un site** : tout est dans le paquet, rien n'est chargé depuis le réseau (pas de `server.url`, test e2e « aucune requête »), aucun lien externe, aucune barre ou mention de navigateur, pas de service worker en natif, écran de lancement maîtrisé jusqu'au chargement des données. L'app marche en mode avion dès la première ouverture.
2. **Cinq comportements qu'un site ne peut pas offrir sur iPhone**, et **tous dans le parcours principal**, pas cachés dans les réglages : notification de fin de repos écran verrouillé (dès le premier minuteur), haptique à chaque série validée, écran maintenu allumé pendant la séance, haptique au record, export par la feuille de partage. Plus les rappels de séance choisis et le stockage dans le conteneur de l'app.
3. **Une utilité durable et immédiate** : le relecteur n'ouvre pas une app vide. Grâce au lot 2, il valide une série en 5 taps, et le minuteur et sa notification se déclenchent aussitôt. Les lots 1 et 3 apportent un vrai fond métier (charge proposée, records, rythme) qui n'est pas un simple formulaire.
4. **On le dit au relecteur** : les notes pour l'App Review (4.9.1) listent les fonctions natives et le chemin de test le plus court.

**Les règles voisines sont aussi couvertes** : 5.1.1 (v), pas de compte exigé ; 5.1.1 (i), politique dans l'app et dans la fiche ; 4.5.4, les notifications ne sont pas nécessaires au fonctionnement et ne servent jamais à la promotion ; 2.5.2, aucun code téléchargé ; 2.5.4, aucun mode d'arrière-plan déclaré (les notifications locales sont programmées à l'avance par iOS).

**Plan B si un refus 4.2 arrive quand même** :
1. Répondre dans le Centre de résolution avec une courte vidéo du parcours (série validée, notification écran verrouillé, haptique) et la liste du point 2. Délai : quelques jours.
2. Si le refus est maintenu, ajouter la fonction native la plus forte qui reste fidèle à l'identité : **enregistrer chaque séance terminée comme entraînement dans Santé (HealthKit)**, en écriture seule, désactivé par défaut. Effort M, avec une déclaration de confidentialité à compléter. Un widget « prochaine séance » vient ensuite (effort M).

---

## Questions pour le propriétaire

Pour chacune, le choix par défaut s'applique si tu ne réponds pas. Les questions 3, 4 et 6 de la roadmap restent valables et sont reprises ici.

1. **Identifiant de bundle et type de compte.** Par défaut : `fr.muscutrack.app`, compte individuel (ton nom légal s'affiche comme vendeur). L'identifiant ne pourra plus changer après la première publication.
2. **Adresse de contact et URL publique de la politique.** Par défaut : une adresse e-mail dédiée que tu crées (par exemple une adresse « muscutrack » chez ton fournisseur habituel), et la page `confidentialite.html` publiée avec la PWA sur GitHub Pages. Sans URL publique, la fiche ne peut pas être envoyée.
3. **Mac ou CI macOS ?** Par défaut, si tu n'as pas de Mac : GitHub Actions avec runner macOS (gratuit si le dépôt est public), signature par clé d'API App Store Connect.
4. **As-tu un iPhone pour TestFlight ?** Par défaut : oui, le tien. Sans iPhone, les notifications, l'haptique et la survie des données ne peuvent pas être vérifiées avant la revue ; c'est un risque que je déconseille.
5. **Dans quels pays publier ?** Par défaut : France, Belgique, Suisse, Luxembourg, Monaco et Canada, parce que l'app n'existe qu'en français.
6. **Statut DSA.** Par défaut : non commerçant (app gratuite, sans revenu). À confirmer par toi : c'est une qualification juridique.
7. **Nom sur le Store.** Par défaut : « MuscuTrack » s'il est libre, sinon « MuscuTrack · Carnet de muscu ».

---

Sources (consultées le 29 octobre 2026) :
- npm : `npm view` de chaque paquet listé en A.0 (versions, dates, dépendances paires)
- [Capacitor 8, guide de mise à jour (Xcode 26, iOS 15, Node 22, SPM par défaut)](https://capacitorjs.com/docs/updating/8-0)
- [Capacitor, Local Notifications (planification, autorisations, `presentationOptions`, demande automatique depuis 8.3.0)](https://capacitorjs.com/docs/apis/local-notifications)
- [App Store Connect, spécifications des captures](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Apple, exigences à venir et en vigueur (Xcode 26 et SDK iOS 26 depuis le 28 avril 2026, cible iOS 13 minimum depuis le 9 septembre 2026, manifestes, âge, DSA)](https://developer.apple.com/news/upcoming-requirements/)
- [App Store Review Guidelines (4.2, 4.5.4, 5.1.1, 2.5.2, 2.5.4)](https://developer.apple.com/app-store/review/guidelines/)
- [Apple, nouvelles classifications par âge](https://developer.apple.com/news/?id=ks775ehf)
- [App Store Connect, exigences DSA pour les commerçants](https://developer-mdn.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements)
- [Forum Apple Developer, vérifications DSA bloquées « In Review » en 2026](https://developer.apple.com/forums/thread/826151)
- [Forum Ionic, règle 4.2 et apps Capacitor](https://forum.ionicframework.com/t/apple-4-2-minimum-functionality/189688)
- [newly.app, refus pour fonctionnalité minimale](https://newly.app/guides/minimum-functionality-rejection)
- [Capgo, Xcode 26 pour les apps Capacitor](https://capgo.app/blog/xcode-26-requirement-for-capacitor-apps/)
