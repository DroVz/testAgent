# Revue design — 2026-10-29 — Intégration de la marque « B · Améthyste » (commit 4b80cb5)

Méthode : script Playwright joué comme un utilisateur (taps), à 390 × 844 en `light` puis en `dark` (`colorScheme`), puis à 1280 × 800 dans les deux modes. Serveur de dev lancé sur le port 5207, car le port 5199 était déjà occupé par un autre processus, que je n'ai pas touché. Le serveur a été arrêté à la fin.

Données de test : 3 séances types, dont « Grosse séance complète du jeudi soir » avec **9 exercices**. Un exercice personnalisé au nom long : « Développé incliné haltères prise neutre unilatéral ». Et 10 séances passées.

Parcours joués :
- **Créer** : états vides ; Réglages et le dialogue « Réinitialiser » ; menu ⋯ ; suppression d'une séance puis toast « Annuler » ; création d'une séance de 8 exercices via le sélecteur ; retrait d'un exercice puis Annuler ; enregistrement.
- **Réaliser** : séance de 9 exercices ; série validée ; minuteur de repos ; passage automatique à l'exercice au nom long ; rechargement de la page (rien n'est perdu : « Exercice 2 sur 9 ») ; menu ⋯ ; confirmation de fin ; récap.
- **Suivre** : Historique, détail d'une séance de 9 exercices, Progrès, y compris sur l'exercice au nom long.

Mesures automatiques sur chaque écran : couleurs calculées (fond, accent, logo), police réelle des titres, noms et chiffres, transformations `skew`, présence d'orange, cibles de moins de 48 px, textes de moins de 13 px, débordement horizontal, console. Ce qui est déjà traité dans les rapports du 28/10 n'est pas répété.

## Verdict

**L'intégration d'Améthyste est propre et fidèle aux maquettes.** Sur les 4 écrans de référence (Séances, Séance, Récap, Progrès), le rendu est identique aux captures `docs/brand/hybride-b/`, en clair comme en sombre. Il reste deux écarts de typographie sur les écrans non couverts par les maquettes. Il y a aussi deux endroits où le rouge « danger » est devenu trop voyant à côté du violet.

## Bloquants

Aucun. Aucune erreur dans la console. Seuls restent les avertissements « Future Flag » de React Router v6, sans effet pour l'utilisateur.

## Conformité au §6, contrôlée

| Point | Résultat |
|---|---|
| Jetons de couleur, clair et sombre | Conformes. Fond `#F5F5FA` / `#0B0B12`, accent `#584CAD` / `#ADAAF8`, texte posé blanc / `#0B0B12`. `theme-color` et manifest à jour. |
| Restes de l'orange `#E8481C` / `#FF6A3D` | **Aucun** dans `src/`, `public/`, `index.html`, `vite.config.ts` ni la doc produit. Aucune couleur calculée orange sur les 50 écrans mesurés. |
| Accent unique | Au plus 1 aplat accent par écran, jamais de texte en accent. Le contour accent n'apparaît que sur la série en cours. Exception logique : le dialogue « Terminer », dont le bouton principal est en accent pendant que la page derrière est voilée. |
| Logo | Présent seulement sur `/seances`, `/historique` et `/progres`. Absent en séance, sur le récap, dans Réglages, le constructeur et le détail. Couleur égale au texte principal (monochrome), dans les deux modes. |
| Pente de 12° | Un seul élément en `skew` dans toute l'app : `.session-progress__track`. Le logo est à part : la pente est dans le tracé SVG. |
| Rayons | 14 px sur les cartes, les tuiles et les dialogues ; 999 px sur les boutons et les pastilles. |
| Space Grotesk | Bien appliquée sur les titres d'écran, les noms de cartes Séances, le nom d'exercice en séance, les chiffres de série (40 px), le minuteur, les tuiles, la phrase de Progrès et les titres de dialogue. **Incomplète ailleurs**, voir les écarts ci-dessous. |
| Crans de progression avec 8 exercices ou plus | Lisibles. 9 crans de 36 px avec 4 px d'écart à 390 px, environ 64 px sur desktop. Le libellé « Exercice 2 sur 9 » est conservé. Par calcul, ils restent au-dessus de 18 px jusqu'à 16 exercices. |
| Noms longs | Ils passent bien partout. Nom de séance en ellipse dans l'en-tête de séance. Nom d'exercice sur 2 lignes en 24 px, sans pousser « Valider la série » hors de l'écran. Retour à la ligne correct dans le sélecteur, le constructeur, l'historique, le détail et Réglages. |

