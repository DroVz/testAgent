# Lot 6 : en salle, ne rien oublier

*Product owner, 30 octobre 2026. Ce lot suit le lot 5 (revue `review-2026-10-30-lot5.md` : prêt, et ses 4 améliorations ont été reprises dans le commit 2b2e5ea). L'app est une PWA, utilisée chaque semaine par son seul propriétaire. Effort total : **M** (S + S). Ce document fait foi pour le lot 6.*

Lu avant d'écrire : `docs/identity.md` (§3, §4.1, §4.6, §4.8, §5 Réaliser, §8), `docs/SPEC.md`, `vision-et-roadmap.md`, `lot5-sauvegarde-et-records.md` (format, §4.3), toutes les revues `docs/review-*.md` (« Améliorations priorisées »), `src/pages/ActiveSessionPage.tsx` (`primary`, menu ⋯, `session-nav`, `askFinish`, dialogues), `src/lib/session.ts` (`nextExerciseIndex`, `validateSet`, `currentSetIndex`, `pendingSetCount`, `finishSession`), `src/lib/types.ts`, `src/lib/storage.ts` (`parseExercise`, `saveState`), `src/state/appReducer.ts`, `src/state/AppStore.tsx` (`saveFailed`), `src/components/ConfirmDialog.tsx`.

---

## 1. Pourquoi ce lot, et pourquoi seulement celui-là

J'ai passé en revue les frictions d'une séance réelle, pour un pratiquant seul en salle. Deux manques se voient dans le code, et ils touchent chaque semaine quelqu'un qui s'entraîne dans une salle partagée :

1. **L'exercice sauté s'oublie.** La machine est prise, tu passes au suivant avec « Suivant ». Ensuite, l'app ne revient jamais en arrière : `nextExerciseIndex` ne cherche que vers l'avant. Sur le dernier exercice, le bouton principal devient « Terminer la séance », alors que l'exercice 2 attend encore. La seule trace est la confirmation « Il reste 3 séries non validées », qui ne dit pas lesquelles.
2. **On ne peut rien noter.** `WorkoutSession.notes` existe et s'affiche dans le détail d'une séance, mais aucun écran ne permet de l'écrire. Or le besoin réel, en salle, n'est pas un journal de séance. C'est un **pense-bête par exercice** qu'on relit la fois suivante : « Siège au cran 4 », « Prise serrée, coudes rentrés », « Poulie : trou 3 ».

Le reste a été écarté. Le détail est au §7 : échauffement, superset, calcul des disques, pas de charge par exercice, plan de séance avec saut direct, note de séance.

Rien de ce lot ne prend l'accent. Chaque écran garde la même action principale.

### User stories
- **US6.1** En tant que pratiquant dont la machine est occupée, je veux sauter un exercice et que l'app me le rende à la fin, pour ne pas l'oublier.
- **US6.2** En tant que pratiquant qui termine sa séance avec des séries en attente, je veux savoir sur quels exercices elles sont, pour décider en connaissance de cause.
- **US6.3** En tant que pratiquant, je veux écrire une courte note sur un exercice (réglage de machine, prise, consigne) et la retrouver à chaque séance, pour ne plus chercher mes réglages.
- **US6.4** En tant que pratiquant, je veux pouvoir effacer cette note et revenir en arrière si je me trompe.

---

## 2. Revenir aux exercices sautés

### 2.1 Définitions
- Un exercice est **en attente** s'il a au moins une série non validée (`currentSetIndex(e) !== -1`). Un exercice sans série n'est pas en attente.
- `nextPendingIndex(session, fromIndex)` est une nouvelle fonction pure dans `session.ts`. Elle renvoie le premier exercice en attente **après** `fromIndex`. S'il n'y en a pas, elle renvoie le premier en attente **depuis le début** (de 0 à `fromIndex − 1`), sinon `-1`. L'exercice `fromIndex` lui-même n'est jamais renvoyé.

### 2.2 Passage automatique (validation de la dernière série en attente de l'exercice affiché)
- S'il existe un exercice en attente **après** l'exercice affiché, l'écran passe au premier d'entre eux. C'est le comportement actuel.
- **Sinon, l'écran reste sur l'exercice affiché.** Aujourd'hui, il passe à `fromIndex + 1`, même si cet exercice est déjà fait. Ce changement est voulu : l'app ne recule jamais toute seule, et elle n'avance pas non plus vers un exercice fini. C'est le bouton principal (§2.3) qui dit quoi faire.
- Le retour du dock ne change pas : « Exercice terminé : squat. Repos : 90 s. »

