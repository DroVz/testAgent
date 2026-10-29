# Lot 2 : première séance en 2 minutes (programmes de départ)

*Product owner, 29 octobre 2026. Ce document précise le lot 2 de `vision-et-roadmap.md`. Il remplace le détail qui s'y trouvait. En cas d'écart entre les deux, ce document fait foi.*

*Révisé le 29/10 après revue (`docs/review-2026-10-29-lot2.md`, décisions du chef de projet) : §4 (intro, note de charges, bouton indisponible, cartes, clavier, défilement après ajout, fermeture du toast), §7 (texte « Première fois »), §8 et critères 6, 7, 8, 12, 16, 17.*

Lu avant d'écrire : `docs/identity.md` (§3, §4, §5, §9), `vision-et-roadmap.md`, le lot 1 livré (commit 4930699 : `src/lib/progression.ts`, `src/lib/session.ts`, `src/pages/ActiveSessionPage.tsx`), `src/pages/TemplatesPage.tsx`, `src/lib/templates.ts`, `src/lib/undo.ts`, `src/lib/stats.ts` (`suggestedTemplateId`), `src/components/Toast.tsx` et `src/lib/defaultExercises.ts`.

---

## 1. Objectif

Un nouveau venu valide sa première série en **5 taps**, sans clavier, sans compte, sans questionnaire et sans construire de séance. Un utilisateur déjà installé peut ajouter un programme plus tard. Ce qui est créé, ce sont des **séances types ordinaires**. On peut les modifier, les dupliquer et les supprimer. Rien n'est verrouillé et aucun « programme » ne vit à part.

### User stories
- **US2.1** En tant que débutant qui ouvre l'app pour la première fois, je veux choisir un programme prêt à l'emploi, pour démarrer ma séance tout de suite.
- **US2.2** En tant que débutant, je veux une charge de départ que je comprends, pour ne pas bloquer devant un chiffre au hasard.
- **US2.3** En tant qu'utilisateur déjà installé, je veux ajouter un programme de départ plus tard, pour changer de routine sans tout recréer.
- **US2.4** En tant qu'utilisateur qui s'est trompé de programme, je veux annuler l'ajout en un tap, pour ne pas avoir à supprimer les séances une par une.

---

## 2. Règle des charges de départ

**Décision : un programme de départ ne contient que des exercices dont la charge de départ est la même dans toutes les salles.**
- **Exercice à la barre : 20 kg.** C'est la barre olympique à vide, le standard de toutes les salles. C'est la charge la plus légère possible, donc jamais dangereuse pour une première fois.
- **Exercice au poids du corps : 0 kg.** C'est la convention de l'app : `formatSetValues(0, 10)` affiche « 10 reps », et le lot 1 propose alors +1 rep.
- **Aucune machine, aucune poulie, aucun haltère.**

Pourquoi :
1. **C'est vrai** (identity §9.1.1 et §9.3, « suggestions opaques »). On peut expliquer « 20 kg, c'est la barre seule » en une phrase. « Tirage vertical : 25 kg », lui, ne veut rien dire, car chaque machine a sa propre pile de poids. La roadmap du 28 octobre proposait 25 kg au tirage vertical, 40 kg à la presse et 8 kg en curl haltères : ces chiffres étaient inventés. **Je les retire.**
2. **Ça protège le lot 1.** Une machine pré-remplie à 0 kg, validée sans retouche, serait vue comme du poids du corps. La séance suivante proposerait alors « Reps proposées : 13 reps », ce qui est faux.
3. **Ça marche avec le lot 1.** On part léger, puis la charge proposée monte de 2,5 kg à chaque séance réussie. Les premières séances servent à apprendre le geste, et la progression est visible dès la deuxième.

Conséquence assumée : pas de curl, pas de poulie et pas de presse dans les programmes. L'utilisateur les ajoute lui-même avec « Modifier », comme dans n'importe quelle séance type.

