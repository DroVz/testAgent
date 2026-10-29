# Lot 3 : ton rythme (objectif hebdo choisi, bilan, jalons)

*Product owner, 29 octobre 2026. Ce document précise le lot 3 de `vision-et-roadmap.md`. Il remplace le détail qui s'y trouvait. En cas d'écart entre les deux, ce document fait foi.*

Lu avant d'écrire : `docs/identity.md` (§2, §3, §4, §5, §6, §9), `vision-et-roadmap.md` (lot 3 du 28 octobre, révisions du lot 1 du 29 octobre), `lot2-programmes.md`, `src/lib/stats.ts` (`startOfWeek`, `startOfMonth`, `sessionsThisWeek`, `sessionsThisMonth`, `completedSessions`, `detectNewRecords`, `strongestRecords`, `sessionVolume`), `src/lib/session.ts` (`finishSession`), `src/lib/types.ts` (`AppSettings`), `src/lib/storage.ts` (`parseSettings`), `src/lib/format.ts`, `src/pages/ProgressPage.tsx`, `src/pages/TemplatesPage.tsx`, `src/pages/SessionSummaryPage.tsx`, `src/pages/SettingsPage.tsx`.

---

## 1. Objectif

Donner un repère pour revenir, que **l'utilisateur choisit lui-même**, et lui montrer le chemin parcouru. On montre ce qui est fait, jamais ce qui manque : une semaine sous l'objectif ne laisse **aucune trace**, nulle part, ni sur le moment ni après.

Le lot ajoute 4 éléments, tous en texte ou en encre, aucun en accent :
1. un **objectif par semaine**, « Aucun » par défaut, réglable dans Réglages ou proposé une fois sur Progrès ;
2. une **ligne de semaine** sur Séances et sur le récap ;
3. des **pastilles** dans la tuile « Cette semaine » de Progrès, et un **bilan** (semaine dernière, mois) sous les tuiles ;
4. des **jalons** dans le récap (1ʳᵉ, 10ᵉ, 25ᵉ, 50ᵉ, 100ᵉ séance…).

### User stories
- **US3.1** En tant que pratiquant, je veux choisir combien de séances je vise par semaine, pour avoir un repère réaliste.
- **US3.2** En tant que pratiquant, je veux voir où j'en suis dans ma semaine, pour décider d'aller m'entraîner.
- **US3.3** En tant que pratiquant, je veux un bilan de ma semaine passée et de mon mois, pour voir le chemin parcouru.
- **US3.4** En tant que pratiquant, je veux qu'on marque les étapes (10ᵉ séance, etc.), sans fanfare.
- **US3.5** En tant que pratiquant qui n'a pas pu venir, je veux que l'app ne me le reproche pas, pour avoir envie de revenir.

---

## 2. Règles de calcul

Tout le calcul vit dans un module pur, par exemple `src/lib/rhythm.ts`, testé sans écran. Chaque fonction reçoit `now: Date` en paramètre (défaut `new Date()`).

### 2.1 Séance comptée
**Une séance comptée est une séance terminée (`endedAt` présent) avec au moins une série validée** (`countDoneSets(s) > 0`).
- Aujourd'hui, `finishSession` peut enregistrer une séance vide (on ouvre une séance libre puis on la termine tout de suite). Elle reste dans l'Historique, mais elle **ne compte pas** : ni dans l'objectif, ni dans le bilan, ni dans les jalons.
- Une séance abandonnée n'est jamais enregistrée, donc jamais comptée (inchangé).
- La séance en cours ne compte pas tant qu'elle n'est pas terminée.
- Fonction suggérée : `countedSessions(sessions)`, qui filtre `completedSessions(sessions)` et garde l'ordre chronologique.
- **Changement assumé sur l'existant** : les trois tuiles de Progrès (« Séances », « Cette semaine », « Ce mois ») passent à cette définition. `sessionsThisWeek` et `sessionsThisMonth` filtrent désormais les séances comptées. Une séance vide n'y apparaissait que par accident.