### 2.3 Bouton principal quand l'exercice affiché n'a plus de série en attente
Ce cas couvre `setIdx === -1`, hors correction et hors séance vide. On calcule `t = nextPendingIndex(session, exIdx)`.

| Situation | Libellé (exact) | Action |
|---|---|---|
| `t > exIdx` | « Exercice suivant » | aller à `t` (inchangé) |
| `t < exIdx` et `t ≠ -1` | « Reprendre l’exercice 2 » (numéro affiché = `t + 1`) | aller à `t`, transition « précédent » |
| `t === -1` (plus aucune série en attente) | « Terminer la séance » | `askFinish` (inchangé) |

- **Changement** : « Terminer la séance » devient le bouton principal dès que toutes les séries sont validées, **quelle que soit la position** de l'exercice affiché. Aujourd'hui, il ne l'est que sur le dernier exercice.
- Le numéro reprend le vocabulaire de l'en-tête (« Exercice 2 sur 5 »). Un nom d'exercice ne figure pas dans le libellé : un nom long ne tiendrait pas sur un bouton de 56 px à 375 px. Le nom est donné au lecteur d'écran : `aria-label="Reprendre l’exercice 2 : développé incliné"`.
- Le bouton secondaire « Terminer la séance » de l'en-tête reste affiché tant que ce n'est pas l'action principale (inchangé).
- `session-nav` : « Précédent » et « Suivant » ne changent pas. « Suivant » reste masqué quand le principal est « Exercice suivant » (inchangé). Il reste visible quand le principal est « Reprendre l’exercice N ».

### 2.4 Confirmation de fin avec des séries en attente
On garde le dialogue « Terminer la séance ? » et ses boutons (« Terminer la séance », « Continuer »). Seul le message change. Il est produit par `formatRemainingSets(count, names)` dans `format.ts`, où `names` contient les noms des exercices en attente dans l'ordre de la séance, passés par `inSentence` et sans doublon.

| Exercices en attente | Message (exact) |
|---|---|
| 1 | « Il reste 3 séries non validées, en développé incliné. Terminer quand même ? » |
| 2 | « Il reste 5 séries non validées, en développé incliné et curl haltères. Terminer quand même ? » |
| 3 ou plus | « Il reste 7 séries non validées, sur 3 exercices. Terminer quand même ? » |

- Au singulier : « Il reste 1 série non validée, en squat. Terminer quand même ? »
- Le nombre et le nom passent par `formatCount`. L'espace avant le nombre de séries est insécable, comme aujourd'hui.

---

## 3. Note par exercice

### 3.1 Décisions de fond
- **La note appartient à l'exercice, pas à la séance.** Elle décrit ta salle et ton geste, pas ta journée. Elle est la même dans toutes les séances types et dans la séance libre, et elle survit d'une séance à l'autre. Si un exercice figure deux fois dans une séance, les deux occurrences montrent la même note.
- **Elle est courte : 80 caractères au plus**, soit 2 lignes à 16 px sur 375 px. Une note plus longue chargerait l'écran de séance, qui est déjà serré sur iPhone SE (revue lot 5, n° 1).
- **Elle s'écrit au clavier.** C'est la seule exception à identity §4.6 dans ce lot. Elle est justifiée parce que la note est facultative, qu'on l'écrit une fois et qu'on la relit des dizaines de fois.
- **Elle se lit sur l'écran de séance seulement.** Elle n'apparaît ni dans le constructeur, ni dans l'Historique, ni dans Progrès.

### 3.2 Données
- `Exercise.note?: string`, un champ optionnel et rétrocompatible. Il vaut pour les exercices de la bibliothèque comme pour les exercices personnalisés : `state.exercises` contient déjà une copie de chaque exercice par défaut.
- Il est toujours stocké après `trim()`. Une note vide n'est jamais stockée : le champ est retiré.
- Action suggérée : `exercise/setNote { id, note }`. Elle s'applique à tout exercice, même s'il n'est pas personnalisé : on n'utilise **pas** `updateCustomExercise`, qui filtre sur `isCustom`.
- **Export** : la note est dans `exercises`, exportée avec le reste. `version` reste `1`.
- **Import** (`parseExercise`) :
  - champ absent → accepté ;
  - champ présent et pas une chaîne → l'import échoue avec un message qui cite `exercises[i].note` ;
  - chaîne → elle est nettoyée par `trim()`, retirée si elle est vide, et coupée à 80 caractères si elle est plus longue (sans échec, pour un fichier retouché à la main).
- Les notes sont effacées par « Tout effacer », avec le reste des données.
- Un exercice personnalisé supprimé emporte sa note.

