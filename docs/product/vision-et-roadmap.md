# MuscuTrack : vision et roadmap

*Product owner, 28 octobre 2026. Premier document produit : aucune décision précédente dans `docs/product/`.*

Sources lues : `README.md`, `docs/SPEC.md`, `docs/identity.md`, `docs/brand/README.md`, les 4 rapports `docs/review-2026-10-28*.md`, `src/lib/` (stats, session, templates, format, storage, types) et `src/pages/`. Je n'ai pas regardé `src/styles.css`, qui est en cours de migration vers Améthyste.

---

## Vision

1. MuscuTrack est le carnet de muscu le plus **clair** du téléphone. À chaque écran, on sait où on est, quoi faire et ce qui a changé.
2. On revient à la salle parce qu'on **voit sa progression réelle** : une charge proposée, un record, une semaine tenue. Pas de points, de badges ou de séries de jours.
3. L'app est hors ligne, sans compte et sans collecte de données, et elle est prête pour l'**App Store**.

---

## Ce qui existe déjà (inventaire)

| Domaine | État | Où |
|---|---|---|
| Séances types : créer, modifier, dupliquer, supprimer (toast « Annuler »), durée estimée, dernier passage | Fait | `TemplatesPage`, `TemplateEditorPage`, `lib/templates.ts` |
| Séance suggérée : celle qui n'a pas été faite depuis le plus longtemps, la seule en accent | Fait | `stats.suggestedTemplateId` |
| Séance un exercice à la fois, −/+ (2,5 kg et 1 rep), « Dernière fois : 80 kg × 8 » par série, minuteur, reprise après rechargement | Fait | `ActiveSessionPage`, `lib/session.ts` |
| Pré-remplissage avec **les valeurs de la dernière fois** (sinon l'objectif de la séance type) | Fait. **Il recopie, il ne fait jamais progresser** | `session.prefillSets` |
| Récap : phrase de synthèse, durée, volume, séries, records battus (un seul par exercice), « Mettre à jour la séance type » | Fait | `SessionSummaryPage`, `stats.detectNewRecords` |
| Progrès : 1RM, poids max et volume, phrase « +9,5 kg en 8 semaines », records | Fait | `ProgressPage`, `format.formatProgressSentence` |
| Compteurs « Séances / Cette semaine / Ce mois » | Fait. Ce sont des chiffres seuls, **sans objectif ni comparaison** | `ProgressPage`, `stats.sessionsThisWeek` |
| Bibliothèque de 32 exercices, exercices personnalisés | Fait | `lib/defaultExercises.ts` |
| Export et import JSON, réinitialisation | Fait (export par téléchargement, ce qui **ne marche pas tel quel dans une app iOS emballée**) | `SettingsPage`, `lib/storage.ts` |
| Vibration en fin de repos | `navigator.vibrate`, **inopérant sur iOS** | minuteur |
| Programmes de départ, onboarding, rappels, notifications, réglages de préférence | **Absents** | – |
| Emballage natif (Capacitor), confidentialité, assets App Store | **Absents**. Le manifest PWA existe, avec les icônes 192 et 512 de l'ancienne marque | `vite.config.ts`, `public/icons/` |

Ce qui manque pour l'engagement : l'app **mesure** bien la progression, mais elle ne la **provoque** pas. Elle ne propose jamais de monter la charge. Elle n'aide pas non plus un nouveau venu à faire sa première séance (l'écran vide renvoie vers un constructeur vide) et ne donne aucun cadre de régularité.

### Ce que font les apps de référence, et ce qu'on en garde

- **Strong** : carnet très sobre, « dernière fois » visible. On garde la sobriété. Sa limite : il ne suggère rien, c'est à l'utilisateur de décider de progresser.
- **Hevy** : la suggestion de charge (« Hevy Trainer ») est payante. L'app est aussi très sociale (fil, likes). On garde la suggestion de charge, on refuse le social.
- **Fitbod** : charges générées par algorithme, avec beaucoup de réglages et peu d'explications. Ça va contre la clarté, car on ne sait pas d'où vient le chiffre. Chez nous, chaque suggestion dit **pourquoi** : « La dernière fois : 80 kg × 8 à chaque série. »
- **Jefit** : badges, points, classements. C'est exactement ce que `identity.md` §2 interdit.

---

## Roadmap

Lots classés du plus rentable au moins rentable. Valeur : ce que le lot apporte à l'utilisateur et à l'objectif App Store. Risque clarté : ce qui pourrait abîmer l'identité.