## Écarts avec l'identité

1. **§6 Typographie : « Space Grotesk 700 pour les noms (séances, exercices) »**. Constaté sur l'historique, le détail, le constructeur et l'en-tête de séance. Les noms y restent en Inter, alors que les cartes Séances et l'écran de séance sont en Space Grotesk. Le même nom change donc de police d'un onglet à l'autre. Par exemple, « Grosse séance complète du jeudi soir » est en Space Grotesk sur Séances et en Inter dans Historique.
   - Correction : ajouter `.history-item__name`, `.detail-exercise__name`, `.editor-item__name` et `.session__name` à la règle `font-family: var(--font-display)` de `styles.css` (l. 140).
   - Test : la police calculée de ces 4 sélecteurs commence par « Space Grotesk ».
2. **§6 Typographie : titre d'écran du sélecteur d'exercice**. `.picker__title` (« Ajouter un exercice », 24 px / 700) est en Inter. C'est le seul titre d'écran qui ne soit pas en Space Grotesk.
   - Correction : l'ajouter à la même règle.
   - Les éléments de la liste (`.picker__item`, 16 px / 400) restent en Inter : c'est du corps de texte qu'on parcourt.
3. **§6 « tous les chiffres héros » : constructeur**. Les compteurs Séries, Reps, Poids et Repos (24 px / 700) sont en Inter, alors que les mêmes champs en séance sont en Space Grotesk. Le « 10 » n'a donc pas la même forme selon qu'on prépare ou qu'on réalise la séance.
   - Correction : appliquer `font-family: var(--font-display)` à tous les `.number-field__input`, pas seulement à `--hero`.
4. **§4.1 « Une action principale par écran » : Réglages**. « Réinitialiser toutes les données » est un aplat danger pleine largeur. En sombre, le pavé `#FF6B6B` est aussi lourd que « Exporter mes données » en accent : deux boutons pleins rivalisent sur le même écran (`dark-06-reglages`).
   - Correction : passer ce bouton en contour danger (bordure 1 px `--danger`, texte `--danger`, fond transparent, 48 px). L'aplat danger reste réservé au bouton « Tout effacer » du dialogue de confirmation.
   - Test : sur Réglages, un seul bouton plein, « Exporter mes données ».
5. **§3 (texte mis à jour) et §9.2 « Programmes de départ » : état vide de Séances**. Le texte reste « Aucune séance pour l'instant. Crée la première en 1 minute, ou démarre une séance libre. ». L'identité prévoit désormais « … Commence avec un programme ou crée la tienne. », avec « Choisir un programme » en action principale.
   - Cet écart ne vient pas d'Améthyste : il dépend de la fonction « programmes » de la roadmap. Je le note pour qu'il ne soit pas oublié.

## Améliorations priorisées