### 3.3 Affichage en séance
- La note se place sous le nom de l'exercice (`session-exercise__head`) et au-dessus de la note « Charge proposée » et de la liste des séries.
- Rendu : `<p class="exercise-note">`, texte secondaire `--text-muted`, 16 px / 400, 2 lignes au plus. Il est précédé de l'icône Lucide `StickyNote` (20 px, encre secondaire, `aria-hidden`) et d'un préfixe masqué visuellement « Note : ». Sans accent, sans fond ni bordure colorée.
- La note reste affichée pendant tout l'exercice. Une consigne (« coudes rentrés ») sert à chaque série, contrairement à la charge proposée, qui disparaît après la série 1.
- Sans note : rien, et pas d'emplacement vide.

### 3.4 Écrire, modifier, effacer
- **Menu ⋯** (`Options de …`) : une nouvelle entrée, placée après « Ajouter un exercice » et avant « Retirer cet exercice ». Libellé : « Ajouter une note », ou « Modifier la note » si une note existe. Style `btn btn--block`, comme les autres entrées.
- **Dialogue** : nouveau composant `NoteDialog`, avec le même habillage que `ConfirmDialog` (`role="dialog"`, `aria-modal`, Échap ou clic hors de la boîte = annuler, focus rendu à l'ouverture).
  - Titre : « Note sur développé couché » (nom passé par `inSentence`).
  - Champ : un `<input type="text">` d'une ligne, `maxLength={80}`, `enterKeyHint="done"`. Il est pré-rempli avec la note existante et reçoit le focus à l'ouverture. Libellé visible : « Note ».
  - Aide sous le champ, en texte secondaire, reliée par `aria-describedby` : « Réglage, prise ou consigne. Elle s’affichera à chaque séance. »
  - Exemple dans le champ vide (`placeholder`) : « Ex. : siège au cran 4 »
  - Compteur à droite sous le champ, en texte secondaire 13 px, visible à partir de 60 caractères : « 72 / 80 ».
  - Boutons :
    - « Enregistrer la note » : principal, seul aplat accent du dialogue. Entrée valide aussi.
    - « Annuler » : à contour.
    - Si une note existe déjà, un troisième bouton « Effacer la note » (`btn--danger-ghost`) sous les deux autres.
- **Enregistrer** avec un texte non vide : la note s'affiche tout de suite sur l'écran. Il n'y a ni toast ni retour dans le dock : le changement est visible à l'endroit même (identity §8, q. 5).
- **Enregistrer avec un champ vide, ou « Effacer la note »** : la note est retirée. Le toast « Note effacée. » s'affiche avec « Annuler » pendant 5 s, et « Annuler » remet la note (identity §4.8). Si le champ était déjà vide et qu'il n'y avait pas de note, rien ne se passe.
- Ouvrir le dialogue ferme le menu et abandonne une correction en cours, comme les autres entrées du menu (`menuAction`).
- Le dialogue ne touche ni au minuteur de repos ni au retour du dock.

---

## 4. Cas limites

| Cas | Comportement |
|---|---|
| **5 exercices, l'exercice 2 sauté avec « Suivant », 3 à 5 faits** | Après la dernière série du 5, l'écran reste sur le 5 et affiche « Reprendre l’exercice 2 ». Au tap, l'écran passe à l'exercice 2. Après sa dernière série, « Terminer la séance » devient le principal. |
| **Les exercices 2 et 4 sautés, on est sur le 3** | Après la dernière série du 3, passage automatique au 4 (vers l'avant). Après le 4, le bouton affiche « Reprendre l’exercice 2 ». |
| **Toutes les séries faites, on revient avec « Précédent » sur l'exercice 1** | Principal : « Terminer la séance » (et non plus « Exercice suivant »). |
| **Exercice affiché encore en attente** | Principal : « Valider la série ». Le §2.3 ne s'applique pas. |
| **Exercice sans série (toutes supprimées)** | Pas en attente. Il n'est jamais proposé par « Reprendre ». |
| **Séance avec un seul exercice** | Comportement inchangé. |
| **Rechargement sur « Reprendre l’exercice 2 »** | Même écran et même libellé : tout se recalcule depuis la séance enregistrée. |
| **Exercice en attente retiré (menu ⋯)** | Il disparaît de `nextPendingIndex` et du message de fin. « Annuler » le remet. |
| **Note de 80 caractères à 375 × 667** | 2 lignes au plus, sans débordement horizontal. « Valider la série » reste entièrement visible avant la série 1. |
| **Même exercice deux fois dans la séance** | La même note aux deux endroits. La modifier à l'un la modifie à l'autre. |
| **Note sur un exercice de la bibliothèque, puis export et import** | La note revient. |
| **Fichier importé avec une note de 120 caractères** | Import réussi, note coupée à 80 caractères. |
| **`note: 12` dans le fichier importé** | L'import échoue avec un message qui cite `exercises[3].note` (par exemple). |
| **Stockage plein à l'enregistrement d'une note** | Même traitement que toute autre modification : l'alerte existante `saveFailed`. Rien de spécifique. |

---

## 5. Critères d'acceptation

**Calcul (`session.test.ts`, `format.test.ts`)**

1. `nextPendingIndex` : avec 5 exercices dont seul le 2 (index 1) est en attente, depuis l'index 4 → `1` ; depuis l'index 1 → `-1`. Avec les index 1 et 3 en attente, depuis l'index 2 → `3`. Aucun en attente → `-1`. Un exercice sans série n'est jamais renvoyé.
2. `validateSet` sur la dernière série en attente de l'exercice affiché : un exercice en attente plus loin → `currentExerciseIndex` = cet exercice. Aucun plus loin → `currentExerciseIndex` inchangé, même si un exercice plus haut est en attente.
3. `formatRemainingSets` produit exactement les 4 messages du §2.4 (1, 2 et 3 exercices, et le singulier), avec `NBSP` entre le nombre et « séries ».

**Séance (`sessionFlow.test.tsx`)**

4. Séance type de 3 exercices. Taper « Suivant » sur l'exercice 1, valider toutes les séries des exercices 2 et 3 : le principal est « Reprendre l’exercice 1 », avec `aria-label` « Reprendre l’exercice 1 : <nom> ». Au tap : « Exercice 1 sur 3 » et « Valider la série ».
5. Toutes les séries validées, puis « Précédent » jusqu'à l'exercice 1 : le principal est « Terminer la séance ».
6. « Terminer la séance » (en-tête) avec 3 séries en attente sur le développé incliné : message « Il reste 3 séries non validées, en développé incliné. Terminer quand même ? »
7. Après un rechargement, le principal et l'exercice affiché sont identiques.
8. Le passage automatique vers l'avant reste celui d'aujourd'hui (les tests existants du parcours en 5 taps et de « Exercice suivant » passent sans modification, sauf ceux qui attendaient un passage vers un exercice déjà fait).

**Note**

9. Menu ⋯ → « Ajouter une note » → saisir « Siège au cran 4 » → « Enregistrer la note » : le texte s'affiche sous le nom de l'exercice, sans toast. Le lecteur d'écran lit « Note : Siège au cran 4 ». Le menu affiche ensuite « Modifier la note ».
10. Nouvelle séance (autre séance type, ou séance libre) avec le même exercice : la note est affichée. Elle survit à un rechargement et à un export suivi d'un import.
11. Le champ refuse le 81ᵉ caractère. Le compteur « 60 / 80 » apparaît à 60 caractères, et pas à 59. Les espaces en tête et en fin sont retirées à l'enregistrement.
12. « Effacer la note » (ou enregistrer un champ vide) : la note disparaît, le toast « Note effacée. » propose « Annuler » pendant 5 s, et « Annuler » rétablit le texte exact. Le champ `note` est absent de l'état après l'effacement (et non `""`).
13. Import : `note` absent → accepté ; `note: 12` → échec avec un message qui cite `exercises[i].note` ; 120 caractères → accepté et coupé à 80. Un export fait avant ce lot s'importe sans erreur.
14. La note fonctionne sur un exercice de la bibliothèque (`isCustom: false`) comme sur un exercice personnalisé.
15. La note reste affichée après la validation de la série 1, contrairement à « Charge proposée ».

**Design**

16. À 390 × 844 en clair et en sombre, puis à 375 × 667 : au plus un aplat accent à l'écran de séance (« Valider la série », « Reprendre l’exercice N » ou « Terminer la séance »), et un seul dans le dialogue (« Enregistrer la note »). Aucune cible < 48 px, aucun texte < 13 px, aucun débordement horizontal.
17. À 375 × 667, avec une note de 80 caractères, la charge proposée et 4 séries : « Valider la série » est entièrement visible sans défiler avant la série 1. Pendant le repos, la carte en cours reste au-dessus du dock (correctif du lot 5 conservé).
18. La note n'utilise ni l'accent ni le vert. L'icône `StickyNote` est `aria-hidden`.
19. `npm test`, `npm run typecheck`, `npm run build` et les e2e Playwright passent. La console est propre.

---

## 6. Évolutions de l'identité (à appliquer à `docs/identity.md` avec l'implémentation)

Elles précisent des règles existantes et n'en assouplissent aucune, sauf le point 3, qui est une exception bornée.
1. **§5 Réaliser** : ajouter « Un exercice sauté n'est pas perdu : quand l'exercice affiché est fini et qu'un exercice plus haut attend encore, le bouton principal devient « Reprendre l'exercice 2 ». « Terminer la séance » devient le bouton principal dès que toutes les séries sont validées. »
2. **§5 Réaliser** : ajouter « Une note courte par exercice (80 caractères au plus), en texte secondaire sous le nom, la même à chaque séance. »
3. **§4.6** : ajouter « Exception : la note d'exercice, facultative, se tape au clavier. »

---

## 7. Idées examinées et écartées

| Idée | Pourquoi pas maintenant |
|---|---|
| **Séries d'échauffement** | Elles ajoutent un nouveau concept (une série qui ne compte ni pour le volume, ni pour les records, ni pour la charge proposée) et touchent `detectNewRecords`, la progression, le bilan et le récap. Pour un pratiquant seul, la note d'exercice suffit pour noter « 2 séries de chauffe à 40 kg ». |
| **Superset et circuit** | Ils cassent « un exercice à la fois » (identity §5) et la logique du minuteur de repos. C'est un gros risque pour la clarté, pour un gain de quelques taps. |
| **Calcul des disques** (« par côté : 20 + 10 + 2,5 ») | Il faut régler la barre et l'inventaire des disques, et il ajoute une ligne à un écran déjà serré à 375 × 667. Le calcul de tête est trivial pour un habitué, avec des pas de 2,5 kg. À reprendre si le propriétaire le demande. |
| **Pas de charge par exercice** (1 ou 2 kg pour les haltères) | Question n° 2 de `vision-et-roadmap.md`, toujours sans réponse, donc on garde le défaut de 2,5 kg partout. Le clavier reste disponible en repli dans `NumberField`. C'est le premier candidat d'un lot suivant si le propriétaire bute dessus. |
| **Plan de séance avec saut direct** (taper « Exercice 2 sur 5 » pour choisir) | Il faudrait une feuille de plus. Avec 4 à 6 exercices, « Précédent » et « Suivant » suffisent, et le §2 règle le vrai risque, l'oubli. |
| **Réordonner les exercices en séance** | Même raison : sauter puis reprendre donne le même résultat sans glisser-déposer pendant l'effort. Le constructeur permet déjà de réordonner avec ↑ ↓. |
| **Note de séance** (journal du jour, champ `notes` existant) | On la relit rarement, et elle ajouterait un champ au récap. La note d'exercice couvre le besoin qu'on relit vraiment. Le champ `notes` reste lu et affiché s'il existe dans un import. |
| **Synchronisation entre onglets** (deux onglets qui s'écrasent) | Ce cas ne se produit pas pour un utilisateur seul avec une PWA installée sur iPhone. |
| **Sauvegarde automatique, cloud, notifications** | Elles demandent un serveur ou des API natives (lot 5, §7). |
| **Le « 1 » de Space Grotesk, « Poids du corps » sous « 0 kg », taille de « 102,5 » dans le constructeur** | Ce sont des remarques ouvertes des revues, que personne n'a constatées en salle (lot 5, §4.3). Elles restent en attente d'un retour du propriétaire. |

---

## 8. Questions pour le propriétaire

1. **80 caractères pour la note, c'est assez ?** Par défaut : oui. C'est la place d'un réglage et d'une consigne, sur 2 lignes.
2. **Après ce lot, qu'est-ce qui te freine encore en salle ?** Par défaut : on s'arrête là. Les deux candidats suivants sont le pas de 1 ou 2 kg pour les haltères et le calcul des disques, à lancer seulement si tu les demandes.

---

## Révisé le 30/10 après revue (code + design, docs/review-2026-10-30-lot6.md)

Ces points remplacent le texte ci-dessus quand ils le contredisent :
- **Note** : `<textarea rows=2>` (au lieu d'un `<input>` d'une ligne). Entrée et Maj+Entrée enregistrent, sans saut de ligne. La note affichée n'est plus coupée à 2 lignes : elle s'affiche en entier (80 caractères au plus).
- **Dialogue de note** : ancré en haut de l'écran, pour que ses boutons restent visibles au-dessus du clavier.
- **Crans de progression** : chaque cran dit ce qui est fait. Encre = plus aucune série en attente, gris = en attente. L'exercice affiché a un cran plus haut, cerné d'encre (jamais l'accent). `aria-valuenow` = nombre d'exercices terminés.
- **Message de fin** : doublons retirés par exercice (`exerciseId`), plus par nom.
- **Focus** : après un enregistrement, il va sur la note affichée.