| # | Lot | Pilier | Valeur | Effort | Risque clarté |
|---|---|---|---|---|---|
| 1 | Charge proposée (surcharge progressive) | Engagement | Très forte : utile à chaque séance, et c'est la vraie raison de progresser | M | Faible : une ligne de texte, sans nouvel accent |
| 2 | Première séance en 2 minutes (programmes de départ) | Engagement + Clarté | Forte : premier contact, nouveaux utilisateurs, et ce que voit le relecteur Apple | M | Faible : remplace un écran vide par un choix guidé |
| 3 | Ton rythme : objectif hebdo choisi, bilan, jalons | Engagement | Moyenne à forte : donne un cadre pour revenir | M | Moyen : c'est le plus près de la gamification, d'où les garde-fous ci-dessous |
| 4 | Préparation App Store | Publication | Indispensable pour publier. Il apporte aussi les rappels et notifications de repos (règle 4.2) | L (code) + actions du propriétaire | Faible |
| – | Plus tard : HealthKit, record annoncé pendant la séance, Android | – | – | – | – |

Pourquoi cet ordre :
- **Lot 1 d'abord** : il sert dès la prochaine séance du propriétaire, avec des données qui existent déjà (`lastPerformance`, objectifs de la séance type). Il ne demande aucun nouvel écran.
- **Lot 2 ensuite** : il ne sert qu'aux nouveaux utilisateurs, donc il prend toute sa valeur juste avant la publication. Il doit être prêt avant le lot 4, car un relecteur Apple qui ouvre une app vide et doit tout construire, c'est un risque de refus 4.2.
- **Lot 3** vient après le lot 1 parce qu'il a besoin d'un historique pour avoir du sens. C'est aussi lui qui demande le plus de garde-fous d'identité.
- **Lot 4 en dernier** dans l'ordre de développement, mais les actions du propriétaire (compte, Mac) peuvent **démarrer dès maintenant** en parallèle (voir 4.B).

---

### Lot 1 — Charge proposée · effort M

**Objectif** : quand tu as réussi toutes tes séries la dernière fois, la séance suivante te propose de monter, et te dit pourquoi. Tu n'as rien à calculer ni à taper.

**Règle de progression retenue** : une double progression simple, celle d'un coach de salle. Si toutes les séries de travail de la dernière fois ont atteint l'objectif de reps à la même charge, on ajoute 2,5 kg (le pas des boutons −/+). Sinon, on garde la charge. Au poids du corps, on ajoute 1 rep.

#### User stories
- **US1.1** En tant que pratiquant qui suit une séance type, je veux que la charge soit montée de 2,5 kg quand j'ai réussi toutes mes séries la dernière fois, pour progresser sans avoir à y penser.
- **US1.2** En tant que pratiquant, je veux savoir pourquoi la charge a changé, pour faire confiance au chiffre.
- **US1.3** En tant que pratiquant qui ne se sent pas en forme, je veux revenir à la charge de la dernière fois en un tap, pour rester maître de ma séance.
- **US1.4** En tant que pratiquant qui préfère gérer ses charges seul, je veux pouvoir couper la suggestion, pour retrouver le comportement actuel.

#### Règle de calcul (fonction pure, dans `src/lib/`, par exemple `progression.ts`)

Entrées : l'objectif de la séance type pour cet exercice (`TemplateExercise` : `targetSets`, `targetReps`) et la dernière performance (`lastPerformance(history, exerciseId)` : les séries validées de la dernière séance terminée qui contient l'exercice).

