# Lot 3 : ton rythme (objectif hebdo choisi, bilan, jalons)

*Product owner, 29 octobre 2026. Ce document précise le lot 3 de `vision-et-roadmap.md`. Il remplace le détail qui s'y trouvait. En cas d'écart entre les deux, ce document fait foi.*

*Révisé le 30/10 après revue design (`docs/review-2026-10-29-lot3.md`) : §3.1 (espaces insécables de « Objectif atteint »), §3.2 (ligne du mois sans le compte), §3.4 et §5.2 (« Non merci », bouton à contour, texte de la carte), §4.2 (tuile à 0, repli du mois limité au 1er–7), §4.3 (pastilles centrées), §6, §7, critères 7, 8, 12 bis, 15, 16, 17, 27 à 30. Le détail testable est en fin de document, § « Décisions après revue (30/10) ».*

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

*Révisé le 30/10 après revue design* : la phrase finale ne se coupe jamais. « Objectif atteint. » s'écrit `Objectif atteint.` et « Objectif de 3 atteint. » s'écrit `Objectif de 3 atteint.` (espaces insécables entre tous les mots de cette phrase, pas seulement avant « atteint », pour éviter « Objectif / de 3 atteint. »). Les textes visibles du tableau sont inchangés.

### 3.2 Bilan — `formatPeriodSummary(label, summary, options)`
*Révisé le 30/10 après revue design : la ligne du **mois en cours** ne répète plus le compte, déjà affiché par la tuile « Ce mois » juste au-dessus.*

Format avec le compte (semaine dernière, et mois précédent affiché en repli, §4.2) : `<label> : <n séances>[, <volume>][, <n records>].`
- « Semaine dernière : 3 séances, 14 520 kg, 1 record. »
- « Octobre : 4 séances, 14 760 kg. » (mois précédent en repli, le 2 novembre : aucune tuile ne donne ce compte)
- « Semaine dernière : 1 séance, 3 200 kg. » (0 record : segment omis)
- « Semaine dernière : 2 séances. » (que du poids du corps, volume 0 : segment omis)

