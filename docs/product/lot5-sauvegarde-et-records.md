# Lot 5 : filet de sauvegarde, record en séance, finitions

*Product owner, 30 octobre 2026. Ce lot vient après l'abandon de l'App Store (voir la note en tête de `vision-et-roadmap.md`) et après le lot « PWA au maximum » (commit ac0ca60 : export par la feuille de partage, écran allumé en séance, `storage.persist`, bip de fin de repos, aide à l'installation iPhone). Effort total : **M** (S + S + S). Ce document fait foi pour le lot 5.*

Lu avant d'écrire : `docs/identity.md` (§2, §3, §4.1, §4.2, §6 Mouvement, §9), `lot3-rythme.md` (format, §3.2, §12), `vision-et-roadmap.md` (« Plus tard » : record annoncé pendant la séance), `docs/review-2026-10-30-lot3-verif.md` (remarques mineures et hors lot), les revues `docs/review-2026-10-2*.md` (sections « Améliorations priorisées »), `src/pages/SettingsPage.tsx` (`doExport`, `copy`), `src/lib/webPlatform.ts` (`shareTextFile`), `src/pages/ActiveSessionPage.tsx` (`validate`, `feedback`, `.session-dock`), `src/pages/SessionSummaryPage.tsx`, `src/pages/TemplatesPage.tsx`, `src/lib/stats.ts` (`detectNewRecords`, `strongestRecords`, `countedSessions`), `src/lib/format.ts` (`formatRecordSentence`, `formatLastDone`, `formatPeriodSummary`, `calendarDaysBetween`), `src/lib/types.ts`, `src/lib/storage.ts`.

---

## 1. Objectif

L'app vit sur un seul téléphone, sans compte ni serveur, et c'est voulu. Ce lot fait trois choses :
1. **Ne pas perdre ce qu'on a construit** : savoir quand on a exporté pour la dernière fois, et recevoir un rappel discret, au bon moment et jamais culpabilisant.
2. **Voir son record au moment où il tombe** : un signal sobre dans la zone de retour du bas d'écran, quand la série validée bat un record.
3. **Finitions** : l'écran Séances sans séance type mais avec un historique, et la ligne de bilan qui laisse « 3 records. » seul à la ligne.

Rien de ce lot ne prend l'accent. Chaque écran garde la même action principale.

### User stories
- **US5.1** En tant que pratiquant, je veux savoir quand j'ai exporté mes données pour la dernière fois, pour savoir ce que je risque si je perds mon téléphone.
- **US5.2** En tant que pratiquant, je veux qu'on me propose de sauvegarder quand j'ai assez de séances non sauvegardées, sans être harcelé, pour ne pas perdre mon historique.
- **US5.3** En tant que pratiquant, je veux pouvoir couper ce rappel, parce que c'est moi qui décide.
- **US5.4** En tant que pratiquant, je veux voir tout de suite qu'une série vient de battre un record, pour profiter du moment sans attendre le récap.
- **US5.5** En tant que pratiquant qui a supprimé ses séances types, je veux que l'écran Séances ne me dise pas que je n'ai rien fait.

---

## 2. Rappel de sauvegarde

### 2.1 Décisions de fond
- **Le rappel compte des séances, pas des jours.** Le danger, c'est le nombre de séances qui n'existent que sur le téléphone, pas le temps qui passe. Quelqu'un qui n'est pas venu depuis 3 semaines n'a rien de neuf à perdre : il ne voit **aucun** rappel. On ne risque donc jamais un message du type « ça fait 20 jours » (identity §9.3, relances ; §9.4.4, mauvais jour).
- **Le rappel ne vit que sur le récap**, juste après une séance comptée. On vient d'ajouter quelque chose, on est au calme, et l'export prend un tap. Jamais sur Séances (l'écran d'avant la séance, qui doit rester tourné vers « Démarrer la séance »), jamais sur Progrès, jamais en notification.
- **Refus** : « Plus tard » sur la carte, qui la fait revenir après 6 nouvelles séances (le libellé dit vrai : on redemande, identity §4.1). Pour un refus définitif, un interrupteur « Rappel de sauvegarde » dans Réglages, activé par défaut (identity §9.4.2).
- **Reformulation** de la demande : « Jamais exporté » devient « Aucun export pour l'instant. », pour avoir une phrase avec un sujet et le même ton que « Aucune séance pour l'instant. ».

### 2.2 Données mémorisées
Une clé `localStorage` dédiée, **hors de l'état de l'app et hors de l'export**, comme `muscutrack:repos` et `muscutrack:progres-exercice` : `muscutrack:sauvegarde`, qui contient le JSON `{ lastExportAt?: string, importedAt?: string, reminderSnoozedAt?: string }` (dates ISO).
- On ne met pas ces dates dans `AppState`. Si elles y étaient, le fichier exporté contiendrait la date de l'export *précédent*, et un import sur un autre téléphone ramènerait des dates fausses. Elles décrivent cet appareil, pas les données.
- Lecture impossible, JSON invalide ou valeur qui n'est pas une date : on fait comme si la clé était vide. Jamais d'exception, jamais de message.
- Écriture impossible (stockage plein) : on ignore l'erreur. Le rappel pourra réapparaître, ce qui est sans gravité.
- **Réinitialisation** (`data/reset`, bouton « Tout effacer ») : la clé est supprimée, comme `clearStoredExercise()`.
- Module pur suggéré : `src/lib/backup.ts` (lecture et écriture de la clé avec un stockage injectable, calculs du §2.3, avec `now` en paramètre).

### 2.3 Règles
- **Export réussi** : on pose `lastExportAt = now` quand l'un de ces cas se produit :
  - la feuille de partage renvoie `'shared'` ;
  - le téléchargement de repli a été déclenché (`downloadText` renvoie `true`) ;
  - le bouton « Copier » a réussi (`navigator.clipboard.writeText` résolu).

  Ne comptent pas : la feuille fermée sans choix (`'cancelled'`), le cas « Téléchargement indisponible » tant que la copie n'a pas réussi, et la copie manuelle après échec du presse-papiers (on ne peut pas savoir si elle a eu lieu).
- **Import réussi** (`replaceState` renvoie `true`) : on pose `importedAt = now`. Les données importées existent par définition dans un fichier. `lastExportAt` n'est pas modifié, et la ligne de Réglages continue de parler du dernier *export*.
- **Date de référence** = la plus récente de `lastExportAt` et `importedAt`. Elle peut être absente.
- **Séances non sauvegardées** : `unsavedCount` = nombre de séances **comptées** (`countedSessions` : terminées, au moins une série validée) dont `startedAt` est postérieur à la date de référence. Sans référence, ce sont toutes les séances comptées.
- **Seuil : `BACKUP_REMINDER_THRESHOLD = 6`**, soit environ 2 semaines à 3 séances par semaine.
- **La carte de rappel s'affiche sur le récap de la séance S** si et seulement si :
  1. le réglage « Rappel de sauvegarde » est activé (`settings.backupReminder !== false`) ;
  2. S est comptée **et** S est la séance comptée la plus récente (par `startedAt`). Un récap rouvert plus tard d'une séance plus ancienne n'affiche rien ;
  3. `unsavedCount ≥ 6` ;
  4. si `reminderSnoozedAt` existe, au moins 6 séances comptées ont `startedAt` postérieur à `reminderSnoozedAt`.
- Toutes les conditions sont recalculées à chaque rendu. Un export fait ailleurs fait disparaître la carte.

### 2.4 Textes exacts
Tous passent par `format.ts` : insécable avant « : » (`COLON`) et avant les unités (`formatCount`), apostrophes typographiques, aucun « ! », aucun emoji, aucun nombre de jours dans la carte.

**Réglages, ligne d'état** — `formatLastExport(lastExportAt, now)` (mêmes paliers que `formatLastDone`) :

| `lastExportAt` (jours calendaires avant `now`) | Texte |
|---|---|
| absent | « Aucun export pour l’instant. » |
| 0 | « Dernier export : aujourd’hui. » |
| 1 | « Dernier export : hier. » |
| 5 | « Dernier export : il y a 5 jours. » |
| 13 | « Dernier export : il y a 13 jours. » |
| 14 à 59 (ex. 21) | « Dernier export : il y a 3 semaines. » |
| 60 et plus (ex. 125) | « Dernier export : il y a 4 mois. » |

Suivie, **seulement si un export existe et que des séances comptées ont `startedAt` > `lastExportAt`**, de `formatSinceExport(n)` :
- n = 1 : « 1 séance enregistrée depuis. »
- n = 4 : « 4 séances enregistrées depuis. »
- n = 0 : rien.

Rendu : « Dernier export : il y a 12 jours. 4 séances enregistrées depuis. »

**Réglages, interrupteur**
- Libellé : « Rappel de sauvegarde »
- Aide : « Après 6 séances sans export, le récap te propose d’en faire un. Jamais de notification. »

**Récap, carte de rappel** — `formatBackupReminder(unsavedCount, hasReference)` :
- Ligne 1 (texte principal, 16 px / 500) :
  - sans date de référence : « Tes 8 séances n’existent que sur ce téléphone. »
  - avec une date de référence : « Tes 6 dernières séances n’existent que sur ce téléphone. »
- Ligne 2 (texte secondaire, 16 px / 400) : « Exporte une copie pour les garder en cas de perte ou de changement de téléphone. »
- Bouton 1 : « Exporter mes données », avec l'icône Lucide `Share` (20 px, `aria-hidden`).
- Bouton 2 : « Plus tard ».
- Après un export réussi, la carte ne montre plus que « Copie exportée. » (`role="status"`), sans bouton, jusqu'à ce qu'on quitte le récap.
- Si l'export est impossible ici (ni partage ni téléchargement) : « Export impossible depuis cet écran. Ouvre Réglages pour copier tes données. », suivi d'un lien-bouton « Ouvrir Réglages » (`/reglages`).

Pourquoi ces mots : la carte dit un fait (« n'existent que sur ce téléphone ») et ce qu'on y gagne. Elle ne contient ni « risque », ni « perdu », ni « toujours pas », ni de durée.

### 2.5 Où et comment
**Réglages, section « Sauvegarde »** (de haut en bas) :
1. le texte existant (« Tes données sont stockées uniquement sur cet appareil… »), inchangé ;
2. **la ligne d'état** (§2.4), texte secondaire 16 px, classe `settings-section__text`. Elle se met à jour tout de suite après un export réussi (« Dernier export : aujourd’hui. ») ;
3. l'aide à l'installation iPhone (inchangée) ;
4. « Exporter mes données » (accent, inchangé), puis le message et la zone de texte existants ;
5. **l'interrupteur « Rappel de sauvegarde »** et son aide, même composant que « Son en fin de repos » (`switch-row`, `role="switch"`).

**Récap** : la carte se place **en fin de contenu**, après la liste des exercices et le bouton « Mettre à jour la séance type », juste avant le dock « Voir mes progrès ». Elle reste discrète et passe après les records.
- Carte `card` ordinaire, sans bordure ni fond accent, sans icône d'alerte.
- « Exporter mes données » : `btn btn--block` (contour 1 px `--border`, 48 px), **pas** `btn--primary` : « Voir mes progrès » reste le seul aplat accent du récap.
- « Plus tard » : `btn` à contour, largeur au contenu, aligné à gauche, 8 px au-dessus (comme « Non merci » au lot 3).
- « Exporter mes données » lance **le même export que Réglages**. On extrait `doExport` et `downloadText` de `SettingsPage` dans un module partagé (par exemple un hook `useExport()`), appelé directement dans le geste (exigence de la feuille de partage). Résultats :
  - partage réussi ou téléchargement déclenché → `lastExportAt = now`, la carte devient « Copie exportée. » ;
  - feuille fermée sans choix → rien ne change, rien ne s'affiche ;
  - ni partage ni téléchargement possible → texte « Export impossible… » et « Ouvrir Réglages ».
- « Plus tard » → `reminderSnoozedAt = now`, la carte disparaît, **sans toast**.

### 2.6 Persistance des réglages
- `AppSettings` gagne `backupReminder?: boolean`. Absent = activé. Désactiver pose `false`, réactiver **retire** le champ (comme `restSound`).
- Action suggérée : `settings/setBackupReminder`.
- Export : le champ est dans `settings`, exporté avec le reste, `version` reste `1`.
- Import (`parseSettings`) : absent → accepté. Présent et non booléen → l'import échoue avec un message qui cite `settings.backupReminder`.
- Les dates du §2.2 ne sont **jamais** exportées.

---

## 3. Record annoncé pendant la séance

### 3.1 Règle
On reprend la même définition que le récap : `strongestRecords(detectNewRecords(séance, historique))`, soit un record au plus par exercice (poids max, sinon 1RM estimé, sinon volume), par rapport aux séances terminées commencées avant la séance en cours. Un exercice jamais fait ne produit aucun record. Le récap et l'annonce ne peuvent donc pas se contredire.

À la validation d'une série de l'exercice E (`validate`, **pas** `saveCorrection`) :
- `avant` = record le plus fort de E calculé sur la séance **avant** la validation, `après` = le même calcul **après** ;
- **on annonce `après`** si `après` existe et que l'une de ces conditions est vraie :
  - `avant` n'existe pas ;
  - le type de `après` est plus fort dans `RECORD_PRIORITY` (par exemple, on passe d'un record de volume à un record de poids max) ;
  - même type, valeur plus haute, **et** ce type est le poids max ou le 1RM estimé.
- **Le volume n'est annoncé qu'une fois par exercice et par séance**, au moment où il dépasse l'ancien meilleur. Sinon, chaque série suivante le referait monter et l'annonce se répéterait.
- Un poids max qui remonte encore dans la même séance (85 kg, puis 87,5 kg) est annoncé à nouveau : c'est un vrai nouveau record.
- Fonction pure suggérée, testée sans écran : `recordGainedBy(before: WorkoutSession, after: WorkoutSession, history: WorkoutSession[], exerciseId: string): NewRecord | undefined`, dans `stats.ts`.
- Une correction (« Enregistrer la correction ») n'annonce rien, même si elle crée un record. Le récap le montrera.

### 3.2 Texte exact
Même phrase et même formatage que le récap (`formatRecordSentence`, avec les libellés `RECORD_KINDS` déplacés de `SessionSummaryPage` vers `format.ts` pour être partagés) :
- « Nouveau record en squat : 85 kg ! »
- « Nouveau record de 1RM estimé en développé couché : 92,5 kg ! » (valeur arrondie comme `formatOneRepMax`)
- « Nouveau record de volume en rowing barre : 2 480 kg ! »

C'est le seul « ! » de l'écran de séance (identity §3). Insécable avant « : » et espace fine insécable avant « ! » (déjà dans `formatRecordSentence`).

### 3.3 Où, combien de temps, quel style
- **Dans le dock**, au-dessus de la ligne de retour existante, à l'intérieur du **même** élément `role="status"`, pour que les lecteurs d'écran annoncent : « Nouveau record en squat : 85 kg ! Série 2 validée. Repos : 90 s. »
- Deux lignes visibles :
  - ligne 1 : `.session-dock__record`, 16 px / 600, **texte en couleur succès** (`--success`), centrée, 2 lignes au plus ;
  - ligne 2 : le retour actuel, inchangé (« Série 2 validée. Repos : 90 s. » ou « Exercice terminé : squat. Repos : 90 s. »).
- **Aucun aplat.** Ni fond vert ni fond accent, aucune bordure colorée, aucune icône (pas de trophée : identity §9.3). Le vert est autorisé ici en texte seulement (identity §9.2, ligne « Record »). Le contraste de `--success` sur `--bg` reste ≥ 4,5:1 en clair et en sombre.
- **Mouvement** : un « pulse » unique sur la ligne 1, de 180 ms (`scale` 1 → 1,04 → 1, `ease-out`). Rien sous `prefers-reduced-motion: reduce`. La ligne de série faite garde sa coche animée habituelle, rien de plus.
- **Durée** : la ligne vit exactement comme le retour actuel. Elle disparaît à la prochaine validation (remplacée, ou ré-annoncée s'il y a un nouveau record), au changement d'exercice (« Précédent » / « Suivant »), au tap « Corriger », à l'ajout d'un exercice et à toute suppression. Pas de minuterie propre : un record ne s'efface pas tout seul pendant qu'on reprend son souffle.
- **Son : aucun.** identity §9.3 interdit les sons de victoire, et le bip de fin de repos doit garder un seul sens.
- **Haptique : aucune.** `navigator.vibrate` n'existe pas dans Safari iOS, l'appareil du propriétaire. Sur Android, une vibration serait un signal de plus, sans équivalent sur iPhone.
- L'action principale (« Valider la série », 56 px, accent) ne bouge pas et reste le seul aplat accent de l'écran.

---

## 4. Finitions

### 4.1 Séances sans séance type, avec un historique
*Revue `review-2026-10-30-lot3-verif.md`, « Hors lot ».* Aujourd'hui, quelqu'un qui a supprimé toutes ses séances types lit « Aucune séance pour l'instant. », ce qui peut se comprendre comme « tu n'as rien fait ».
- **Condition** : `state.templates.length === 0` **et** `state.sessions.length > 0` (au moins une séance dans l'Historique, comptée ou non).
- Textes (`TemplatesPage`, état vide) :
  - titre : « Ta liste de séances est vide. »
  - texte : « Tes séances passées restent dans l’Historique. Reprends un programme ou crée une séance. »
- Le bouton « Choisir un programme » (accent, pleine largeur) et la pile secondaire (« Créer une séance », « Séance libre ») ne changent pas. La ligne de semaine au-dessus reste inchangée.
- **Sans historique** (nouvel utilisateur), l'état vide reste mot pour mot celui d'identity §3 : « Aucune séance pour l’instant. » / « Commence avec un programme ou crée la tienne. »

### 4.2 « 3 records. » seul à la ligne
*Revue `review-2026-10-30-lot3-verif.md`, remarque mineure n° 1.* « Semaine dernière : 3 séances, 7 050 kg, 3 records. » se coupe à 390 px avant « 3 records. ».
- Dans `formatPeriodSummary`, **le séparateur placé avant le dernier segment** devient `,` suivi d'une espace insécable (`,${NBSP}`) quand la ligne a au moins 2 segments. Les autres séparateurs restent `, `.
- La coupure, s'il en faut une, tombe donc avant l'avant-dernier segment : « Semaine dernière : 3 séances, / 7 050 kg, 3 records. ». Le dernier chiffre n'est jamais seul.
- La règle vaut aussi pour la ligne du mois (« Octobre : 4 séances, 14 750 kg, 4 records. »). Le texte visible est inchangé.

### 4.3 Remarques des revues précédentes examinées
J'ai relu les « Améliorations priorisées » de toutes les revues. Les points bloquants et S ont été traités dans leurs lots : toasts nommés, « Faite il y a… », correction de série, « Série en plus », navigation sur une ligne, refus à contour, etc. Je ne fais entrer dans ce lot que les deux points ci-dessus. Le reste est volontairement laissé de côté :
- **Le « 1 » de Space Grotesk en chiffres tabulaires** (`review-2026-10-29-amethyste.md`, n° 5) : la revue elle-même demandait d'attendre un test à bout de bras sur un vrai téléphone. Le propriétaire utilise maintenant l'app tous les jours : voir la question 2 du §8.
- **« Poids du corps » sous « 0 kg »** (`review-2026-10-28-lot2.md`, pour mémoire) : à faire seulement si quelqu'un s'y trompe. Personne ne l'a signalé.
- **Légende « 3 programmes prêts… » dans l'état vide** (`review-2026-10-29-lot2.md`, n° 8, optionnel) : écartée. L'état vide du nouvel utilisateur reste celui d'identity §3, et le §4.1 touche déjà à cet écran.
- **Taille de « 102,5 » dans le constructeur** (`review-2026-10-29-lot1.md`, n° 6, « pas urgent ») : hors lot, à reprendre si le constructeur est retravaillé.

---

## 5. Cas limites

| Cas | Comportement |
|---|---|
| **Nouvel utilisateur, 5 séances, aucun export** | Pas de carte (seuil 6). Réglages : « Aucun export pour l’instant. » |
| **6ᵉ séance comptée, aucun export** | Récap : « Tes 6 séances n’existent que sur ce téléphone. » + boutons. |
| **Export, puis 3 séances** | Pas de carte. Réglages : « Dernier export : il y a 9 jours. 3 séances enregistrées depuis. » |
| **Absent 3 semaines, aucune séance depuis le dernier export** | Aucun rappel nulle part (rien de neuf à sauvegarder). |
| **« Plus tard » à 6 séances non sauvegardées** | Carte retirée. Elle revient au récap de la 12ᵉ séance non sauvegardée (6 séances après le report) : « Tes 12 dernières séances… » (ou « Tes 12 séances… » sans référence). |
| **Feuille de partage fermée sans choix** | Rien ne change : carte toujours là, `lastExportAt` inchangé, aucun message. |
| **Séance terminée sans série validée** | Non comptée : pas de carte sur son récap, et elle n'entre pas dans `unsavedCount`. |
| **Récap rouvert d'une séance plus ancienne** | Pas de carte (condition 2 du §2.3). |
| **Import réussi** | `importedAt = now`. Pas de carte avant 6 nouvelles séances comptées. La ligne de Réglages ne change pas (elle parle du dernier export de cet appareil). |
| **Réinitialisation** | Clé `muscutrack:sauvegarde` supprimée : « Aucun export pour l’instant. », rappel réactivé par défaut. |
| **Rappel désactivé dans Réglages** | Plus jamais de carte. La ligne d'état reste affichée. |
| **Horloge reculée (`lastExportAt` dans le futur)** | `calendarDaysBetween` borne à 0 : « Dernier export : aujourd’hui. » Les séances dont `startedAt` est antérieur ne sont pas comptées comme non sauvegardées. |
| **Record de poids sur la série 1, puis même charge en série 2** | Annonce en série 1 seulement. |
| **85 kg en série 2, puis 87,5 kg en série 3 (records tous les deux)** | Deux annonces : « … 85 kg ! », puis « … 87,5 kg ! ». |
| **Record de volume franchi en série 3, séries 4 et 5 en plus** | Une seule annonce, en série 3. |
| **Exercice jamais fait** | Aucune annonce (même règle que le récap). |
| **Dernière série de la séance qui bat un record** | Annonce dans le dock, sans repos ; elle reste jusqu'à « Terminer la séance ». Le récap montre le même record. |
| **Record sur la dernière série d'un exercice (passage au suivant)** | La ligne record reste affichée sur l'exercice suivant avec « Exercice terminé : squat. Repos : 90 s. ». Le nom de l'exercice est dans la phrase, il n'y a donc pas d'ambiguïté. |
| **Séances supprimées jusqu'à zéro séance type, historique conservé** | État vide du §4.1. |

---

## 6. Critères d'acceptation

**Calcul (`backup.ts`, `stats.ts`, `now` fixé, stockage injecté)**
1. `unsavedCount` ne compte que les séances comptées dont `startedAt` > max(`lastExportAt`, `importedAt`), et toutes les séances comptées sans référence. Une séance terminée sans série validée n'est jamais comptée.
2. `shouldShowBackupReminder` est vrai pour 6 séances non sauvegardées et faux pour 5. Faux si `settings.backupReminder === false`, faux si la séance du récap n'est pas la dernière séance comptée, faux après un report tant que 6 séances comptées n'ont pas suivi `reminderSnoozedAt`.
3. Clé `muscutrack:sauvegarde` absente, JSON invalide ou dates invalides → traitée comme vide, sans exception. Écriture qui lève une exception → ignorée.
4. `recordGainedBy` : série 1 à 85 kg (ancien max 82,5) → `maxWeight 85` ; série 2 à 85 kg → `undefined` ; série 3 à 87,5 kg → `maxWeight 87,5`. Volume franchi en série 3 sans record de poids ni de 1RM → `bestVolume` en série 3, puis `undefined` en séries 4 et 5. Exercice sans historique → `undefined`. Sur une séance entière, le dernier record annoncé pour chaque exercice a le même type que celui du récap (`strongestRecords(detectNewRecords(...))`).

**Textes (`format.test.ts`)**

5. `formatLastExport` produit exactement les 7 textes du tableau du §2.4, avec `NBSP` avant « : » et entre le nombre et l'unité.
6. `formatSinceExport(1)` = « 1 séance enregistrée depuis. », `formatSinceExport(4)` = « 4 séances enregistrées depuis. », `formatSinceExport(0)` = `undefined`.
7. `formatBackupReminder(8, false)` = « Tes 8 séances n’existent que sur ce téléphone. », `formatBackupReminder(6, true)` = « Tes 6 dernières séances n’existent que sur ce téléphone. ».
8. Aucun texte du rappel ne contient « ! », « % », « jour », « semaine », « perdu », « risque », « toujours pas » ni « oublié » (test qui balaie n = 6 à 60, avec et sans référence).
9. `formatPeriodSummary('Semaine dernière', { count: 3, volume: 7050, records: 3 })` = `Semaine dernière~: 3~séances, 7~050~kg,~3~records.` (`~` = U+00A0 : seule l'espace après la dernière virgule devient insécable). Une ligne à 1 segment ne change pas.

**Réglages**

10. Sans export : « Aucun export pour l’instant. » sous le texte de la section Sauvegarde. Après un partage réussi (mock `navigator.share` résolu) : « Dernier export : aujourd’hui. » tout de suite, et après rechargement.
11. Feuille fermée (`AbortError`) → la ligne ne change pas. Téléchargement de repli déclenché → la ligne passe à « aujourd’hui ». « Copier » réussi → « aujourd’hui ». Échec du presse-papiers → inchangée.
12. Interrupteur « Rappel de sauvegarde » : activé par défaut, `role="switch"`, ≥ 48 px. Le désactiver pose `settings.backupReminder: false`, le réactiver retire le champ. L'état survit à un rechargement et à un export suivi d'un import. `backupReminder: "non"` fait échouer l'import avec un message qui cite `settings.backupReminder`.
13. Import réussi → `importedAt` posé, la ligne de Réglages est inchangée. Réinitialisation → clé supprimée, « Aucun export pour l’instant. ».

**Récap**

14. 6ᵉ séance comptée sans export : la carte affiche les deux lignes du §2.4 et les boutons « Exporter mes données » et « Plus tard », après la liste des exercices et avant le dock. 5ᵉ séance : pas de carte.
15. « Exporter mes données » est un bouton à contour, sans `btn--primary`. Le récap compte exactement 1 aplat accent (« Voir mes progrès »), en clair et en sombre.
16. Partage réussi depuis la carte → « Copie exportée. » (`role="status"`), plus aucun bouton dans la carte, `lastExportAt` posé. Au récap suivant, pas de carte.
17. « Plus tard » → carte retirée sans toast, toujours absente après rechargement. Elle revient au récap de la 6ᵉ séance comptée suivante.
18. Récap rouvert (par l'URL) d'une séance qui n'est pas la dernière comptée → pas de carte.

**Séance**

19. Squat avec un historique à 82,5 kg max : valider une série à 85 kg affiche dans le dock « Nouveau record en squat : 85 kg ! » au-dessus de « Série 1 validée. Repos : 90 s. », dans un seul élément `role="status"`. La série suivante à 85 kg n'affiche pas de ligne record.
20. La ligne record a une couleur calculée égale à `--success`, aucun fond (transparent), aucune icône, et une taille de 16 px. L'écran compte toujours exactement 1 aplat accent (« Valider la série »).
21. Avec `prefers-reduced-motion: reduce`, aucune animation sur la ligne record. Sinon, une seule animation, ≤ 200 ms.
22. La ligne record disparaît après « Suivant », « Précédent », « Corriger » et à la validation suivante sans record. Elle n'apparaît pas après « Enregistrer la correction ».
23. Aucun son ni aucune vibration n'est déclenché par un record (espions sur `AudioContext` / `restChime` et `navigator.vibrate`).
24. À 375 × 667, « Nouveau record de 1RM estimé en développé couché : 92,5 kg ! » tient sur 2 lignes au plus, sans débordement horizontal, et « Valider la série » reste entièrement visible.

**Séances**

25. 0 séance type et 1 séance ou plus dans l'Historique : « Ta liste de séances est vide. » et « Tes séances passées restent dans l’Historique. Reprends un programme ou crée une séance. », « Choisir un programme » en accent. 0 séance type et historique vide : textes d'identity §3 inchangés (les tests existants qui attendent « Aucune séance pour l’instant. » sur un état neuf passent toujours).

**Progrès**

26. Profil (b) de la revue du 30/10, à 390 × 844 puis à 375 × 667 : aucune ligne rendue du bilan ne se compose seulement de « N records. » ou de « N record. ».

**Design**

27. Mêmes contrôles que les revues précédentes sur Séances, séance, récap, Réglages et Progrès, en clair et en sombre, à 390 × 844 : cibles ≥ 48 px, un seul aplat accent par écran, aucun texte < 13 px, aucun débordement horizontal, console propre.

---

## 7. Non-objectifs du lot 5

- **Pas de sauvegarde automatique ni de cloud** (iCloud, Google Drive, serveur) : pas de compte, pas de serveur, aucune donnée collectée. L'export par la feuille de partage permet déjà d'envoyer le fichier vers Fichiers / iCloud Drive, au choix de l'utilisateur.
- **Pas de rappel en notification**, ni pour la sauvegarde ni pour les séances. Sur iPhone, une PWA installée ne reçoit des notifications que par Web Push, qui demande un serveur. Les rappels de séance du lot 4 sont suspendus avec lui.
- **Pas de rappel ailleurs que sur le récap** : ni bannière sur Séances, ni pastille sur l'onglet, ni badge sur « Réglages ».
- **Pas de durée dans le rappel** (« il y a 20 jours ») : la durée n'apparaît que dans la ligne d'état de Réglages, qu'on consulte volontairement.
- **Pas de marque persistante sur la série record** (étiquette « Record » sur la ligne faite) : l'annonce du dock et le récap suffisent, et une étiquette de plus chargerait la liste des séries.
- **Pas de son, de vibration, de confettis ni de trophée** pour un record (identity §9.3).
- **Pas d'export automatique à la fin de la séance** : la feuille de partage s'ouvre seulement sur un tap.

---

## 8. Questions pour le propriétaire

1. **Seuil du rappel à 6 séances non sauvegardées ?** Par défaut : 6, soit environ 2 semaines à ton rythme. Plus bas, la carte deviendrait une habitude qu'on ne lit plus.
2. **Le « 1 » des chiffres (minuteur « 01:00 », tuile « 11 ») se lit-il bien à bout de bras sur ton iPhone ?** Par défaut : on ne change rien. Si tu hésites en salle, on traitera le point n° 5 de la revue Améthyste dans un lot suivant.
3. **Export en un tap depuis le récap, ou simple lien vers Réglages ?** Par défaut : en un tap (§2.5). C'est le même export, partagé avec Réglages.

---

## 9. Évolutions de l'identité (à appliquer à `docs/identity.md` avec l'implémentation)

Elles précisent des règles existantes et n'en assouplissent aucune.
1. **§9.2, nouvelle ligne « Rappel de sauvegarde »** :
   - Forme autorisée : « Une carte sans accent, sur le récap seulement, après 6 séances comptées non sauvegardées. Compte des séances, jamais des jours. "Plus tard" redemande 6 séances après ; l'interrupteur de Réglages coupe le rappel. »
   - Exemple de texte : « Tes 6 dernières séances n’existent que sur ce téléphone. »
2. **§9.2, ligne « Record »**, colonne forme : ajouter « Annoncé aussi en séance, dans la zone de retour du bas d'écran, en texte vert sans aplat ni icône, sans son ni vibration. Même définition que le récap. »
3. **§3, exemples** : ajouter « Séances, liste vide avec un historique : « Ta liste de séances est vide. Tes séances passées restent dans l’Historique. Reprends un programme ou crée une séance. » ».