La suggestion existe **seulement si toutes** les conditions suivantes sont vraies. Sinon, il n'y a pas de suggestion et le comportement actuel reste identique.
1. La séance est démarrée **depuis une séance type**. Pas de suggestion en séance libre ni pour un exercice ajouté à la volée.
2. Le réglage « Suggérer la charge suivante » est activé (il l'est par défaut).
3. Une dernière performance existe.
4. `targetReps ≥ 1`.
5. Le nombre de séries validées la dernière fois est ≥ `targetSets` (et `targetSets ≥ 1`).
6. Toutes ces séries validées ont **la même charge** W. Une pyramide ou des séries dégressives ne déclenchent pas de suggestion.
7. Toutes ces séries ont `reps ≥ targetReps`.
8. La séance de référence (la dernière fois) a commencé il y a **28 jours ou moins**. Après une pause plus longue, pas de proposition : le pré-remplissage reprend simplement les valeurs de la dernière fois, sans note. *(Révisé le 29/10 après revue design.)*

Résultat :
- **Si W > 0** : charge proposée = W + 2,5 kg et reps proposées = `targetReps`. Si W + 2,5 > `MAX_WEIGHT` (1 000 kg), pas de suggestion.
- **Si W = 0** (poids du corps) : charge 0 et reps proposées = (plus petit nombre de reps de la dernière fois) + 1. Si ce résultat dépasse `MAX_REPS`, pas de suggestion.

Exemples (à reprendre tels quels comme cas de test) :

| Objectif | Dernière fois (séries validées) | Résultat |
|---|---|---|
| 3 × 8 | 80 × 8, 80 × 8, 80 × 8 | 82,5 kg × 8 sur les 3 séries |
| 3 × 8 | 80 × 10, 80 × 9, 80 × 8 | 82,5 kg × 8 |
| 3 × 8 | 80 × 8, 80 × 8, 80 × 7 | pas de suggestion (une série sous l'objectif) |
| 4 × 8 | 80 × 8, 80 × 8, 80 × 8 | pas de suggestion (3 séries validées sur 4) |
| 3 × 8 | 70 × 8, 75 × 8, 80 × 8 | pas de suggestion (charges différentes) |
| 3 × 10 | 0 × 10, 0 × 12, 0 × 10 (tractions) | 11 reps sur les 3 séries |
| 3 × 8 | aucune séance passée | pas de suggestion (l'objectif s'affiche comme aujourd'hui) |
| 3 × 8 | 80 × 8 × 3, mais en séance libre | pas de suggestion |
| 3 × 0 | 80 × 8 × 3 | pas de suggestion |
| 3 × 8 | 80 × 8 × 3, il y a 29 jours | pas de suggestion (longue pause), valeurs de la dernière fois |

Si un exercice figure deux fois dans la même séance type, chaque occurrence est calculée de la même façon, avec son propre objectif.

#### Comportement en séance

- **Pré-remplissage** : à la création de la séance (`createSessionFromTemplate`), quand une suggestion existe, **toutes** les séries de l'exercice sont pré-remplies avec la charge et les reps proposées, au lieu des valeurs de la dernière fois. Le nombre de séries reste `targetSets`.
- **Note de coach** : sur l'écran de l'exercice, sous son nom et au-dessus de la liste des séries, deux lignes :
  - ligne 1, en texte principal 16 px / 600, précédée de l'icône Lucide `TrendingUp` (20 px, `aria-hidden`) :
    - charge : « Charge proposée : 82,5 kg »
    - poids du corps : « Reps proposées : 11 reps »
  - ligne 2, en texte secondaire 13 px :
    - si toutes les séries de la dernière fois ont le même nombre de reps R : « La dernière fois : 80 kg × 8 à chaque série. » (au poids du corps : « La dernière fois : 10 reps à chaque série. »)
    - sinon : « La dernière fois : 80 kg, 8 reps ou plus à chaque série. » (au poids du corps : « La dernière fois : 10 reps ou plus à chaque série. »)
  - Les nombres et les unités passent par les fonctions existantes (`formatWeight`, `formatCount`, `formatSetValues`), avec un espace insécable et la virgule décimale. Espace insécable avant « : ».
- **Bouton « Rester à 80 kg »** (au poids du corps : « Rester à 10 reps ») : bouton secondaire à contour (classe `btn` par défaut : bordure `--border`, rayon 999 px, 48 px de haut, largeur au contenu, sans accent), avec l'icône Lucide `Undo2` (`aria-hidden`) avant le libellé, sous la note. *(Révisé le 29/10 après revue design : le bouton fantôme se lisait comme du texte.)*
  - Au tap : toutes les séries **non validées** de l'exercice reprennent les valeurs de la dernière fois, série par série, exactement comme le pré-remplissage actuel. La note disparaît. Un toast « Charge remise à 80 kg. » (« Reps remises à 10 reps. » au poids du corps) s'affiche avec « Annuler » pendant 5 s. « Annuler » remet les valeurs proposées et la note. Le toast se ferme dès qu'une série de cet exercice est validée ; « Annuler » retrouve l'exercice par référence, pas par sa position dans la séance.
  - Toute la note (lignes 1 et 2, bouton) disparaît dès qu'une série de l'exercice est validée : la carte affiche déjà « Dernière fois : 80 kg × 8 », et la place compte pendant le repos sur iPhone SE. *(Révisé le 29/10 après revue design.)*
  - Si l'utilisateur modifie la charge avec −/+ avant de valider, la note reste. Elle explique la proposition, pas la valeur actuelle.
- **Rien d'autre ne change** :
  - la ligne par série « Dernière fois : 80 kg × 8 » reste (règle §4.4) ;
  - « Valider la série » reste la seule action accent ;
  - la note n'utilise ni l'accent ni le vert de succès (le vert reste réservé aux records) ;
  - pas de « ! » (ce n'est pas encore un record).
- **Persistance** : la suggestion est enregistrée dans l'exercice de séance, pour que la note survive à un rechargement. Par exemple `SessionExercise.suggestion?: { fromWeight, fromReps, toWeight, toReps, sameReps: boolean }` ; le nom exact est laissé au développeur.
  - Le champ est optionnel et rétrocompatible.
  - `parseAppState` doit l'accepter : aujourd'hui le parseur reconstruit les objets et supprimerait un champ inconnu.
  - Il est retiré par `finishSession`, comme `currentExerciseIndex`.
  - « Rester à 80 kg » le supprime ; « Annuler » le remet.
- **Récap** : rien à ajouter. Si la charge proposée bat le meilleur poids, `detectNewRecords` affiche déjà « Nouveau record en développé couché : 82,5 kg ! ».

#### Réglage

- Dans Réglages, nouvelle section « Séance », placée **avant** « Sauvegarde ».
  - Un interrupteur (`role="switch"`, cible ≥ 48 px) intitulé « Suggérer la charge suivante », activé par défaut.
  - En dessous, en texte secondaire : « Quand tu as réussi toutes tes séries, la séance suivante propose 2,5 kg de plus (ou 1 rep au poids du corps). »
- Le réglage est stocké dans l'état persistant, par exemple `AppState.settings?: { suggestLoad: boolean }`. Absent = activé. Il est inclus dans l'export et accepté à l'import. Un fichier exporté avant ce lot s'importe sans erreur.
- Le réglage s'applique aux séances **démarrées après** le changement. La séance en cours n'est pas modifiée.

#### Critères d'acceptation (testables)

*Révisé le 29/10 après revue design : critères 1, 2, 3, 5, 6, 7 et 8 modifiés, critères 15 et 16 ajoutés.*

1. Avec une séance type « Haut du corps » (développé couché 3 × 8), et une séance terminée hier à 80 × 8, 80 × 8, 80 × 8 : « Démarrer la séance » affiche les 3 séries à **82,5 kg et 8 reps**, « Charge proposée : 82,5 kg » et « La dernière fois : 80 kg × 8 à chaque série. »
2. Les 10 lignes du tableau d'exemples (dont la longue pause de plus de 28 jours) sont couvertes par des tests unitaires de la fonction pure et donnent exactement le résultat indiqué. La date de la séance de référence et la date courante sont passées en paramètres.
3. Dernière fois 80 × 10, 80 × 9, 80 × 8 (objectif 3 × 8) : la ligne 2 est « La dernière fois : 80 kg, 8 reps ou plus à chaque série. »
4. Sans suggestion (cas « 80 × 7 » par exemple), l'écran est identique à aujourd'hui : pas de note, pas de bouton « Rester à », valeurs de la dernière fois.
5. « Rester à 80 kg » est un bouton secondaire à contour (bordure visible, rayon 999 px, 48 px de haut, largeur au contenu), précédé de l'icône `Undo2` en `aria-hidden` ; l'écran garde un seul aplat accent. Au tap, les séries non validées passent à 80 kg et reprennent les reps de la dernière fois. La note disparaît. Le toast « Charge remise à 80 kg. » propose « Annuler » pendant 5 s, et « Annuler » rétablit 82,5 kg × 8 et la note. Le toast se ferme dès qu'une série de l'exercice est validée.
6. Après la validation de la série 1, toute la note (« Charge proposée : 82,5 kg », ligne 2 et bouton « Rester à 80 kg ») n'est plus dans le DOM ; la référence « Dernière fois : 80 kg × 8 » reste dans la carte. À 375 × 667, pendant le repos après la série 1 (4 séries), le bas de la carte en cours est au-dessus du haut du bloc du minuteur.
7. Rechargement de la page au milieu de l'exercice : même charge, même état de la note et du bouton (masqués après la série 1).
8. Tractions (3 × 10, dernière fois 10, 12, 10 reps au poids du corps) : séries pré-remplies à 11 reps ; « Reps proposées : 11 reps » ; « La dernière fois : 10 reps ou plus à chaque série. » ; bouton « Rester à 10 reps ».
9. Séance libre ou exercice ajouté à la volée : jamais de note.
10. Réglage coupé dans Réglages, puis nouvelle séance : aucune suggestion, pré-remplissage identique à aujourd'hui. Le réglage survit à un rechargement et à un export puis un import.
11. Un export JSON fait **avant** ce lot s'importe sans erreur. Le réglage vaut alors « activé ».
12. Contrôles de la revue design, à 390 × 844, en clair et en sombre : au plus un aplat accent (« Valider la série ») ; aucune cible < 48 px ; aucun texte < 13 px ; « Valider la série » reste visible sans défiler avec la note affichée, et avec 4 séries.
13. Lecteur d'écran : la note est lue avant la liste des séries. L'icône est ignorée (`aria-hidden`).
14. `npm test`, `npm run typecheck` et `npm run build` passent.
15. Longue pause : la dernière séance « Haut du corps » a commencé il y a 30 jours (80 × 8 × 3). « Démarrer la séance » affiche les séries à 80 kg × 8, sans note ni bouton « Rester à ».
16. De bout en bout : « Rester à 80 kg », valider les séries puis terminer enregistre 80 kg dans l'historique ; proposition acceptée, valider puis terminer enregistre 82,5 kg.

---

### Lot 2 — Première séance en 2 minutes · effort M

> **Spécification détaillée : [`lot2-programmes.md`](lot2-programmes.md)** (29 octobre 2026). Elle fait foi : contenu exact des programmes, écrans, textes, cas limites, parcours en 5 taps et 18 critères d'acceptation.

**Objectif** : un nouveau venu valide sa première série en 5 taps (moins de 2 minutes) après le premier lancement, sans compte, sans questionnaire et sans construire de séance.

#### User stories
- **US2.1** En tant que débutant qui ouvre l'app pour la première fois, je veux choisir un programme prêt à l'emploi, pour démarrer ma séance tout de suite.
- **US2.2** En tant que débutant, je veux une charge de départ que je comprends, pour ne pas bloquer devant un chiffre au hasard.
- **US2.3** En tant qu'utilisateur déjà installé, je veux pouvoir ajouter un programme de départ plus tard, pour changer de routine sans tout recréer.
- **US2.4** En tant qu'utilisateur qui s'est trompé de programme, je veux annuler l'ajout en un tap.

#### En bref
- 3 programmes (Full body, Haut / Bas, Poids du corps) qui créent 5 séances types ordinaires, modifiables, sans rien de verrouillé.
- **Changement par rapport à la version du 28 octobre** : les programmes ne contiennent plus que des exercices à la barre (20 kg, barre seule) ou au poids du corps (0). Tirage vertical, curl haltères, extension triceps poulie, presse à cuisses et leg curl sont retirés, parce que leurs charges de départ (25, 8, 15, 40, 20 kg) étaient arbitraires d'une salle à l'autre. Ils sont remplacés par tractions, dips et hip thrust.
- État vide de Séances : « Choisir un programme » en accent. Liste non vide : « Ajouter un programme de départ » en secondaire.
- Ajout annulable 5 s par le toast. Si un nom existe déjà, l'ajout porte le suffixe « (2) », et on ne fusionne jamais.
- Première fois sur un exercice : « Première fois : vise 20 kg × 8, ajuste si besoin. » remplace « prends une charge que tu soulèves 10 fois sans forcer », qui contredisait la valeur pré-remplie.

---

### Lot 3 — Ton rythme : objectif hebdo choisi, bilan, jalons · effort M

**Objectif** : donner un cadre pour revenir, que **tu choisis toi-même**. On montre ce qui est fait, jamais ce qui a été raté.

#### User stories
- **US3.1** En tant que pratiquant, je veux choisir combien de séances je vise par semaine, pour avoir un repère réaliste.
- **US3.2** En tant que pratiquant, je veux voir où j'en suis dans ma semaine, pour décider d'aller m'entraîner.
- **US3.3** En tant que pratiquant, je veux un bilan de ma semaine passée et de mon mois, pour voir le chemin parcouru.
- **US3.4** En tant que pratiquant, je veux qu'on marque les étapes (10ᵉ séance, etc.), sans fanfare.

#### Comportement
- **Choix du rythme** :
  - dans Réglages, section « Séance », champ « Rythme visé » avec les choix « Aucun » (défaut), 1, 2, 3, 4, 5 ou 6 séances par semaine, en pastilles de 48 px ;
  - texte d'aide : « Un repère pour toi. Une semaine sous ce rythme n'est jamais comptée contre toi. » ;
  - sur Progrès, tant que le rythme vaut « Aucun » et qu'au moins 2 séances sont terminées, une carte secondaire affiche « Combien de séances par semaine veux-tu viser ? », les pastilles 2, 3 et 4, et un bouton « Plus tard ». « Plus tard » masque la carte définitivement (on peut toujours régler le rythme dans Réglages).
- **Où en est la semaine** (semaine du lundi au dimanche, déjà implémentée par `startOfWeek`) :
  - sur Séances, sous le titre, en texte secondaire 13 px : « Cette semaine : 1 séance sur 3. » ;
  - une fois l'objectif atteint : « Cette semaine : 3 séances sur 3. Objectif atteint. » ;
  - au-delà : « Cette semaine : 4 séances. Objectif de 3 atteint. » ;
  - avec le rythme « Aucun » : « Cette semaine : 1 séance. », ou rien du tout s'il n'y a eu aucune séance cette semaine.
- Sur Progrès, la tuile « Cette semaine » affiche « 2 sur 3 » et une rangée de N pastilles rondes : remplies en encre pour les séances faites, en contour pour les autres. Les crans biseautés à 12° restent réservés à la progression de séance (`docs/brand/README.md`, B · Améthyste).
- **Fin de semaine** : le compteur repart à 0 le lundi. Aucun message sur la semaine écoulée si l'objectif n'est pas atteint.
- **Bilan** : sur Progrès, sous les tuiles, deux lignes.
  - « Semaine dernière : 3 séances, 14 520 kg, 1 record. » (le nombre de records = les records battus par les séances de cette semaine, via `strongestRecords(detectNewRecords(...))`) ;
  - « Octobre : 11 séances, 52 300 kg, 4 records. » pour le mois en cours ;
  - le segment « records » est omis quand il vaut 0, et la ligne « Semaine dernière » est omise s'il n'y a eu aucune séance la semaine dernière.
- **Jalons** : dans le récap, sous la phrase de synthèse, en texte secondaire, une seule ligne quand la séance qui se termine porte le total à 1, 10, 25, 50, 100, 200, 300… (puis tous les 100) :
  - « Première séance enregistrée. Bienvenue. »
  - « 10ᵉ séance enregistrée. »
  - pas de « ! », pas d'icône ni d'animation.

#### Critères d'acceptation
1. Rythme 3, une séance faite lundi : Séances affiche « Cette semaine : 1 séance sur 3. »
2. Rythme 3, 3 séances faites : « Cette semaine : 3 séances sur 3. Objectif atteint. » ; avec 4 séances : « Cette semaine : 4 séances. Objectif de 3 atteint. »
3. Lundi suivant, 0 séance : Séances n'affiche **rien** sur la semaine écoulée, et aucun texte de l'app ne contient « raté », « manqué », « perdu » ou « série » au sens d'une suite de jours (test grep sur `src/`).
4. Rythme « Aucun » : aucune pastille ; la tuile affiche le nombre seul, comme aujourd'hui.
5. Bilan et jalons : tests unitaires sur les bornes de semaine et de mois (fuseau local, dimanche 23 h 59, lundi 0 h 00) et sur la suite 1, 10, 25, 50, 100, 200.
6. La carte « Combien de séances… » n'apparaît plus après « Plus tard », même après un rechargement.
7. Le rythme est inclus dans l'export et l'import. Les anciens exports s'importent avec le rythme « Aucun ».
8. Revue design : aucun nouvel aplat accent sur Séances, Progrès et récap.

---

### Lot 4 — Préparation App Store · effort L (code) + actions du propriétaire

**Objectif** : une app iOS native, emballée avec Capacitor. Elle fait plus qu'un site web (règle 4.2), ne collecte aucune donnée, et ses données survivent aux mises à jour.

Note sur la règle 4.2 (*Minimum Functionality*) : en octobre 2026, elle reste le motif de refus le plus courant pour les applis web emballées. Apple attend des fonctions et une interface qui vont au-delà d'un site reconditionné. Notre argument : app entièrement hors ligne, notifications locales de fin de repos et de rappel, retour haptique, écran maintenu allumé en séance, partage natif de la sauvegarde, et aucun contenu chargé depuis le web.

#### 4.A — Faisable dans le code maintenant

**User stories**
- **US4.1** En tant que pratiquant, je veux être prévenu de la fin du repos même si l'écran est verrouillé, pour ne pas surveiller le minuteur.
- **US4.2** En tant que pratiquant, je veux des rappels de séance optionnels aux jours et à l'heure que je choisis, pour tenir mon rythme.
- **US4.3** En tant que pratiquant, je veux que mes données survivent aux mises à jour de l'app et que ma sauvegarde passe par la feuille de partage d'iOS, pour ne rien perdre.

**Travaux et critères**
1. **Capacitor (iOS)** : `capacitor.config.ts` avec `appId` (voir questions, défaut `fr.muscutrack.app`) et `appName` « MuscuTrack ». Un script `npm run build:ios` construit `dist/` sans service worker (le SW sert au web, pas à l'app native) et lance `npx cap sync ios`. L'app est réservée à l'iPhone (`TARGETED_DEVICE_FAMILY = 1`), ce qui évite les captures iPad. *Critère : `npm run build` (web) est inchangé et le service worker n'est pas enregistré dans la version iOS.*
2. **Stockage durable** : la couche `lib/storage.ts` passe par une interface. En natif, elle écrit dans `@capacitor/preferences` ou dans un fichier JSON via `@capacitor/filesystem`, plutôt que dans le `localStorage` de la WebView, qu'iOS peut purger. Migration automatique depuis `localStorage` au premier lancement. *Critère : test d'une migration d'un état complet (séances, séance en cours, réglages) sans perte.*
3. **Notification de fin de repos** (`@capacitor/local-notifications`) :
   - programmée au lancement du minuteur, annulée par « Passer », par −15 s / +15 s (puis reprogrammée) et par la fin de séance ;
   - texte : titre « Repos terminé. », corps « Série suivante : développé couché, 82,5 kg × 8. » ;
   - si l'app est au premier plan, pas de notification, seulement l'haptique.
   - L'autorisation est demandée **au premier minuteur**, jamais au lancement : feuille « Être prévenu à la fin du repos ? » avec « Autoriser » et « Pas maintenant ». Si l'utilisateur refuse, on ne redemande pas ; le réglage reste disponible dans Réglages.
4. **Rappels de séance** (dans Réglages, section « Rappels », désactivés par défaut) :
   - choix des jours (L M M J V S D, pastilles de 48 px) et de l'heure (défaut 18:00) ;
   - texte : « C'est l'heure de ta séance. Suggérée : Jambes. » ;
   - aucun rappel le jour où une séance est déjà terminée : on reprogramme à chaque ouverture de l'app et à chaque fin de séance ;
   - jamais de texte de relance du type « Ça fait 5 jours… ».
5. **Haptique** (`@capacitor/haptics`) : impact léger à « Valider la série », notification de succès à la fin du repos. Remplace `navigator.vibrate`, qui ne fonctionne pas sur iOS.
6. **Écran allumé** pendant le mode séance, relâché à la sortie, avec un plugin keep-awake.
7. **Export par feuille de partage** : `@capacitor/filesystem` puis `@capacitor/share` partagent le fichier `muscutrack-AAAA-MM-JJ.json`. L'import par sélection de fichier reste tel quel. *Critère : sur iPhone, « Exporter mes données » ouvre la feuille de partage iOS.*
8. **Intégration iOS** :
   - zones sûres (`env(safe-area-inset-*)`) pour la barre du bas, le bouton fixe et les toasts ;
   - barre d'état en clair et en sombre (`@capacitor/status-bar`) ;
   - écran de lancement aux couleurs Améthyste (`@capacitor/splash-screen`) ;
   - aucun lien externe ouvert dans la WebView.
9. **Confidentialité** :
   - `PrivacyInfo.xcprivacy` déclare zéro donnée collectée, zéro traçage et les API à raison requise utilisées par les plugins (par exemple UserDefaults) ;
   - `ITSAppUsesNonExemptEncryption = false` ;
   - une page statique `confidentialite.html` publiée sur GitHub Pages : « MuscuTrack ne collecte aucune donnée. Tout reste sur ton téléphone. Aucun compte, aucun serveur, aucun outil de mesure d'audience. »
10. **Assets** :
    - icône 1024 × 1024 sans transparence ni coins arrondis, tirée de `docs/brand/hybride-b/logo-app.svg` (B · Améthyste) ; icônes PWA 192 et 512 regénérées ;
    - script Playwright de captures à 440 × 956 @3x = **1320 × 2868** (iPhone 6,9 pouces), avec un jeu de données de démo, en clair et en sombre : Séances, Séance (avec « Charge proposée »), Récap avec record, Progrès ;
    - textes de la fiche, en français :
      - sous-titre (30 caractères max) : « Ton carnet de muscu, clair » ;
      - mots-clés (100 caractères max) : « musculation,salle,carnet,séance,charge,progression,record,entraînement,sport,force » ;
      - description de 4 paragraphes qui reprend la vision.

**Effort** : L, à découper en 4a (items 1, 2, 7, 8 et 9), 4b (3, 5 et 6) et 4c (4 et 10).

#### 4.B — Actions du propriétaire (non faisables dans le code)

| Action | Coût / prérequis | Quand |
|---|---|---|
| S'inscrire à l'**Apple Developer Program** (individuel par défaut : le nom légal du propriétaire apparaîtra comme vendeur) | 99 €/an, identifiant Apple avec double authentification, pièce d'identité | **Dès maintenant** (la validation prend de quelques heures à quelques jours) |
| Disposer d'un **Mac avec la version de Xcode** qu'Apple exige au moment de l'envoi (SDK iOS récent obligatoire) | Mac personnel, ou Mac en location / CI macOS dans le cloud (Codemagic, runners macOS de GitHub Actions) | Avant le lot 4a |
| Un **iPhone de test** et TestFlight | – | Lot 4b (notifications et haptique se testent sur un vrai appareil) |
| Créer l'app dans **App Store Connect** : nom (vérifier que « MuscuTrack » est libre), identifiant de bundle, catégorie *Santé et forme physique*, prix gratuit | – | Lot 4c |
| Remplir les **étiquettes de confidentialité** : « Données non collectées » ; questionnaire d'âge (4+) ; URL de confidentialité et de support | – | Lot 4c |
| **Statut de professionnel (DSA, UE)** : obligatoire pour être distribué dans l'UE. App gratuite sans revenus : se déclarer « non professionnel » | – | Lot 4c |
| Envoyer en revue, répondre au relecteur. Rédiger les notes de revue : « App hors ligne, sans compte. Pour tester : Choisir un programme → Full body → Démarrer la séance. » | – | Fin du lot 4 |

---

### Plus tard (non priorisé)

- **HealthKit** (enregistrer les séances comme entraînements) : un bel argument pour la règle 4.2, mais il demande une justification de confidentialité et une revue plus stricte. À faire après une première publication acceptée.
- **Record annoncé pendant la séance** : « Nouveau record en développé couché : 82,5 kg ! », avec le petit « pulse » prévu en §6, au moment où la série est validée. C'est un effort S qui s'appuie sur le lot 1.
- **Android / Play Store** : presque gratuit une fois Capacitor en place (25 $ une fois). Pas prioritaire.

---

## Non-objectifs

| On refuse | Pourquoi |
|---|---|
| Séries de jours (« streaks »), flammes, compteurs à ne pas casser | `identity.md` §2 : culpabilisant. La régularité se mesure à la semaine, selon le rythme choisi (lot 3) |
| Badges, points, niveaux, confettis, trophées | Gamification bruyante. Les jalons restent une ligne de texte |
| Pourcentages de réussite (« 67 % de ton objectif ») | `identity.md` §2. On écrit « 2 séances sur 3 », un compte, jamais un taux |
| Messages de relance ou de reproche (« Tu n'es pas venu depuis 5 jours ») | Culpabilisant. Les rappels sont choisis, à heure fixe, et neutres |
| Social, fil d'actualité, classements | Ça éloigne de la pratique, ça demande un compte et un serveur, et ça casse « aucune donnée collectée » |
| Compte, synchronisation cloud, mesure d'audience | Promesse « sans compte, sans collecte ». L'export par feuille de partage suffit |
| Coach IA ou programmes générés par algorithme opaque | Un chiffre qu'on ne peut pas expliquer n'est pas clair. Chaque suggestion dit pourquoi |
| Décharge automatique (« deload »), périodisation, RPE | Trop de concepts pour la v1. La double progression couvre 90 % des besoins |
| Abonnement ou fonctions payantes | Pas de modèle économique demandé. Gratuit par défaut |
| iPad, Apple Watch | Ça multiplie les captures et les tests. iPhone d'abord |

---

## Évolutions de l'identité

Ce qui demande de toucher `identity.md` est proposé dans `docs/product/identite-engagement.md` (nouveau §9 « Engagement »). En résumé :
1. **§3, exemple d'état vide Séances** (lot 2) : « Aucune séance pour l'instant. Crée la première en 1 minute. » + « Créer une séance » devient « Aucune séance pour l'instant. Commence avec un programme ou crée la tienne. » + « Choisir un programme ».
2. **§2 « pas de pourcentages de réussite »** : préciser qu'un compte face à un objectif **choisi par l'utilisateur** (« 2 séances sur 3 ») est permis, mais qu'aucun taux ni aucune semaine « ratée » n'est affiché.
3. **§5 Réaliser** : ajouter la note « Charge proposée » à côté de la référence « Dernière fois ».
4. **§6 Couleurs** : rien de neuf. L'engagement n'introduit aucune couleur (palette B · Améthyste, en cours d'intégration).

---

## Questions pour le propriétaire

Seulement ce que je ne peux pas trancher sans toi. Pour chacune, le choix par défaut s'applique si tu ne réponds pas.

1. **La charge proposée doit-elle être pré-remplie, ou seulement affichée ?** Par défaut : pré-remplie, avec « Rester à 80 kg » pour revenir en un tap. C'est le plus fluide et ça respecte « pas de saisie ».
2. **Pas de progression : 2,5 kg partout ?** Par défaut : oui, comme les boutons −/+. On pourrait plus tard passer à 1 kg pour les haltères ou les petits muscles.
3. **Compte Apple individuel ou entreprise, et identifiant de bundle ?** Par défaut : compte individuel (ton nom légal s'affichera comme vendeur) et `fr.muscutrack.app`. L'identifiant ne peut plus changer après la première publication.
4. **As-tu un Mac ?** Par défaut, si non : CI macOS dans le cloud pour construire et envoyer, et TestFlight sur ton iPhone pour tester.
5. **App gratuite, sans achat intégré ?** Par défaut : oui, gratuite, déclarée non professionnelle au titre du DSA.
6. **Le nom « MuscuTrack » sur le Store.** Par défaut : on le garde s'il est disponible dans App Store Connect, sinon « MuscuTrack · Carnet de muscu ».

---

Sources consultées pour l'App Store et la concurrence :
- [Guideline 4.2 Minimum Functionality (technetexperts)](https://www.technetexperts.com/guideline-4-2-minimum-functionality/)
- [Minimum functionality rejection (newly.app)](https://newly.app/guides/minimum-functionality-rejection)
- [App Store Review Guidelines et applis WebView (MobiLoud)](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)
- [Forum Apple Developer, PWA emballée et App Review](https://developer.apple.com/forums/thread/829592)
- [Hevy Trainer](https://help.hevyapp.com/hc/en-us/articles/38385724273047-Hevy-Trainer-Explained-How-It-Builds-Your-Workout-Program)
- [Hevy, progressive overload](https://www.hevyapp.com/progressive-overload/)
- [Alpha Progression vs Hevy](https://alphaprogression.com/en/blog/alpha-progression-vs-hevy)