Format sans le compte (mois en cours) : `<label> : <volume>[, <n records>].`, ou `<label> : <n records>.` si le volume vaut 0.
- « Octobre : 52 300 kg, 4 records. »
- « Octobre : 480 kg. » (0 record : segment omis)
- « Octobre : 2 records. » (que du poids du corps)
- Volume et records à 0 tous les deux : **la ligne est omise** (rien n'est rendu).
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
- Carte de proposition (Progrès) : titre « Combien de séances par semaine veux-tu viser ? », texte « Un repère pour toi. Tu pourras le régler à tout moment dans Réglages. », pastilles « 2 », « 3 », « 4 », bouton « Non merci ». *(Révisé le 30/10 après revue design : « Plus tard » promettait une relance qui n'existe pas, et l'ancien texte supposait qu'on avait choisi.)*
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
     - objectif N et compte = 0 : valeur « 0 », **aucune pastille**, légende 13 px « Objectif : 3 » (même style que « Objectif atteint »). Nom accessible : « Cette semaine : 0 séance, objectif 3 séances ». On annonce le repère, on ne dessine pas de cases vides, comme sur Séances (§3.1). *(Révisé le 30/10 après revue design.)*
     - objectif N et 1 ≤ compte ≤ N : valeur « 2 sur 3 » (« sur » en taille normale du chiffre héros, mêmes chiffres tabulaires), puis une rangée de **N pastilles** ;
     - objectif N et compte > N : valeur « 4 », puis N pastilles toutes remplies ;
     - dès que compte ≥ N : sous les pastilles, légende 13 px « Objectif atteint ».
   - « Ce mois » : nombre de séances comptées du mois civil.
3. **Bilan**, juste sous les tuiles, deux paragraphes en texte secondaire 16 px, sans carte ni titre :
   - ligne 1 : semaine précédente complète (lundi–dimanche avant la semaine en cours), libellé « Semaine dernière ». **Omise si elle compte 0 séance.**
   - ligne 2 : mois en cours, libellé = nom du mois, **sans le compte** (§3.2 : « Octobre : 49 755 kg, 10 records. »), puisque la tuile « Ce mois » le donne déjà. Omise si volume et records valent 0.
   - **S'il compte 0 séance et qu'on est entre le 1er et le 7 du mois inclus** (date locale de `now`), on affiche le mois précédent à la place, **avec son compte** (« Octobre : 4 séances, 14 760 kg. »), pour que le début du mois ne soit pas vide. **À partir du 8**, un mois en cours vide n'affiche aucune ligne de mois : on ne met pas une période passée à côté d'une période en cours vide (identity §9.3, relances). Si le mois précédent est vide aussi, la ligne est omise. *(Révisé le 30/10 après revue design.)*
   - Le bilan n'évoque **jamais** l'objectif (§2.4).
4. **Carte de proposition** (si les conditions du §5.2 sont réunies), sous le bilan.
5. Le reste de la page (sélecteur d'exercice, métriques, phrase, graphique, records) est inchangé. L'état vide « Pas encore de progression à afficher » reste en dessous des tuiles comme aujourd'hui.

### 4.3 Pastilles
- Rondes, **10 px** de diamètre, espacées de **6 px**, **centrées sous la valeur de la tuile** *(révisé le 30/10 après revue design : libellé et valeur des tuiles sont centrés, des pastilles calées à gauche paraîtraient décalées ; l'implémentation actuelle est la bonne)*. 6 pastilles tiennent dans une tuile de 390 px de large (≈ 90 px).
- **Faite = remplie en encre** (couleur du texte principal). **À venir = contour 2 px en encre**, fond transparent. Aucune autre couleur, ni accent ni succès, en clair comme en sombre (identity §4.7, §9.2).
- Les K premières sont remplies, K = min(compte, N). À compte = 0, aucune pastille n'est rendue (§4.2).
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
- l'utilisateur n'a **jamais** fait de choix d'objectif (ni dans la carte, ni dans Réglages) et n'a jamais tapé « Non merci » ;
- il existe **au moins 2 séances comptées**.

Comportement :
- Carte `card` ordinaire, sans accent. Pastilles 2, 3, 4 : même style que les pastilles du réglage (48 px, contour). « Non merci » : bouton secondaire **à contour** (classe `btn` seule : 1 px `--border`, 48 px de haut, largeur au contenu, aligné à gauche, sans décalage négatif), comme « Rester à 80 kg » au lot 1. *(Révisé le 30/10 après revue design : `btn--ghost` ne se lisait pas comme un bouton.)*
- Tap sur 2, 3 ou 4 : l'objectif est enregistré, la carte disparaît, toast « Objectif enregistré : 3 séances par semaine. ». La tuile « Cette semaine » prend immédiatement sa forme avec objectif (pastilles, ou « Objectif : 3 » à 0 séance cette semaine).
- « Non merci » : la carte disparaît **définitivement**, même après rechargement. L'objectif reste « Aucun ». Pas de toast. Le libellé dit ce qui se passe : on ne redemandera pas.
- Une fois la carte écartée, l'objectif ne se règle plus que dans Réglages. On ne repropose jamais.

---

## 6. Persistance, export, import

- `AppSettings` gagne deux champs optionnels :
  - `weeklyGoal?: 1 | 2 | 3 | 4 | 5 | 6` ; **absent = « Aucun »**. Choisir « Aucun » dans Réglages **retire** le champ (pas de `0` ni de `null` stocké).
  - `weeklyGoalAsked?: boolean` ; `true` dès que l'utilisateur a choisi une valeur (carte ou Réglages, y compris « Aucun ») ou tapé « Non merci » (*révisé le 30/10 : ex-« Plus tard », même action `settings/dismissWeeklyGoalPrompt`*). Absent = `false`.
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
| **Lundi, nouvelle semaine** | Le compte repart de 0 sans aucun texte sur la semaine écoulée, qu'elle ait atteint l'objectif ou non. Avec un objectif : « Objectif de la semaine : 3 séances. » sur Séances, et tuile « 0 » + « Objectif : 3 » sans pastille sur Progrès *(révisé le 30/10)* ; sans : rien. Le bilan « Semaine dernière » ne parle que de ce qui a été fait. |
| **Séance à cheval sur minuit** | Comptée dans la semaine (et le mois) de son `startedAt`. Dimanche 23:30 → lundi 00:40 : semaine précédente. Son récap, affiché le lundi, n'a pas de ligne de semaine (sa semaine n'est plus la semaine en cours) ; le jalon, lui, s'affiche. |
| **Changement d'heure** (29 mars et 25 octobre 2026) | Bornes calculées en dates locales (`setDate`), donc une semaine de 167 h ou 169 h reste une semaine. Tests dédiés. |
| **Changement de fuseau** | Recalcul à l'heure locale actuelle (§2.2). Pas de correction. |
| **Historique vide** | Séances : rien (objectif « Aucun ») ou « Objectif de la semaine : 3 séances. ». Progrès : tuiles à 0 (avec un objectif : « 0 » et la légende « Objectif : 3 », aucune pastille ; *révisé le 30/10 après revue design*), pas de bilan, pas de carte de proposition, état vide existant. |
| **Une seule séance comptée** | Pas de carte de proposition (seuil 2). Jalon « Première séance enregistrée. Bienvenue. » dans son récap. |
| **Séance terminée sans série validée** | Enregistrée dans l'Historique, mais non comptée : pas de ligne de semaine ni de jalon dans son récap, tuiles inchangées. |
| **Séance supprimée de l'Historique** | Compte, bilan et rangs se recalculent. Si l'objectif n'est plus atteint, la mention disparaît sans message. |
| **Plusieurs séances le même jour** | Chacune compte (on compte des séances, pas des jours). |
| **Import d'un historique** | Tout se recalcule. Les jalons apparaissent seulement dans les récaps qu'on ouvre, pas en rafale. |
| **Séance datée dans le futur** | Non comptée tant que sa semaine (ou son mois) n'est pas arrivée. |
| **Mois en cours vide** | Du 1er au 7 inclus : le bilan montre le mois précédent sous son nom, avec son compte (« Octobre : 4 séances, 14 760 kg. »). À partir du 8 : aucune ligne de mois (§4.2). *Révisé le 30/10 après revue design.* |
| **Mois en cours sans volume ni record** (que des séances au poids du corps sans record) | Ligne du mois omise ; le compte reste lisible dans la tuile « Ce mois ». *Ajouté le 30/10.* |

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

7. `formatWeekLine` produit exactement les 10 textes du tableau §3.1, avec `NBSP` avant « : » et avant « séance(s) », et `NBSP` entre les mots de « Objectif atteint » et de « Objectif de 3 atteint ». Pour (Aucun, 0), il renvoie `undefined`. *(Révisé le 30/10.)*
8. `formatPeriodSummary` produit exactement les 8 exemples du §3.2 (avec et sans compte, segments à 0 omis, mois capitalisé sans année) et `undefined` pour un mois en cours sans volume ni record. *(Révisé le 30/10.)*
9. `formatMilestone` produit « Première séance enregistrée. Bienvenue. », « 10ᵉ séance enregistrée. », « 1 000ᵉ séance enregistrée. » et `undefined` hors seuil.
10. Aucun texte produit par `rhythm.ts` ni par `formatWeekLine`, `formatPeriodSummary`, `formatMilestone` ne contient « ! », « % », « raté », « manqué », « perdu », « en retard », « streak » ou « série » (test qui balaie toutes les combinaisons objectif 0–6 × compte 0–8). *Le grep porte sur ces fonctions, pas sur tout `src/` : « perdue(s) » est légitime dans les avertissements de perte de données de Réglages et de l'éditeur.*

**Séances**

11. Objectif 3, une séance comptée lundi : « Cette semaine : 1 séance sur 3. » sous l'en-tête. 3 séances : « … 3 séances sur 3. Objectif atteint. » 4 séances : « Cette semaine : 4 séances. Objectif de 3 atteint. »
12. Le lundi suivant sans séance : « Objectif de la semaine : 3 séances. » et aucun autre texte sur la semaine écoulée. Objectif « Aucun » et 0 séance : aucune ligne (l'état vide du lot 2 est identique à avant).

12 bis. À 375 × 667, « Cette semaine : 3 séances sur 3. Objectif atteint. » ne coupe jamais entre « Objectif » et « atteint » (Séances et récap). *(Ajouté le 30/10.)*
13. La seule action accent de l'écran reste « Démarrer la séance » (ou « Choisir un programme » en état vide).

**Progrès**

14. Objectif « Aucun » : tuile « Cette semaine » = nombre seul, aucune pastille.
15. Objectif 3, 0 séance cette semaine : valeur « 0 », 0 `.rhythm-dot`, légende « Objectif : 3 ». 1 séance : « 1 sur 3 », 3 pastilles dont 1 remplie ; 2 séances : « 2 sur 3 », 3 pastilles dont 2 remplies ; 4 séances : « 4 », 3 pastilles remplies et « Objectif atteint ». Pastilles en encre (calcul de couleur = texte principal), `aria-hidden`, centrées sous la valeur, en clair et en sombre. *(Révisé le 30/10.)*
16. Bilan : « Semaine dernière : 3 séances, 14 520 kg, 1 record. » sur un jeu de données de test ; ligne omise si la semaine dernière compte 0 séance ; la ligne du mois en cours ne contient pas le compte (« séance ») ; le 2 novembre sans séance en novembre, la ligne de mois affiche « Octobre : 4 séances, … » ; le 29 octobre sans séance en octobre, aucune ligne de mois. Aucune ligne de bilan ne mentionne l'objectif. *(Révisé le 30/10.)*
17. Carte de proposition : absente avec 0 ou 1 séance comptée, présente à 2 si objectif « Aucun » et jamais choisi. Texte « Un repère pour toi. Tu pourras le régler à tout moment dans Réglages. » Tap sur « 3 » : carte retirée, toast « Objectif enregistré : 3 séances par semaine. », tuile avec objectif visible. « Non merci » (bouton à bordure visible, ≥ 48 px de haut) : carte retirée, sans toast, toujours absente après rechargement. Absente si l'utilisateur a déjà choisi une valeur (même « Aucun ») dans Réglages. Aucun texte « Plus tard » dans l'app. *(Révisé le 30/10.)*
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

**Après revue design (ajoutés le 30/10)**

27. Tuile « Cette semaine », objectif 3, 0 séance : le nom accessible de la tuile est « Cette semaine : 0 séance, objectif 3 séances » ; la légende « Objectif : 3 » tient sur une ligne à 375 px.
28. À 375 × 667, la ligne du mois en cours (« Octobre : 49 755 kg, 10 records. ») tient sur une ligne.
29. Progrès, exercice qui n'a qu'un seul point : le titre est « Première séance sur cet exercice » et ne contient pas « séance enregistrée ».
30. Le bouton de refus de la carte de proposition n'a ni `btn--ghost` ni marge négative ; sa bordure calculée n'est pas transparente.

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

---

## 12. Décisions après revue (30/10)

*Product owner, 30 octobre 2026, sur `docs/review-2026-10-29-lot3.md` (commit 75fc1f8). Brief pour l'implémenteur : les 6 améliorations proposées sont retenues, dont 2 avec modification. Rien d'autre ne change dans le lot. Les numéros suivent la revue.*

| N° | Amélioration | Décision |
|---|---|---|
| 1 | Tuile « Cette semaine » à 0 | **Acceptée**, précisée (espaces, nom accessible, fonction de légende) |
| 2 | Refus honnête et visible | **Acceptée telle quelle** |
| 3 | Ligne du mois sans le compte | **Acceptée**, précisée (cas volume 0 avec records) |
| 4 | Repli sur le mois précédent du 1er au 7 | **Acceptée telle quelle** |
| 5 | « Objectif atteint. » ne se coupe pas | **Acceptée avec modification** : insécables sur toute la phrase « Objectif de 3 atteint. » |
| 6 | Titre de courbe à un point | **Acceptée avec modification** : « Première séance sur cet exercice », pas « Première fois en <exercice> » |

### 12.1 Tuile « Cette semaine » à 0 (n° 1)
**Pourquoi** : identity §9.1.4 (« jamais ce qui manque ») et cohérence avec la décision du §3.1 sur Séances. Trois ronds vides se lisent comme des cases en retard.

**Où** : `src/pages/ProgressPage.tsx` (branche `goal !== undefined` de la tuile), `src/lib/format.ts` (`formatWeekTile`, `formatWeekTileLabel`, nouvelle fonction de légende).

**Comportement exact** (objectif N défini) :
- compte = 0 : `stat__value` = « 0 » ; **aucun** élément `.rhythm-dots` rendu (pas de rangée vide) ; `stat__caption` = « Objectif : 3 » ;
- compte ≥ 1 : inchangé (« 1 sur 3 » ●○○, …, « Objectif atteint » dès que compte ≥ N) ;
- objectif « Aucun » : inchangé (nombre seul, pas de légende).

**Textes exacts** (`~` = U+00A0) :
- `formatWeekTile(0, 3)` → `"0"` (au lieu de « 0 sur 3 »).
- `formatWeekTileLabel(0, 3)` → `0~séance, objectif 3~séances` ; `formatWeekTileLabel(0, 1)` → `0~séance, objectif 1~séance`. Avec le `dt` « Cette semaine », la tuile se lit « Cette semaine : 0 séance, objectif 3 séances ».
- Nouvelle fonction suggérée `formatWeekTileCaption(count, goal)` : `undefined` sans objectif ou si 0 < compte < N ; `` `Objectif${COLON} ${formatNumber(goal)}` `` (« Objectif : 3 », insécable avant et après « : ») si compte = 0 ; `Objectif~atteint` si compte ≥ N.

**Tests** :
- format : `formatWeekTile(0, 3) === '0'` ; `formatWeekTileLabel(0, 3) === '0~séance, objectif 3~séances'` ; `formatWeekTileCaption(0, 3) === 'Objectif~:~3'` ; `formatWeekTileCaption(2, 3) === undefined` ; `formatWeekTileCaption(3, 3) === 'Objectif~atteint'` ; `formatWeekTileCaption(1, undefined) === undefined`.
- écran (`src/pages/rhythm.test.tsx`) : objectif 3, aucune séance cette semaine (mais des séances avant) → 0 `.rhythm-dot`, « Objectif : 3 » visible, tuile lue « Cette semaine : 0 séance, objectif 3 séances ». Après 1 séance cette semaine → 3 `.rhythm-dot` dont 1 `.rhythm-dot--done`, « 1 sur 3 », plus de « Objectif : 3 ».
- Critères 15 et 27 du §8.

### 12.2 Carte de proposition : « Non merci » (n° 2)
**Pourquoi** : identity §4.1 et §9.1.2. Le refus doit se lire comme un bouton, et son libellé doit dire ce qui se passe : c'est définitif.

**Où** : `src/pages/ProgressPage.tsx` (carte `goal-prompt`), `src/styles.css` (`.goal-prompt__later`).

**Comportement exact** :
- Texte de la carte : « Un repère pour toi. Tu pourras le régler à tout moment dans Réglages. »
- Bouton : libellé « Non merci », `className="btn goal-prompt__later"` (on retire `btn--ghost`). Dans `.goal-prompt__later`, on garde `align-self: flex-start` et on **supprime** `margin-left: calc(-1 * var(--space-3))` ; commentaire CSS mis à jour (« Refus : bouton secondaire à contour, largeur au contenu, comme « Rester à … » »).
- Action inchangée : `actions.dismissWeeklyGoalPrompt`, carte retirée définitivement, pas de toast, `settings` = `{ weeklyGoalAsked: true }`.
- Titre et pastilles 2, 3, 4 inchangés.

**Tests** :
- écran : bouton de nom accessible « Non merci », sans classe `btn--ghost` ; aucun texte « Plus tard » ni « Tu pourras le changer » dans la page ; tap → carte absente, aucun toast, toujours absente après remontage avec le même `localStorage`.
- Playwright : bordure calculée non transparente, hauteur ≥ 48 px, en clair et en sombre ; Progrès garde 0 aplat accent. Critères 17 et 30.

### 12.3 Ligne du mois en cours sans le compte (n° 3)
**Pourquoi** : « Ce mois 13 » puis « Octobre : 13 séances, … » fait doublon. Le bilan n'apporte que ce que les tuiles ne disent pas. « Semaine dernière » garde son compte (aucune tuile ne le donne), le mois précédent en repli aussi.

**Où** : `src/lib/format.ts` (`formatPeriodSummary`), `src/lib/rhythm.ts` (`ProgressReview`, `progressReview`), `src/pages/ProgressPage.tsx` (rendu du bilan).

**Comportement exact** :
- `ProgressReview.month` gagne `isCurrent: boolean` (vrai = mois de `now`, faux = mois précédent en repli).
- `formatPeriodSummary(label, summary, { count = true } = {})` renvoie `string | undefined` :
  - `count: true` : inchangé (« Semaine dernière : 3 séances, 14 520 kg, 1 record. », « Octobre : 4 séances, 14 760 kg. ») ;
  - `count: false` : `<label> : <volume>[, <n records>].` ; volume 0 et records > 0 : « Octobre : 2 records. » ; volume 0 et records 0 : `undefined`.
- `ProgressPage` passe `{ count: !review.month.isCurrent }`. Le conteneur `.progress-review` n'est rendu que si au moins une ligne a un texte (pas de `div` vide).

**Textes exacts** (`format.test.ts`) :
- `formatPeriodSummary('Octobre', { count: 13, volume: 49755, records: 10 }, { count: false })` → « Octobre : 49 755 kg, 10 records. »
- `formatPeriodSummary('Octobre', { count: 1, volume: 480, records: 0 }, { count: false })` → « Octobre : 480 kg. »
- `formatPeriodSummary('Octobre', { count: 2, volume: 0, records: 2 }, { count: false })` → « Octobre : 2 records. »
- `formatPeriodSummary('Octobre', { count: 2, volume: 0, records: 0 }, { count: false })` → `undefined`
- Les 4 exemples avec compte du §3.2 restent identiques sans option.

**Tests écran** : 13 séances en octobre → la ligne du mois ne contient pas « séance » ; nouvel utilisateur après 1 séance de 480 kg → « Octobre : 480 kg. ». Playwright 375 × 667, profil (b) : la ligne tient sur une ligne (critère 28).

### 12.4 Repli sur le mois précédent du 1er au 7 (n° 4)
**Pourquoi** : identity §9.3 (relances) et §9.4 q. 4. Le 29 octobre, « Ce mois 0 » au-dessus de « Septembre : 10 séances… » pointe l'absence. Le repli n'a de sens qu'en début de mois.

**Où** : `src/lib/rhythm.ts`, `progressReview` (et le commentaire de `ProgressReview.month`).

**Comportement exact** : le mois en cours s'il compte ≥ 1 séance (`isCurrent: true`) ; sinon, **si `now.getDate() <= 7`** (date locale), le mois précédent s'il compte ≥ 1 séance (`isCurrent: false`) ; sinon pas de `month`. « Semaine dernière » ne change pas.

**Tests** (`rhythm.test.ts`, `TZ=Europe/Paris`) :
- `now` = 29/10/2026 20:00, dernière séance le 23/09 → `month` absent (et `lastWeek` absent).
- `now` = 02/11/2026, séances en octobre, aucune en novembre → `month.monthStart` = 01/10/2026, `isCurrent: false` ; à l'écran, « Octobre : 4 séances, 14 760 kg. » sur le jeu c2.
- `now` = 07/11/2026 23:59 → repli présent ; `now` = 08/11/2026 00:00 → `month` absent.
- `now` = 15/10/2026, séances en octobre → `isCurrent: true`.

### 12.5 « Objectif atteint. » insécable (n° 5)
**Modification par rapport à la revue** : un seul insécable entre « de 3 » et « atteint » laisse possible « Objectif / de 3 atteint. ». On lie tous les mots de la phrase finale.

**Où** : `src/lib/format.ts`, `formatWeekLine` (et la légende de tuile, §12.1).

**Textes exacts** (`~` = U+00A0) :
- `formatWeekLine(3, 3)` → `Cette semaine~: 3~séances sur 3. Objectif~atteint.`
- `formatWeekLine(1, 1)` → `Cette semaine~: 1~séance sur 1. Objectif~atteint.`
- `formatWeekLine(4, 3)` → `Cette semaine~: 4~séances. Objectif~de~3~atteint.`
- Rendu visible identique au tableau du §3.1.

**Tests** : égalité exacte des 3 chaînes ; mise à jour des attentes de `format.test.ts` et des tests d'écran qui comparent ces chaînes. Playwright 375 × 667, profil (b) : sur Séances et sur le récap, « Objectif atteint. » sur une seule ligne (critère 12 bis).

### 12.6 Titre de courbe à un seul point (n° 6)
**Modification par rapport à la revue** : on ne retient pas « Première fois en <exercice en minuscules> ». Mettre en minuscules un nom créé par l'utilisateur casse les sigles et les noms propres (« RDL », « Curl Zottman »), et « en » ne va pas avec tous les noms. Le nom de l'exercice est déjà affiché juste au-dessus, dans le sélecteur.

**Où** : `src/lib/format.ts`, `formatProgressSentence` (branche `points.length === 1` et son JSDoc).

**Texte exact** : `{ headline: 'Première séance sur cet exercice' }`, sans point final (comme « Stable depuis 4 semaines »), sans `note`.

**Tests** : `format.test.ts` (cas « un seul point ») → `'Première séance sur cet exercice'` ; `dataPages.test.tsx` (`.progress-sentence`) mis à jour ; 2 séances comptées dont une seule avec l'exercice choisi → le titre ne contient pas « séance enregistrée » (critère 29). Le jalon du récap « Première séance enregistrée. Bienvenue. » ne change pas.

### 12.7 Ce qui ne change pas
Accent, couleurs des pastilles, ligne de semaine sur Séances (hors insécables), jalons, réglage dans Réglages, export / import, seuil de 2 séances de la carte. Pastilles déjà centrées : la correction du §4.3 ne touche que la spec, rien à coder.

### 12.8 Évolutions de l'identité (à appliquer à `docs/identity.md` avec l'implémentation)
Proposées par la revue, acceptées par le PO. Elles **précisent** des règles existantes (§9.1.4, §9.3, §4.1) et n'en assouplissent aucune.
1. **§9.2, ligne « Rythme de la semaine »**, colonne forme : ajouter « À 0 séance, on annonce l'objectif, on ne dessine pas de pastilles vides. »
2. **§9.2, ligne « Bilan »**, colonne forme : ajouter « Le bilan ne répète pas un chiffre déjà affiché à l'écran, et ne montre pas une période passée à côté d'une période en cours vide (repli sur le mois précédent du 1er au 7 seulement). »
3. **§4.1** : ajouter « Un refus est un bouton secondaire à contour, avec un libellé qui dit ce qui se passera (« Non merci » si c'est définitif, « Plus tard » seulement si on redemande). »