### 2.2 Semaine et mois
- **Semaine : du lundi 00:00 au lundi suivant 00:00 (exclu), heure locale de l'appareil.** C'est `startOfWeek` tel qu'il existe ; la fin est `startOfWeek + 7 jours` calculée avec `setDate` (pas `+ 7 × 24 h`), pour rester juste aux changements d'heure.
- **Mois : du 1er à 00:00 au 1er du mois suivant (exclu), heure locale.** C'est `startOfMonth` tel qu'il existe.
- **Une séance appartient à la période qui contient son `startedAt`**, comme aujourd'hui dans `countBetween`. Une séance commencée dimanche 23:30 et terminée lundi 00:40 compte pour la semaine du dimanche.
- **Fuseau** : les dates sont stockées en ISO (UTC) et ramenées à l'heure locale **au moment de l'affichage**. On ne stocke pas de fuseau. Si l'utilisateur change de fuseau, une séance proche de minuit peut changer de jour, donc parfois de semaine. C'est accepté : c'est rare, sans conséquence, et rien n'est historisé contre lui.

### 2.3 Compte de la semaine
`weekCount(sessions, now)` = nombre de séances comptées dont `startedAt` est dans la semaine de `now`. Les séances datées dans le futur (horloge fausse, import) ne comptent que lorsque leur semaine arrive.

### 2.4 Objectif
- Valeurs possibles : **« Aucun »** (défaut) ou **1, 2, 3, 4, 5, 6** séances par semaine. Pas de 7 : une séance par jour sans repos n'est pas un repère qu'on veut proposer.
- **L'objectif n'est pas historisé.** Il n'y a qu'une valeur, la valeur actuelle, et elle ne s'applique qu'à la **semaine en cours**. Les semaines passées ne sont jamais comparées à un objectif : c'est ce qui garantit qu'une semaine sous l'objectif ne laisse aucune trace.
- Un changement d'objectif s'applique **tout de suite**, à la semaine en cours (voir §7).