1. **Typographie des noms et des titres** (S). Écarts 1 et 2 : une seule règle CSS à compléter.
2. **Chiffres du constructeur en Space Grotesk** (S). Écart 3.
3. **Réglages, bouton Réinitialiser en contour danger** (S). Écart 4.
4. **Constructeur, croix rouges répétées** (S) — `light-11-constructeur-haut`.
   - Problème : sur une séance de 8 exercices, il y a 8 ✕ en rouge `--danger`, alors que le reste de l'écran est en encre et en violet. Ces croix sont les éléments les plus saturés de l'écran, plus visibles que « Enregistrer la séance ». Pourtant le retrait est annulable (toast).
   - Correction : afficher le ✕ en `--text-muted`, 24 px, en gardant l'`aria-label` « Retirer … ». Faire de même pour la corbeille des exercices personnalisés dans Réglages.
   - Test : la mesure ne trouve aucun élément `color: --danger` sur le constructeur au repos.
5. **Glyphe « 1 » de Space Grotesk en chiffres tabulaires** (S, à valider à l'œil sur un vrai téléphone). En `tnum`, le « 1 » a un long empattement. « 11 » (tuile Séances), « 1 980 kg » et « 01:00 » (minuteur) se lisent un peu moins vite que les autres chiffres (`dark-24-progres`, `light-19-recap`).
   - Je ne demande pas de changement tant qu'un test à bout de bras ne montre pas de confusion.
   - Si c'est le cas : désactiver l'alternative `ss01`, si la fonte la propose, sur `.rest-timer__time` et `.stat__value`. Sinon, afficher le minuteur sans zéro de tête (« 1:00 »).

## Ce qui marche bien (à ne pas casser)

- La fidélité aux maquettes est exacte sur les 4 écrans de référence, dans les deux modes.
- **La série faite est remplie en encre**, pas en violet. En sombre, cela donne une pastille claire avec le texte foncé. La lecture « fait = rempli » est immédiate, et l'accent reste réservé à « Valider la série ».
- Les crans à 12° tiennent la charge à 9 exercices, sur mobile comme sur desktop.
- Le logo est monochrome et apparaît exactement là où l'identité le prévoit.
- Plus aucune trace de l'ancien orange : code, manifest, `theme-color` et icônes PWA (fond `#584CAD`) sont propres.
- Le graphique de Progrès est en encre, avec une grille pointillée et la dernière valeur en Space Grotesk : c'est calme et lisible.
- Le toast inversé (surface claire en mode sombre) se détache bien sans utiliser l'accent.

## Évolutions de l'identité

- **§6 Typographie** : préciser la frontière entre les deux familles. Space Grotesk pour les noms affichés comme titre (cartes, en-têtes, détail, constructeur). Inter pour les noms dans une liste qu'on parcourt (sélecteur, lignes du récap, liste des exercices sur une carte). Sans cette règle, chaque nouvel écran tranchera au hasard.
- **§6 Couleurs** : ajouter que `--danger` en aplat est réservé au bouton de confirmation d'une action irréversible, et qu'ailleurs le danger s'exprime en contour ou en texte. Avec un accent violet, un aplat rouge prend le dessus sur l'action principale.

## Captures

Dossier `C:\Users\Alex\Desktop\TesstAgent\docs\screenshots\review-amethyste\` :
- Mobile, préfixe `light-` ou `dark-` :
  - `01-seances-vide`, `02-historique-vide`, `03-progres-vide` ;
  - `04-seances`, `05-seances-pleine` ;
  - `06-reglages`, `07-dialogue-reinitialiser` ;
  - `08-seances-menu`, `09-toast-suppression` ;
  - `10-selecteur-exercice`, `11-constructeur-haut`, `12-constructeur-toast`, `13-constructeur-complet` ;
  - `14-seance-ex1-sur-9`, `15-seance-minuteur-repos`, `16-seance-ex2-nom-long`, `17-seance-menu`, `18-dialogue-terminer` ;
  - `19-recap`, `20-recap-complet` ;
  - `21-historique`, `22-detail-9-exercices`, `23-detail-complet` ;
  - `24-progres`, `25-progres-nom-long`.
- Desktop, préfixe `desktop-light-` ou `desktop-dark-` : `01-seances`, `02-seance-9-exercices`, `03-progres`, `04-detail`.