Repos :
- **120 s** pour Squat, Développé couché et Soulevé de terre roumain (les mouvements lourds) ;
- **90 s** pour tout le reste (`DEFAULT_REST_SECONDS`).

Pour les exercices au poids du corps, `targetWeight` vaut **0**, écrit explicitement et non laissé absent, pour que le test compare des objets exacts.

---

## 3. Contenu exact des 3 programmes

Format : `exerciseId` — séries × reps · charge de départ (`targetWeight`) · repos (`restSeconds`). L'ordre des lignes est l'ordre des exercices dans la séance type. Tous les ids existent dans `DEFAULT_EXERCISES`.

### 3.1 Programme « Full body » (id `full-body`)
Texte « Pour qui » : « 2 à 3 séances par semaine, en alternant A et B. Idéal pour commencer. »

**Séance type « Full body A »** (≈ 30 min)
| # | exerciseId | Séries × reps | Charge | Repos |
|---|---|---|---|---|
| 1 | `squat` | 3 × 8 | 20 kg | 120 s |
| 2 | `developpe-couche` | 3 × 8 | 20 kg | 120 s |
| 3 | `rowing-barre` | 3 × 10 | 20 kg | 90 s |
| 4 | `crunch` | 3 × 15 | 0 | 90 s |

**Séance type « Full body B »** (≈ 30 min)
| # | exerciseId | Séries × reps | Charge | Repos |
|---|---|---|---|---|
| 1 | `souleve-de-terre-roumain` | 3 × 10 | 20 kg | 120 s |
| 2 | `developpe-militaire` | 3 × 8 | 20 kg | 90 s |
| 3 | `tractions` | 3 × 5 | 0 | 90 s |
| 4 | `fentes` | 3 × 10 | 0 | 90 s |

### 3.2 Programme « Haut / Bas » (id `haut-bas`)
Texte « Pour qui » : « 4 séances par semaine, en alternant les deux. Pour aller plus loin. »

**Séance type « Haut du corps »** (≈ 40 min)
| # | exerciseId | Séries × reps | Charge | Repos |
|---|---|---|---|---|
| 1 | `developpe-couche` | 4 × 8 | 20 kg | 120 s |
| 2 | `rowing-barre` | 4 × 8 | 20 kg | 90 s |
| 3 | `developpe-militaire` | 3 × 10 | 20 kg | 90 s |
| 4 | `tractions` | 3 × 5 | 0 | 90 s |
| 5 | `dips` | 3 × 8 | 0 | 90 s |

**Séance type « Bas du corps »** (≈ 40 min)
| # | exerciseId | Séries × reps | Charge | Repos |
|---|---|---|---|---|
| 1 | `squat` | 4 × 8 | 20 kg | 120 s |
| 2 | `souleve-de-terre-roumain` | 3 × 10 | 20 kg | 120 s |
| 3 | `hip-thrust` | 3 × 10 | 20 kg | 90 s |
| 4 | `fentes` | 3 × 10 | 0 | 90 s |
| 5 | `mollets-debout` | 3 × 15 | 0 | 90 s |

### 3.3 Programme « Poids du corps » (id `poids-du-corps`)
Texte « Pour qui » : « Sans charge, à la maison ou au parc. Il te faut une barre de traction. »

**Séance type « Poids du corps »** (≈ 35 min)
| # | exerciseId | Séries × reps | Charge | Repos |
|---|---|---|---|---|
| 1 | `pompes` | 3 × 10 | 0 | 90 s |
| 2 | `fentes` | 3 × 10 | 0 | 90 s |
| 3 | `dips` | 3 × 8 | 0 | 90 s |
| 4 | `tractions` | 3 × 5 | 0 | 90 s |
| 5 | `releve-de-jambes` | 3 × 10 | 0 | 90 s |