### 2.5 Bilan d'une période
Pour une période [début, fin[ : `periodSummary(sessions, from, to)` renvoie
- `count` : nombre de séances comptées dans la période ;
- `volume` : somme de `sessionVolume` de ces séances, en kg ;
- `records` : somme, sur ces séances, de `strongestRecords(detectNewRecords(s, sessions)).length`, soit **un record au plus par exercice et par séance**, exactement comme le récap les affiche. Les records sont calculés par rapport à tout l'historique antérieur à chaque séance, pas seulement à la période.

### 2.6 Jalons
- **Rang d'une séance** : sa position (à partir de 1) parmi les séances comptées, triées par `startedAt`. Le rang ne dépend pas de `now`, ce qui rend le récap stable si on le rouvre.
- **Seuils : 1, 10, 25, 50, 100, puis tous les 100 (200, 300, 400…).** Pas d'autre seuil. Fonction suggérée : `isMilestone(rank)` = `rank === 1 || rank === 10 || rank === 25 || rank === 50 || (rank >= 100 && rank % 100 === 0)`.
- Une séance non comptée n'a pas de rang et n'affiche jamais de jalon.
- Si une séance plus ancienne est supprimée de l'historique, les rangs suivants baissent de 1. C'est vrai à l'instant où on l'affiche : on l'accepte.

---

## 3. Textes exacts

Tous passent par `format.ts` (fonctions pures, testées) : espaces insécables avant « : » (`COLON`) et avant les unités (`formatCount`, `formatWeight`), apostrophes typographiques, **aucun « ! »** (aucun de ces textes n'est un record), aucun emoji.

### 3.1 Ligne de semaine — `formatWeekLine(count, goal)`
| Objectif | Séances comptées cette semaine | Texte |
|---|---|---|
| Aucun | 0 | *(rien, l'élément n'est pas rendu)* |
| Aucun | 1 | « Cette semaine : 1 séance. » |
| Aucun | 4 | « Cette semaine : 4 séances. » |
| 3 | 0 | « Objectif de la semaine : 3 séances. » |
| 1 | 0 | « Objectif de la semaine : 1 séance. » |
| 3 | 1 | « Cette semaine : 1 séance sur 3. » |
| 3 | 2 | « Cette semaine : 2 séances sur 3. » |
| 3 | 3 | « Cette semaine : 3 séances sur 3. Objectif atteint. » |
| 1 | 1 | « Cette semaine : 1 séance sur 1. Objectif atteint. » |
| 3 | 4 | « Cette semaine : 4 séances. Objectif de 3 atteint. » |

Décision : à 0 séance avec un objectif, on n'écrit pas « 0 séance sur 3 », on annonce le repère. Le compte apparaît dès qu'il y a quelque chose à compter.

### 3.2 Bilan — `formatPeriodSummary(label, summary)`
Format : `<label> : <n séances>[, <volume>][, <n records>].`
- « Semaine dernière : 3 séances, 14 520 kg, 1 record. »
- « Octobre : 11 séances, 52 300 kg, 4 records. »
- « Semaine dernière : 1 séance, 3 200 kg. » (0 record : segment omis)
- « Semaine dernière : 2 séances. » (que du poids du corps, volume 0 : segment omis)
- Le volume s'arrondit comme `formatWeight` (pas de décimale inutile, séparateur de milliers insécable).
- Le mois s'écrit en toutes lettres, majuscule initiale, sans année : « Octobre », « Novembre », « Décembre ».

### 3.3 Jalons — `formatMilestone(rank)`
- Rang 1 : « Première séance enregistrée. Bienvenue. »
- Autres seuils : `` `${formatNumber(rank)}ᵉ séance enregistrée.` `` (« ᵉ » = U+1D49), soit « 10ᵉ séance enregistrée. », « 25ᵉ séance enregistrée. », « 1 000ᵉ séance enregistrée. »
- Hors seuil : `undefined`, rien n'est rendu.

### 3.4 Réglage et proposition
- Libellé du réglage : « Objectif par semaine »
- Aide : « Un repère pour toi, que tu changes quand tu veux. Une semaine en dessous ne laisse aucune trace. »
- Libellés des pastilles : « Aucun », « 1 », « 2 », « 3 », « 4 », « 5 », « 6 » ; noms accessibles « Aucun objectif », « 1 séance par semaine », « 2 séances par semaine »…
- Carte de proposition (Progrès) : titre « Combien de séances par semaine veux-tu viser ? », texte « Un repère pour toi. Tu pourras le changer dans Réglages. », pastilles « 2 », « 3 », « 4 », bouton « Plus tard ».
- Toast après un choix dans la carte : « Objectif enregistré : 3 séances par semaine. » (sans « Annuler » : rien n'est détruit, et le réglage se change dans Réglages). Pour 1 : « Objectif enregistré : 1 séance par semaine. »

---

## 4. Où vit chaque élément

Règle commune : **aucun élément du lot ne prend l'accent**. Les actions principales existantes ne changent pas : « Démarrer la séance » sur la carte suggérée (Séances), « Voir mes progrès » (récap). Progrès n'a toujours pas d'action principale hors état vide.

### 4.1 Séances (`TemplatesPage`)
- **Ligne de semaine** (§3.1) juste sous l'en-tête (titre « Séances » + « Réglages »), au-dessus de la liste ou de l'état vide. Texte secondaire 13 px / 500, `role="status"` non requis (pas de mise à jour en direct sur cet écran). Pas de pastilles ici : une ligne de texte suffit et laisse la carte suggérée seule en tête.
- Rendu même quand la liste de séances types est vide (cas : tout supprimé, historique conservé). Pour un nouveau venu, objectif « Aucun » et 0 séance : rien n'est rendu, l'état vide du lot 2 reste intact.

### 4.2 Progrès (`ProgressPage`), de haut en bas
1. Titre « Progrès » (inchangé).
2. **Tuiles** (inchangées sauf « Cette semaine ») :
   - « Séances » : nombre de séances comptées.
   - « Cette semaine » :
     - objectif « Aucun » : le nombre seul, comme aujourd'hui (« 2 ») ;
     - objectif N et compte ≤ N : valeur « 2 sur 3 » (« sur » en taille normale du chiffre héros, mêmes chiffres tabulaires), puis une rangée de **N pastilles** ;
     - objectif N et compte > N : valeur « 4 », puis N pastilles toutes remplies ;
     - dès que compte ≥ N : sous les pastilles, légende 13 px « Objectif atteint ».
   - « Ce mois » : nombre de séances comptées du mois civil.
3. **Bilan**, juste sous les tuiles, deux paragraphes en texte secondaire 16 px, sans carte ni titre :
   - ligne 1 : semaine précédente complète (lundi–dimanche avant la semaine en cours), libellé « Semaine dernière ». **Omise si elle compte 0 séance.**
   - ligne 2 : mois en cours, libellé = nom du mois. **S'il compte 0 séance**, on affiche le mois précédent à la place (libellé = nom de ce mois-là), pour que le 1er du mois ne soit pas vide. Si les deux sont à 0, la ligne est omise.
   - Le bilan n'évoque **jamais** l'objectif (§2.4).
4. **Carte de proposition** (si les conditions du §5.2 sont réunies), sous le bilan.
5. Le reste de la page (sélecteur d'exercice, métriques, phrase, graphique, records) est inchangé. L'état vide « Pas encore de progression à afficher » reste en dessous des tuiles comme aujourd'hui.

### 4.3 Pastilles
- Rondes, **10 px** de diamètre, espacées de **6 px**, alignées à gauche sous la valeur de la tuile. 6 pastilles tiennent dans une tuile de 390 px de large (≈ 90 px).
- **Faite = remplie en encre** (couleur du texte principal). **À venir = contour 2 px en encre**, fond transparent. Aucune autre couleur, ni accent ni succès, en clair comme en sombre (identity §4.7, §9.2).
- Les K premières sont remplies, K = min(compte, N).
- `aria-hidden="true"` : l'information est portée par le texte de la tuile (« 2 sur 3 »), jamais par les pastilles seules. Le nom accessible de la tuile reste « Cette semaine : 2 séances sur 3 » (via un `visually-hidden`).
- Ce ne sont pas des crans biseautés : la pente de 12° reste réservée à la progression de séance et au logo (identity §6).

### 4.4 Récap (`SessionSummaryPage`)
Sous la phrase de synthèse (« Séance terminée : … »), avant les tuiles, au plus **deux lignes** en texte secondaire, dans cet ordre :
1. **Ligne de semaine** (§3.1), calculée **au moment de cette séance** : compte = séances comptées de la même semaine dont `startedAt` ≤ celui de cette séance. Affichée seulement si la séance est comptée **et** que sa semaine est la semaine en cours. Avec l'objectif « Aucun », elle s'affiche aussi (« Cette semaine : 2 séances. ») : c'est un fait, pas un reproche.
2. **Jalon** (§3.3), si le rang de la séance est un seuil.

Pas d'icône, pas d'animation, pas de « ! ». Les records gardent leur carte et leur « ! » (seul endroit autorisé). L'action principale « Voir mes progrès » ne change pas.

### 4.5 Réglages (`SettingsPage`), section « Séance »
- Sous l'interrupteur « Suggérer la charge suivante » et son aide, un groupe `role="radiogroup"` avec `aria-labelledby` sur le libellé « Objectif par semaine » (même style que `switch-row__label`).
- 7 pastilles-boutons `role="radio"` (« Aucun », 1 à 6), **cibles d'au moins 48 × 48 px**, rayon 999 px, espacement 8 px, **retour à la ligne autorisé** (à 390 px, elles tiennent sur deux lignes ; on ne réduit jamais une cible pour tout faire tenir sur une ligne).
- Choisie : **remplie en encre**, texte couleur fond, `aria-checked="true"`. Non choisie : contour 1 px bordure, texte principal. Pas d'accent.
- Navigation clavier d'un radiogroup : flèches gauche/droite, focus visible.
- Aide sous le groupe (§3.4), texte secondaire.
- Le choix s'enregistre au tap, sans bouton « Enregistrer » (comme l'interrupteur existant).

---

## 5. Réglage de l'objectif

### 5.1 Défaut
« Aucun ». Aucune pastille, aucune mention d'objectif nulle part. L'app se comporte comme avant le lot, à la ligne de semaine sur Séances et au récap près.

### 5.2 Proposition unique sur Progrès
La carte du §3.4 s'affiche si et seulement si :
- l'objectif vaut « Aucun » ;
- l'utilisateur n'a **jamais** fait de choix d'objectif (ni dans la carte, ni dans Réglages) et n'a jamais tapé « Plus tard » ;
- il existe **au moins 2 séances comptées**.

Comportement :
- Carte `card` ordinaire, sans accent. Pastilles 2, 3, 4 : même style que les pastilles du réglage (48 px, contour). « Plus tard » : bouton secondaire `btn--ghost`, 48 px.
- Tap sur 2, 3 ou 4 : l'objectif est enregistré, la carte disparaît, toast « Objectif enregistré : 3 séances par semaine. ». La tuile « Cette semaine » prend immédiatement ses pastilles.
- « Plus tard » : la carte disparaît **définitivement**, même après rechargement. L'objectif reste « Aucun ». Pas de toast.
- Une fois la carte écartée, l'objectif ne se règle plus que dans Réglages. On ne repropose jamais.

---

## 6. Persistance, export, import

- `AppSettings` gagne deux champs optionnels :
  - `weeklyGoal?: 1 | 2 | 3 | 4 | 5 | 6` ; **absent = « Aucun »**. Choisir « Aucun » dans Réglages **retire** le champ (pas de `0` ni de `null` stocké).
  - `weeklyGoalAsked?: boolean` ; `true` dès que l'utilisateur a choisi une valeur (carte ou Réglages, y compris « Aucun ») ou tapé « Plus tard ». Absent = `false`.
- Actions du store suggérées : `settings/setWeeklyGoal` (`goal: number | undefined`, pose aussi `weeklyGoalAsked: true`) et `settings/dismissWeeklyGoalPrompt`.
- **Export** : les deux champs sont dans `settings`, exportés avec le reste. `version` reste `1`.
- **Import** (`parseSettings`) :
  - champ absent : accepté (anciens exports, et exports du lot 1 qui n'ont que `suggestLoad`) ;
  - `weeklyGoal` présent : doit être un entier de 1 à 6, sinon l'import échoue avec un message qui nomme le chemin `settings.weeklyGoal`, comme pour `suggestLoad` ;
  - `weeklyGoalAsked` présent : booléen, sinon échec avec `settings.weeklyGoalAsked`.
- **Réinitialisation** (`data/reset`) : retour aux défauts, donc objectif « Aucun » et carte de proposition de nouveau possible.
- Aucune donnée calculée (compte, bilan, rang) n'est stockée : tout se recalcule depuis `sessions`.

---

## 7. Cas limites

| Cas | Comportement |
|---|---|
| **Changement d'objectif en cours de semaine** | Effet immédiat sur la semaine en cours (Séances, tuile, récaps rouverts). 2 séances faites, objectif passé de 4 à 2 : « Cette semaine : 2 séances sur 2. Objectif atteint. » Passé de 2 à 4 : « Cette semaine : 2 séances sur 4. » Aucun message sur le changement lui-même. |
| **Objectif remis à « Aucun »** | Pastilles et « sur N » disparaissent tout de suite ; la ligne de Séances redevient « Cette semaine : 2 séances. » La carte de proposition ne revient pas. |
| **Lundi, nouvelle semaine** | Le compte repart de 0 sans aucun texte sur la semaine écoulée, qu'elle ait atteint l'objectif ou non. Avec un objectif : « Objectif de la semaine : 3 séances. » ; sans : rien. Le bilan « Semaine dernière » ne parle que de ce qui a été fait. |
| **Séance à cheval sur minuit** | Comptée dans la semaine (et le mois) de son `startedAt`. Dimanche 23:30 → lundi 00:40 : semaine précédente. Son récap, affiché le lundi, n'a pas de ligne de semaine (sa semaine n'est plus la semaine en cours) ; le jalon, lui, s'affiche. |
| **Changement d'heure** (29 mars et 25 octobre 2026) | Bornes calculées en dates locales (`setDate`), donc une semaine de 167 h ou 169 h reste une semaine. Tests dédiés. |
| **Changement de fuseau** | Recalcul à l'heure locale actuelle (§2.2). Pas de correction. |
| **Historique vide** | Séances : rien (objectif « Aucun ») ou « Objectif de la semaine : 3 séances. ». Progrès : tuiles à 0 (« 0 sur 3 » et 3 pastilles en contour si objectif), pas de bilan, pas de carte de proposition, état vide existant. |
| **Une seule séance comptée** | Pas de carte de proposition (seuil 2). Jalon « Première séance enregistrée. Bienvenue. » dans son récap. |
| **Séance terminée sans série validée** | Enregistrée dans l'Historique, mais non comptée : pas de ligne de semaine ni de jalon dans son récap, tuiles inchangées. |
| **Séance supprimée de l'Historique** | Compte, bilan et rangs se recalculent. Si l'objectif n'est plus atteint, la mention disparaît sans message. |
| **Plusieurs séances le même jour** | Chacune compte (on compte des séances, pas des jours). |
| **Import d'un historique** | Tout se recalcule. Les jalons apparaissent seulement dans les récaps qu'on ouvre, pas en rafale. |
| **Séance datée dans le futur** | Non comptée tant que sa semaine (ou son mois) n'est pas arrivée. |
| **Mois en cours vide** | Le bilan montre le mois précédent sous son nom (§4.2). |

---

## 8. Critères d'acceptation

**Calcul (tests unitaires sur `rhythm.ts`, `now` fixé)**
1. `countedSessions` exclut les séances sans `endedAt` et les séances terminées sans série validée ; les tuiles « Séances », « Cette semaine » et « Ce mois » utilisent cette définition.
2. Bornes de semaine, heure locale (`TZ=Europe/Paris` dans le test) : une séance commencée dimanche 23:59 compte pour sa semaine ; une séance commencée lundi 00:00 compte pour la nouvelle semaine ; une séance commencée dimanche 23:30 et terminée lundi 00:40 compte pour la semaine du dimanche.
3. Semaines du changement d'heure (23–29 mars 2026, 19–25 octobre 2026) : une séance le dimanche 22:00 de ces semaines y est comptée, une séance le lundi suivant 00:30 ne l'est pas.
4. Bornes de mois : 31 octobre 23:59 compte pour Octobre, 1er novembre 00:00 pour Novembre.
5. `periodSummary` : volume = somme des `sessionVolume` ; records = un au plus par exercice et par séance (même résultat que `strongestRecords(detectNewRecords(...))` du récap).
6. `isMilestone` vaut vrai pour 1, 10, 25, 50, 100, 200, 300, 1000 et faux pour 2, 9, 11, 24, 26, 75, 150, 250. Le rang ignore les séances non comptées.

**Textes (tests sur `format.ts`)**

7. `formatWeekLine` produit exactement les 10 textes du tableau §3.1, avec `NBSP` avant « : » et avant « séance(s) ». Pour (Aucun, 0), il renvoie `undefined`.
8. `formatPeriodSummary` produit exactement les 4 exemples du §3.2 (segments à 0 omis, mois capitalisé sans année).
9. `formatMilestone` produit « Première séance enregistrée. Bienvenue. », « 10ᵉ séance enregistrée. », « 1 000ᵉ séance enregistrée. » et `undefined` hors seuil.
10. Aucun texte produit par `rhythm.ts` ni par `formatWeekLine`, `formatPeriodSummary`, `formatMilestone` ne contient « ! », « % », « raté », « manqué », « perdu », « en retard », « streak » ou « série » (test qui balaie toutes les combinaisons objectif 0–6 × compte 0–8). *Le grep porte sur ces fonctions, pas sur tout `src/` : « perdue(s) » est légitime dans les avertissements de perte de données de Réglages et de l'éditeur.*

**Séances**

11. Objectif 3, une séance comptée lundi : « Cette semaine : 1 séance sur 3. » sous l'en-tête. 3 séances : « … 3 séances sur 3. Objectif atteint. » 4 séances : « Cette semaine : 4 séances. Objectif de 3 atteint. »
12. Le lundi suivant sans séance : « Objectif de la semaine : 3 séances. » et aucun autre texte sur la semaine écoulée. Objectif « Aucun » et 0 séance : aucune ligne (l'état vide du lot 2 est identique à avant).
13. La seule action accent de l'écran reste « Démarrer la séance » (ou « Choisir un programme » en état vide).

**Progrès**

14. Objectif « Aucun » : tuile « Cette semaine » = nombre seul, aucune pastille.
15. Objectif 3, 2 séances : « 2 sur 3 », 3 pastilles dont 2 remplies ; 4 séances : « 4 », 3 pastilles remplies et « Objectif atteint ». Pastilles en encre (calcul de couleur = texte principal), `aria-hidden`, en clair et en sombre.
16. Bilan : « Semaine dernière : 3 séances, 14 520 kg, 1 record. » sur un jeu de données de test ; ligne omise si la semaine dernière compte 0 séance ; le 1er novembre sans séance, la ligne de mois affiche « Octobre : … ». Aucune ligne de bilan ne mentionne l'objectif.
17. Carte de proposition : absente avec 0 ou 1 séance comptée, présente à 2 si objectif « Aucun » et jamais choisi. Tap sur « 3 » : carte retirée, toast « Objectif enregistré : 3 séances par semaine. », pastilles visibles. « Plus tard » : carte retirée, toujours absente après rechargement. Absente si l'utilisateur a déjà choisi une valeur (même « Aucun ») dans Réglages.
18. Aucun élément de Progrès n'utilise la couleur d'accent hors état vide existant.

**Récap**

19. Séance comptée qui porte la semaine à 2 avec l'objectif 3 : « Cette semaine : 2 séances sur 3. » sous la phrase de synthèse. Rouvrir le récap d'une séance plus ancienne de la même semaine affiche le compte au moment de cette séance (« 1 séance sur 3 »).
20. 10ᵉ séance comptée : « 10ᵉ séance enregistrée. » ; 1ʳᵉ : « Première séance enregistrée. Bienvenue. » ; 11ᵉ : aucune ligne de jalon. Séance sans série validée : ni ligne de semaine ni jalon.
21. Pas d'icône, pas d'animation et pas de « ! » sur ces lignes ; « Voir mes progrès » reste la seule action accent.

**Réglages, persistance**

22. Section « Séance » : radiogroup « Objectif par semaine », 7 choix, « Aucun » coché par défaut, cibles ≥ 48 px, flèches clavier, choix coché rempli en encre, jamais en accent. Le choix survit à un rechargement.
23. Choisir « Aucun » retire `settings.weeklyGoal` de l'état (test sur le réducteur) et pose `weeklyGoalAsked: true`.
24. Export puis import : `weeklyGoal` et `weeklyGoalAsked` sont restitués à l'identique. Un export sans `settings` et un export du lot 1 (`settings: { suggestLoad: false }`) s'importent sans erreur avec l'objectif « Aucun ». `weeklyGoal: 7`, `0`, `2.5` ou `"3"` font échouer l'import avec un message qui cite `settings.weeklyGoal`.
25. Réinitialisation : objectif « Aucun », carte de proposition de nouveau possible.

**Design**

26. Mêmes contrôles de revue que les lots 1 et 2, en clair et en sombre, à 390 × 844 : cibles ≥ 48 px, une seule action accent par écran, chiffres tabulaires dans la tuile, espaces insécables avant les unités et « : », apostrophes typographiques, aucun texte < 13 px.

---

## 9. Non-objectifs du lot 3

- **Pas d'historique des semaines** (calendrier, liste « semaine 42 : 3 sur 3 »), parce qu'il ferait apparaître les semaines sous l'objectif.
- **Pas de « semaines d'affilée »** ni aucun compteur de régularité qui repart à zéro (identity §9.3).
- **Pas de taux ni de jauge** : « 2 sur 3 », jamais « 67 % ».
- **Pas d'objectif en volume, en minutes ou par groupe musculaire** : une seule unité, la séance.
- **Pas de notification ni de rappel** dans ce lot : les rappels choisis viennent avec le lot 4 (notifications locales iOS), et ne parleront jamais d'une absence.
- **Pas de comparaison** « mieux que la semaine dernière » dans le bilan : il donne des faits, l'utilisateur compare s'il veut.
- **Pas d'objectif déduit du programme** de départ (lot 2, §10).

---

## 10. Évolutions de l'identité (appliquées le 29 octobre 2026)

*Appliquées à `docs/identity.md` avec l'implémentation du lot : les six points ci-dessous y figurent (§5 Créer, §5 Suivre, §6 Forme et espace, §9.2), et la dernière phrase de §9 a été retirée.*

1. **§9.2, ligne « Rythme de la semaine »**, colonne exemple : ajouter « Objectif de la semaine : 3 séances. » (aucune séance encore) et « Cette semaine : 4 séances. Objectif de 3 atteint. », et préciser dans la forme : « Seule la semaine en cours est comparée à l'objectif. Une séance compte si elle est terminée avec au moins une série validée. »
2. **§9.2, ligne « Bilan »** : ajouter « Les segments à 0 sont omis ; le bilan ne mentionne jamais l'objectif. »
3. **§9.2, ligne « Jalon »** : préciser les seuils « 1, 10, 25, 50, 100, puis tous les 100 ».
4. **§5 Suivre**, puce « Progrès » : ajouter en tête « Les tuiles Séances, Cette semaine (avec pastilles si un objectif est choisi) et Ce mois, puis le bilan de la semaine dernière et du mois. »
5. **§5 Créer**, première puce : ajouter « Sous le titre, la ligne de semaine en texte secondaire (« Cette semaine : 2 séances sur 3. »). »
6. **§6 Forme et espace** : ajouter « Pastilles de rythme : rondes, 10 px, encre (remplie = faite, contour = à venir). » La dernière phrase de §9 peut alors être retirée, puisqu'elle redit la même chose.

Aucune règle de l'identité n'est assouplie par ce lot.

---

## 11. Questions pour le propriétaire

1. **Objectif maximum à 6 séances par semaine ?** Par défaut : oui, 1 à 6. 7 inciterait à ne jamais se reposer.
2. **Faut-il la ligne de semaine sur Séances même sans objectif (« Cette semaine : 2 séances. ») ?** Par défaut : oui, c'est un fait utile pour décider d'y aller, et elle disparaît à 0.
