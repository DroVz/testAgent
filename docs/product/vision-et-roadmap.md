# MuscuTrack : vision et roadmap

*Product owner, 28 octobre 2026. Premier document produit : aucune décision précédente dans `docs/product/`.*

> **Décision du 30 octobre 2026 : MuscuTrack reste une PWA, sans App Store.** Le propriétaire est le seul utilisateur, et le compte Apple Developer coûte 99 € par an. L'app est en ligne et installée sur son téléphone.
> - Le **lot 4** (`lot4-app-store.md`) est **suspendu**, pas supprimé. Le code Capacitor reste sur sa branche, non fusionné. Sont suspendus avec lui : les notifications locales, dont les rappels de séance, l'haptique native, HealthKit et Android.
> - Le lot « **PWA au maximum** » a été livré (commit ac0ca60). Il reprend du lot 4 ce que le web permet : export par la feuille de partage, écran allumé en séance, `storage.persist`, bip de fin de repos, aide à l'installation iPhone.
> - Le **lot 5** est spécifié dans [`lot5-sauvegarde-et-records.md`](lot5-sauvegarde-et-records.md) : rappel de sauvegarde, record annoncé en séance, finitions.
> - Le lot 5 a été livré (commit 2b2e5ea). Le **lot 6** est spécifié dans [`lot6-en-salle.md`](lot6-en-salle.md) : retour aux exercices sautés, note par exercice. Il liste aussi les idées écartées. Après lui, aucun lot n'est prévu sans retour du propriétaire.
> - Ce qui suit, ligne 3 de la vision comprise (« prête pour l'App Store »), est conservé tel quel pour l'historique. En cas d'écart, cette note fait foi.

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
- **Lot 4 en dernier** dans l'ordre de développement, mais les actions du propriétaire (compte, Mac) peuvent **démarrer dès maintenant** en parallèle (voir la partie B de `lot4-app-store.md`).

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

> **Spécification détaillée : [`lot3-rythme.md`](lot3-rythme.md)** (29 octobre 2026). Elle fait foi : règles de calcul, textes exacts, emplacements, réglage, persistance, cas limites et 26 critères d'acceptation.

**Objectif** : donner un cadre pour revenir, que **tu choisis toi-même**. On montre ce qui est fait, jamais ce qui manque : une semaine sous l'objectif ne laisse aucune trace.

#### User stories
- **US3.1** En tant que pratiquant, je veux choisir combien de séances je vise par semaine, pour avoir un repère réaliste.
- **US3.2** En tant que pratiquant, je veux voir où j'en suis dans ma semaine, pour décider d'aller m'entraîner.
- **US3.3** En tant que pratiquant, je veux un bilan de ma semaine passée et de mon mois, pour voir le chemin parcouru.
- **US3.4** En tant que pratiquant, je veux qu'on marque les étapes (10ᵉ séance, etc.), sans fanfare.
- **US3.5** En tant que pratiquant qui n'a pas pu venir, je veux que l'app ne me le reproche pas.

#### En bref
- **Séance comptée** = terminée avec au moins une série validée. Semaine du lundi 00:00 au dimanche 23:59, heure locale ; une séance compte pour la semaine de son début. Les tuiles existantes de Progrès passent à cette définition.
- **Objectif par semaine** dans Réglages › Séance : « Aucun » (défaut), 1 à 6, en pastilles de 48 px remplies en encre. Proposé une seule fois sur Progrès dès 2 séances comptées (2, 3, 4 ou « Plus tard »). L'objectif n'est pas historisé : il ne s'applique qu'à la semaine en cours, et un changement est immédiat.
- **Ligne de semaine** sur Séances (sous le titre) et sur le récap : « Cette semaine : 2 séances sur 3. », « … 3 séances sur 3. Objectif atteint. », « Cette semaine : 4 séances. Objectif de 3 atteint. ». À 0 séance : « Objectif de la semaine : 3 séances. », ou rien sans objectif.
- **Progrès** : tuile « Cette semaine » en « 2 sur 3 » avec N pastilles en encre ; bilan sous les tuiles (« Semaine dernière : 3 séances, 14 520 kg, 1 record. », « Octobre : … »), segments à 0 omis, jamais d'objectif dans le bilan.
- **Jalons** dans le récap, aux 1ʳᵉ, 10ᵉ, 25ᵉ, 50ᵉ, 100ᵉ séances puis tous les 100 : « 10ᵉ séance enregistrée. »
- **Changements par rapport à la version du 28 octobre** : « Rythme visé » devient « Objectif par semaine » ; « 0 séance sur 3 » devient « Objectif de la semaine : 3 séances. » ; la ligne de semaine apparaît aussi dans le récap ; les séances vides ne comptent plus ; le bilan du mois bascule sur le mois précédent quand le mois en cours est vide ; le volume est omis quand il vaut 0 ; le test « aucun mot d'échec » porte sur les fonctions du lot et non sur tout `src/` (« perdue » est légitime dans les avertissements de perte de données).

---

### Lot 4 — Préparation App Store · effort L (code) + actions du propriétaire

> **Spécification détaillée : [`lot4-app-store.md`](lot4-app-store.md)** (29 octobre 2026). Elle fait foi : versions Capacitor épinglées, structure `src/platform/` et repli web de chaque fonction, stockage durable et migration, textes exacts des notifications et de la politique de confidentialité, métadonnées et captures du Store, critères d'acceptation testables sur Windows, checklist ordonnée du propriétaire (coûts, délais) et réponse au risque 4.2.

**Objectif** : une app iOS native, emballée avec Capacitor. Elle fait plus qu'un site web (règle 4.2), ne collecte aucune donnée, et ses données survivent aux mises à jour.

#### User stories
- **US4.0** En tant que propriétaire, je veux que la même base de code produise la PWA et l'app iPhone.
- **US4.1** En tant que pratiquant, je veux être prévenu de la fin du repos même écran verrouillé.
- **US4.2** En tant que pratiquant, je veux des rappels de séance optionnels aux jours et à l'heure que je choisis, sans relance.
- **US4.3** En tant que pratiquant, je veux que mes données survivent aux mises à jour et que ma sauvegarde passe par la feuille de partage d'iOS.
- **US4.4 / US4.5** En tant que pratiquant, je veux sentir qu'une série est validée et que l'écran reste allumé pendant la séance.

#### En bref
- **Partie A, dans le code, sans Mac** : 9 sous-lots en 3 vagues. **4a** socle Capacitor 8.5.3 et `src/platform/` (build web inchangé, pas de service worker en natif), stockage dans un fichier JSON avec sauvegarde précédente et migration sans perte depuis `localStorage`, export par la feuille de partage, politique de confidentialité dans l'app et en page publique. **4b** notification de fin de repos (autorisation demandée au premier minuteur, une seule fois), haptique à la validation et au récap avec record, écran allumé (Wake Lock sur le web). **4c** rappels ponctuels sur 28 jours (désactivés par défaut, sautés si une séance comptée a déjà eu lieu ce jour-là), icône 1024 et splash générés avec `sharp` depuis la marque Améthyste, métadonnées et captures.
- Chaque fonction native a un repli web défini (souvent : cachée). Tests : Vitest avec plugins mockés, tests Node sur `dist/`, `Info.plist`, PNG et manifeste, e2e « aucune requête réseau ».
- **Changements par rapport à la version du 28 octobre** : captures en **1206 × 2622 (obligatoire)** et 1320 × 2868, et non plus 1320 × 2868 seule ; fichier JSON plutôt que Preferences ; `@capacitor/assets` écarté (abandonné) ; rappels ponctuels recalculés au lieu de rappels hebdomadaires ; mots-clés sans « muscu » ni « carnet » (déjà dans le sous-titre) ; haptique de record au récap ; plus de vibration en retard au retour de veille.
- **Partie B, chez le propriétaire** : 14 étapes ordonnées. Coût minimal 99 € par an ; 2 à 4 semaines entre l'inscription et la publication. À lancer dès maintenant : l'inscription à l'Apple Developer Program.

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