Les durées affichées sur les cartes ne sont pas écrites en dur : elles viennent de `formatEstimatedDuration(estimateTemplateMinutes(t))`. Les valeurs ci-dessus sont celles que donne la formule actuelle (40 s d'effort + repos par série, arrondi aux 5 min).

Exercices écartés exprès :
- `gainage` : il se mesure en secondes, pas en reps.
- `souleve-de-terre` : trop technique pour un tout premier jour à la barre.

`Tractions 3 × 5` reste, même si un débutant n'en fait pas encore 5. Il enregistre ce qu'il fait (par exemple 2 reps), et l'app ne juge pas.

### 3.4 Où mettre les données (suggestion au développeur)
Un module pur `src/lib/programs.ts` :
- `STARTER_PROGRAMS: readonly StarterProgram[]`, dans l'ordre Full body, Haut / Bas, Poids du corps, avec `{ id, name, audience, templates: { name, exercises: TemplateExercise[] }[] }` ;
- `buildProgramTemplates(program, existingNames, now)`, qui renvoie les `Template` à créer via `createTemplate` (ids neufs, `createdAt = updatedAt = now`) en appliquant la règle des noms (§6.1).

Les programmes ne sont **pas** stockés dans `AppState` et aucun champ n'est ajouté à `Template`. `parseAppState` ne change pas.

---

## 4. Écran « Programmes de départ »

**Route** : `/seances/programmes`. Le segment fixe passe avant `/seances/:id` dans le classement de React Router v6, comme `/seances/nouvelle`. À vérifier par un test de route.

**Structure, de haut en bas** (plein écran, barre d'onglets visible comme sur l'éditeur) :
1. Lien retour, même composant que l'éditeur (`back-link`) : « Retour aux séances ». Il ramène à `/seances` sans rien créer.
2. Titre `h1` : « Programmes de départ ».
3. Intro, en texte secondaire : « Choisis un programme. Ses séances s'ajoutent à ta liste, et tu pourras les modifier. Les charges partent de la barre seule (20 kg) ; l'app te propose +2,5 kg quand tu réussis toutes tes séries. » *(Révisé le 29/10 après revue : la règle des charges remonte au-dessus des cartes, pour être lue sans défiler.)*
4. Les 3 cartes dans l'ordre du §3, dans un `role="radiogroup"` avec `aria-label="Programmes de départ"`. Chaque carte est un `role="radio"` avec `aria-checked`, et toute la carte est la cible tactile (au moins 48 px). Contenu d'une carte :
   - nom du programme, en titre de carte (16 px / 700 Space Grotesk, encre) : « Full body » ;
   - texte « Pour qui » (§3), en texte secondaire 16 px ;
   - une ligne par séance type, en texte secondaire, au format `<nom> · ≈ 30 min`, puis la liste des exercices séparés par « · », sans troncature. Exemple : « Full body A · ≈ 30 min » / « Squat · Développé couché · Rowing barre · Crunch » ;
   - si **toutes** les séances types du programme existent déjà sous leur nom exact : une ligne secondaire « Déjà dans tes séances. ». La carte reste sélectionnable (voir §6.1).
5. ~~Note de charges sous les cartes~~ : retirée le 29/10 après revue, son contenu est dans l'intro.
6. Action principale fixée en bas (56 px, pleine largeur, même placement que « Valider la série ») : « Ajouter ce programme » en accent une fois une carte choisie (voir « Sélection »).

**Sélection** :
- Rien n'est présélectionné, parce que le choix doit venir de l'utilisateur.
- Tant que rien n'est choisi, le bouton principal est **indisponible** (révisé le 29/10 après revue, identity §4.2) : pas d'accent (contour, fond surface, texte secondaire), libellé « Choisis un programme ci-dessus », `aria-disabled="true"` au lieu de `disabled` pour rester focalisable. Un tap fait défiler jusqu'à la première carte et lui donne le focus, sans rien créer. Une fois une carte choisie : accent, « Ajouter ce programme ».
- Clavier : les flèches déplacent le choix dans le groupe, Début et Fin vont à la première et à la dernière carte.
- Un tap sur une carte la sélectionne et désélectionne les autres. Un nouveau tap sur la carte déjà choisie ne fait rien.
- Une carte choisie a un contour de 2 px en **encre**, l'icône Lucide `Check` (20 px, `aria-hidden`) et le libellé « Choisi » en haut à droite. Pas d'accent sur les cartes : l'accent reste réservé au bouton (identity §4.2). On ne signale jamais par la couleur seule (§4.7).

**Après « Ajouter ce programme »** :
1. Les séances types du programme sont créées et ajoutées **à la fin** de `state.templates`, dans l'ordre du §3, en une seule action du store (par exemple `addTemplates(templates)`).
2. Navigation vers `/seances` avec `replace: true` : le retour du navigateur ne ramène pas sur l'écran de choix.
3. Toast flottant : « Programme ajouté : Full body (2 séances). », ou « Programme ajouté : Poids du corps (1 séance). ». Le nombre passe par `formatCount(n, 'séance')`. Le toast a un bouton « Annuler », avec le nom accessible « Annuler l'ajout du programme ». Il reste 5 s (`TOAST_DURATION_MS`).
4. **Annuler** retire exactement les séances types créées par cet ajout (par leurs ids), si elles existent encore. On revient à l'état d'avant, y compris l'état vide. Il n'y a pas de second toast. L'action est idempotente : un second appel ne fait rien.
5. **Démarrer une séance ferme ce toast** : l'ajout devient définitif. On n'a jamais une séance en cours dont la séance type a disparu. *(Révisé le 29/10 après revue : le toast porte l'option `dismissOnSessionStart`, gérée par le `ToastProvider` ; toute entrée dans l'écran de séance la ferme, quel que soit le point d'entrée (carte, séance libre, reprise) et même après être passé par un autre onglet. Aucun id de toast ne transite par l'état de navigation.)*
5 bis. **Montrer ce qui vient d'être ajouté** (ajouté le 29/10 après revue) : si la liste n'était pas vide, `/seances` défile jusqu'à la première séance créée (`scrollIntoView`, `block: 'center'`, sans animation sous `prefers-reduced-motion`), après le retour en haut fait à chaque changement de route. Liste vide : rien ne bouge, la séance créée est déjà en tête.
5 ter. **Le toast flottant ne recouvre jamais un bouton** (identity §4.8) : tant qu'il est affiché, le contenu réserve en bas sa hauteur + 8 px.
6. La séance suggérée suit la règle actuelle de `suggestedTemplateId`, **sans modification** :
   - sans historique, c'est la première séance type de la liste, donc « Full body A » pour un nouveau venu, en tête avec « Suggérée » et le bouton accent « Démarrer la séance » ;
   - si l'utilisateur a déjà un historique, la suggestion reste celle d'avant, parce qu'une séance type jamais faite n'est pas suggérée tant qu'une autre a été faite. C'est voulu : on ne bouscule pas une routine en place.

---

## 5. Écran Séances (impact sur `TemplatesPage.tsx`)

### 5.1 État vide (`state.templates.length === 0`, qu'il y ait un historique ou non)
Aujourd'hui, l'écran affiche « Aucune séance pour l'instant. » + « Crée la première en 1 minute, ou démarre une séance libre. », avec « Créer une séance » en accent. Il devient :
- titre de l'état vide : « Aucune séance pour l'instant. » (inchangé) ;
- texte secondaire : « Commence avec un programme ou crée la tienne. » (identity §3) ;
- action principale (accent, `btn--lg`, 56 px, pleine largeur) : « Choisir un programme », qui ouvre `/seances/programmes` ;
- en dessous, en secondaire et dans cet ordre : « Créer une séance » (perd l'accent) et « Séance libre » ;
- le lien « Ajouter un programme de départ » du §5.2 n'est **pas** affiché dans l'état vide, pour ne pas avoir deux entrées vers le même écran.

### 5.2 Liste non vide
- Après « Créer une séance » et « Séance libre », un troisième bouton secondaire, sans accent, de 48 px, avec l'icône Lucide `LayoutList` (20 px, `aria-hidden`) : « Ajouter un programme de départ ». Il ouvre `/seances/programmes`.
- C'est le **seul** autre accès à l'écran. Il n'y a rien dans Réglages ni dans un menu.
- Rien d'autre ne change : cartes, « Suggérée », menu « … » (Modifier, Dupliquer, Supprimer).

---

## 6. Cas limites

### 6.1 Programme déjà ajouté : doublons et noms
- On **ajoute toujours**, on ne fusionne jamais et on ne remplace jamais. Un utilisateur peut vouloir repartir d'une version vierge, et l'existante garde son historique.
- **Règle des noms**, appliquée séance par séance : si le nom N existe déjà (comparaison exacte après `trim`), on essaie « N (2) », puis « N (3) », etc., et on garde le premier nom libre. Les noms créés dans le même ajout comptent aussi.
- Exemples :
  - Full body ajouté deux fois : « Full body A (2) », « Full body B (2) » ; une troisième fois : « Full body A (3) », « Full body B (3) ».
  - L'utilisateur a renommé « Full body A » en « Lundi » : le nouvel ajout recrée « Full body A » sans suffixe, car seul le nom compte.
  - Il a déjà « Full body A » mais pas « Full body B » : on crée « Full body A (2) » et « Full body B ».
- « Déjà dans tes séances. » s'affiche sur la carte seulement si tous les noms du programme existent sous leur forme exacte, sans suffixe. Ce n'est qu'une information : il n'y a aucune confirmation en plus, et le toast « Annuler » suffit en cas d'erreur.

### 6.2 Autres cas
- **Exercice personnalisé du même nom** qu'un exercice de la bibliothèque : sans effet, puisque les programmes référencent les ids de `DEFAULT_EXERCISES`, qui ne sont pas supprimables.
- **Séance en cours** (libre ou autre) : l'écran de programmes reste accessible et l'ajout fonctionne. « Démarrer la séance » ouvre ensuite la boîte « Une séance est déjà en cours », comme aujourd'hui.
- **Réglage « Suggérer la charge suivante »** : sans effet sur le lot 2. Sans historique, il n'y a jamais de suggestion.
- **Tap rapide en double sur « Ajouter ce programme »** : une seule création. Le bouton navigue dès le premier tap, et l'écran n'existe plus au second.
- **Mode hors ligne** : tout est local, rien ne change.
- **Import d'une sauvegarde** : les séances créées par un programme sont des séances types normales, exportées et importées comme les autres.

---

## 7. Première fois sur un exercice (séance en cours)

*Révisé le 29/10 après revue : le texte explique « 20 kg » là où on s'en sert, et ne s'affiche plus qu'en série 1.*

Aujourd'hui, sans historique, la série affiche « Objectif : 20 kg × 8 ». Pour la **série 1 en cours** (la grande carte, tant qu'aucune série de l'exercice n'est validée) d'un exercice **sans dernière performance**, dans une séance démarrée **depuis une séance type**, cette ligne devient :

- exercice à la barre, à 20 kg : « Première fois : la barre seule (20 kg) × 8. Ajuste si besoin. » ;
- au poids du corps (charge 0) : « Première fois : 8 reps. Ajuste si besoin. » ;
- autre charge (séance type perso) : « Première fois : vise 60 kg × 8. Ajuste si besoin. ».

- Construction : `firstTimeText(exerciseId, targetWeight ?? 0, targetReps)` dans `src/lib/programs.ts`. « À la barre » = exercice de la liste `BARBELL_EXERCISE_IDS` (squat, développés couché / incliné / militaire, soulevés de terre, rowing barre, hip thrust, curl barre, barre au front).
- Dès qu'une série de l'exercice est validée, la série en cours revient à « Objectif : 20 kg × 8 » (comme la note du lot 1, masquée après la série 1). Les autres séries gardent « Objectif : … ».
- La règle s'applique à **toute** séance type, pas seulement aux programmes : elle est vraie partout.
- En séance libre, rien ne change : il n'y a pas d'objectif, donc pas de ligne.
- Dès qu'un historique existe, on revient à « Dernière fois : … », comme aujourd'hui.
- Même style que la ligne « Objectif » (texte secondaire), sans accent ni « ! ».

Je remplace le texte de la roadmap (« prends une charge que tu soulèves 10 fois sans forcer »), qui contredisait la valeur pré-remplie.

---

## 8. Parcours chronométré : première série validée en 5 taps

Contexte : stockage vide, viewport 390 × 844, mode clair. Aucun tap ne demande de défiler.

| Tap | Écran avant | Élément tapé | Résultat attendu |
|---|---|---|---|
| 0 | Lancement | (aucun) | Séances : « Aucune séance pour l'instant. », « Commence avec un programme ou crée la tienne. », un seul bouton accent |
| 1 | Séances (vide) | « Choisir un programme » | `/seances/programmes`, 3 cartes, aucune choisie, « Ajouter ce programme » désactivé |
| 2 | Programmes | carte « Full body » | Carte en `aria-checked="true"` avec « Choisi », bouton actif |
| 3 | Programmes | « Ajouter ce programme » | `/seances`, toast « Programme ajouté : Full body (2 séances). », carte « Full body A » en tête avec « Suggérée » |
| 4 | Séances | « Démarrer la séance » (Full body A) | `/seance`, « Exercice 1 sur 4 », Squat, série 1 pré-remplie 20 kg × 8, ligne « Première fois : la barre seule (20 kg) × 8. Ajuste si besoin. » ; le toast d'ajout est fermé |
| 5 | Séance | « Valider la série » | Série 1 de Squat validée à 20 kg × 8, toast « Série 1 validée. Repos : 120 s. », minuteur de repos lancé |

Aucune saisie au clavier. Le test Playwright vérifie les 5 taps et l'état final dans `localStorage` (session active, Squat série 1 `done: true`, `weight: 20`, `reps: 8`).

---

## 9. Critères d'acceptation

**Données**
1. `STARTER_PROGRAMS` contient exactement 3 programmes, dans l'ordre Full body, Haut / Bas, Poids du corps, avec 5 séances types au total. Le test unitaire compare les objets aux tableaux du §3 : noms, ordre, `exerciseId`, `targetSets`, `targetReps`, `targetWeight` et `restSeconds`.
2. Tous les `exerciseId` utilisés existent dans `DEFAULT_EXERCISES` (test).
3. Chaque `targetWeight` vaut 20 ou 0. Un test échoue si une autre valeur apparaît.

**Écran Séances**

4. Stockage vide : le texte du §5.1 s'affiche et il n'y a qu'une seule action accent, « Choisir un programme ». « Créer une séance » et « Séance libre » sont secondaires, et « Ajouter un programme de départ » est absent.
5. Au moins une séance type : « Ajouter un programme de départ » est présent, secondaire, et ouvre `/seances/programmes`.

**Écran Programmes de départ**

6. `/seances/programmes` affiche le titre, l'intro (avec la règle des charges, visible sans défiler à 390 × 844), les 3 cartes avec les textes exacts du §3 et du §4, et plus de note sous les cartes. L'URL ne s'ouvre pas comme une séance type d'id « programmes ». *(Révisé le 29/10.)*
7. Sans choix, le bouton dit « Choisis un programme ci-dessus », sans accent, avec `aria-disabled="true"` ; un tap met le focus sur la première carte sans rien créer. Après un tap sur une carte, seule cette carte a `aria-checked="true"` et affiche « Choisi », et le bouton devient « Ajouter ce programme » en accent. Début / Fin vont à la première / dernière carte. *(Révisé le 29/10.)*
8. Aucune carte n'utilise la couleur d'accent, choisie ou non. Sans choix, l'écran n'a aucun aplat accent ; après un choix, le seul est « Ajouter ce programme ». *(Révisé le 29/10.)*
9. « Retour aux séances » ramène à `/seances` sans rien créer.

**Ajout et annulation**

10. « Ajouter ce programme » sur Full body ajoute « Full body A » puis « Full body B » à la fin de la liste existante, sans toucher aux séances types déjà là. Le toast affiche « Programme ajouté : Full body (2 séances). ». Sur Poids du corps : « Programme ajouté : Poids du corps (1 séance). ».
11. « Annuler » dans les 5 s retire exactement les séances créées. `state.templates` redevient égal à l'état d'avant (test sur le réducteur). Un second appel ne fait rien.
12. Démarrer une séance pendant que ce toast est affiché le ferme, et l'ajout reste, quel que soit le point d'entrée (carte, séance libre, reprise) et même après un passage par un autre onglet. Ajout à une liste non vide : la première séance créée est visible à l'écran. En bas de page, le toast ne recouvre pas le dernier bouton. *(Révisé le 29/10.)*
13. Après l'ajout depuis un stockage vide, « Full body A » est en tête avec « Suggérée » et « Démarrer la séance » en accent.
14. Ajouter Full body deux fois crée « Full body A (2) » et « Full body B (2) ». Une troisième fois crée « (3) ». La carte affiche « Déjà dans tes séances. » dès le premier ajout.
15. Une séance type créée par un programme se modifie, se duplique et se supprime comme les autres, avec le toast « Séance supprimée : Full body A. ».

**Séance**

16. Exercice sans historique dans une séance démarrée depuis une séance type : la série 1 en cours affiche « Première fois : la barre seule (20 kg) × 8. Ajuste si besoin. » (au poids du corps : « Première fois : 10 reps. Ajuste si besoin. » ; autre charge : « Première fois : vise 60 kg × 8. Ajuste si besoin. »), et dès la série 2, comme les autres séries, « Objectif : … ». *(Révisé le 29/10.)* Avec un historique, on voit « Dernière fois : … ». En séance libre, aucune ligne.
17. Le parcours du §8 passe en 5 taps exactement, sans clavier, à 390 × 844 (Playwright). *(Révisé le 29/10 : test versionné `e2e/premiere-seance.spec.ts`, lancé par `npm run e2e`, en clair et en sombre ; aucun défilement, cibles ≥ 48 px, état final dans `localStorage`.)*

**Design**

18. Mêmes contrôles de revue design que le lot 1, en clair et en sombre : cibles d'au moins 48 px, bouton principal de 56 px, une seule action accent par écran, apostrophes typographiques (’) dans les textes affichés, espaces insécables avant les unités.

---

## 10. Non-objectifs du lot 2

- **Pas de questionnaire** (niveau, objectif, matériel) avant de choisir. Trois cartes lisibles suffisent.
- **Pas d'objet « programme » suivi dans le temps** : pas de semaine 1/8, pas d'enchaînement imposé A puis B, pas de progression propre au programme. La suggestion de séance (`suggestedTemplateId`) et la charge proposée (lot 1) font déjà ce travail.
- **Pas de machines ni d'haltères** dans les programmes, pour la raison donnée au §2.
- **Pas de rythme hebdo** créé automatiquement à partir du texte « Pour qui ». Le rythme reste un choix de l'utilisateur (lot 3, identity §9.1.3).

## 11. Évolutions de l'identité (à intégrer par le chef de projet)

- **§5 Créer**, première puce : « Bouton principal : « Créer une séance » » devient « Liste vide : bouton principal « Choisir un programme » (programmes de départ), puis « Créer une séance » en secondaire. Liste non vide : « Créer une séance », « Séance libre » et « Ajouter un programme de départ », tous en secondaire. »
- Aucun autre changement : §3 et §9.2 décrivent déjà l'état vide et les programmes de départ.
