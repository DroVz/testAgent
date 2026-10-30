# Revue de vérification : 2026-10-30, Lot 3 « Ton rythme » (corrections du §12, non commitées)

## Méthode

J'ai vérifié les 6 améliorations de `docs/review-2026-10-29-lot3.md`, telles qu'arbitrées par le PO dans `docs/product/lot3-rythme.md` §12. Je l'ai fait avec Playwright, sur un serveur de dev lancé au port 5263 (je n'ai pas touché au 5199) puis arrêté à la fin. L'horloge est figée au jeudi 29 octobre 2026, 20 h (Europe/Paris), sauf pour c2.

**Tailles d'écran** : 390 × 844 en clair puis en sombre, puis 375 × 667 en clair. Les variantes c2, c3 et a2 n'ont été vues qu'en 390 clair.

**Profils injectés dans le localStorage :**
- **(a) Nouvel utilisateur.** Je pars d'un stockage vide et je fais tout par l'interface : programme Full body, 1ʳᵉ séance, Progrès, 2ᵉ séance, carte de proposition, « Non merci », puis rechargement.
- **(a2)** Deux séances, dont une seule avec « Soulevé de terre roumain ». C'est le cas de l'amélioration n° 6.
- **(b) Régulier, objectif 3.** Séances le lundi, le mercredi et le vendredi depuis le 3 août, dont 2 cette semaine. J'ajoute ensuite la 3ᵉ puis la 4ᵉ séance, avec le récap après chacune.
- **(c) Retour après 3 semaines, objectif 3.** Dernière séance le 7 octobre. Je regarde Séances, Progrès et Historique, puis le récap de la séance de retour, puis Progrès.
  - **c3** : dernière séance le 23 septembre, on est le 29 octobre.
  - **c2** : on est le lundi 2 novembre, la dernière séance date du 9 octobre.
- **(d) Sans objectif.** 17 séances le mardi et le jeudi, `weeklyGoalAsked: true`.

**Mesures sur chaque écran** :
- aplats en couleur d'accent (fond calculé égal à `--accent`) ;
- cibles de moins de 48 px ;
- textes visibles de moins de 13 px ;
- débordement horizontal ;
- nombre de lignes de « Objectif atteint. » et de la ligne du mois ;
- console.

En tout, 77 captures.

## Verdict

**Le lot est prêt.** Les 6 points sont résolus à l'écran, avec les modifications voulues par le PO, et je ne vois aucune régression. Le Progrès de celui qui revient ne montre plus ce qui manque.

## Bloquants

Aucun.
- **Console** : aucune erreur ni aucun avertissement applicatif. Il reste seulement les 2 « Future Flag » connus de React Router.
- **Accent** : exactement 1 aplat sur Séances, le récap et Réglages, et 0 sur Progrès et Historique, en clair comme en sombre.
- **Cibles** : aucune de moins de 48 px. Les seuls éléments relevés sont des libellés de champ (« Exercice », « Ou colle le contenu exporté »), qui ne sont pas des cibles.
- **Textes** : aucun de moins de 13 px.
- **Débordement** : aucun débordement horizontal, à 390 comme à 375 px.

## Vérification des 6 points

| N° | Attendu (§12) | Constaté | Captures |
|---|---|---|---|
| 1 | Tuile à 0 : « 0 », aucune `.rhythm-dots`, légende « Objectif : 3 » | **OK**. « 0 » et « Objectif : 3 », avec 0 `.rhythm-dots` dans le DOM (c, c2, c3). Nom accessible : « 0 séance, objectif 3 séances ». Après la séance de retour, on voit « 1 sur 3 » et ●○○ (1 pastille pleine sur 3), et la légende disparaît. | `c-*-02-progres-retour`, `c3-light-390-02-progres`, `c-*-05-progres-apres-retour` |
| 2 | « Non merci », bouton à contour, ≥ 48 px, texte « … à tout moment dans Réglages. » | **OK**. La classe est `btn goal-prompt__later` (sans `btn--ghost`), avec une bordure de 1 px (`rgb(221,221,230)` en clair, `rgb(49,49,63)` en sombre), `margin-left` à 0 et une taille de 113 × 48 px. « Plus tard » n'apparaît nulle part. Le tap ne déclenche pas de toast, la carte reste absente après rechargement et `settings` vaut `{weeklyGoalAsked: true}`. | `a-*-05-progres-proposition`, `a-*-06-progres-apres-non-merci` |
| 3 | Mois en cours sans le compte | **OK**. On lit « Octobre : 480 kg. » (a, après la 1ʳᵉ séance) et « Octobre : 27 450 kg, 12 records. » (b). La ligne tient sur 1 ligne à 375 px. | `a-*-03`, `b-light-375-02` |
| 4 | Repli sur le mois précédent du 1er au 7 seulement | **OK**. Pour c3 (29 octobre), aucune ligne de bilan et pas de `.progress-review` vide. Pour c2 (2 novembre), on lit « Octobre : 4 séances, 14 750 kg, 4 records. », avec le compte puisque c'est un repli. | `c3-light-390-02`, `c2-light-390-02` |
| 5 | « Objectif atteint. » / « Objectif de 3 atteint. » insécables | **OK**. Sur 1 ligne sur Séances et sur le récap, dans les 3 configurations. À 375 px, le récap passe à la ligne **avant** « Objectif atteint. », ce qui est la coupure voulue. | `b-*-03-recap-3-sur-3`, `b-*-04`, `b-*-06`, `b-*-07` |
| 6 | Titre à un point : « Première séance sur cet exercice » | **OK**, avec 1 séance (a) et avec 2 séances dont une seule sur l'exercice (a2). Le titre ne dit plus « séance enregistrée ». Le jalon du récap, lui, est inchangé (« Première séance enregistrée. Bienvenue. »). | `a-*-03-progres-apres-1`, `a2-light-390-01` |

Le reste ne bouge pas :
- Les pastilles restent à l'encre et centrées. On a bien ●●○ à 2 sur 3, ●●● avec « Objectif atteint » à 3 et à 4.
- Sans objectif, la tuile affiche le nombre seul.
- La ligne de semaine sur Séances est inchangée.
- Le récap garde l'ordre fait → semaine → jalon → records.

## Remarques mineures (non bloquantes)

1. **« Semaine dernière : 3 séances, 7 050 kg, 3 records. » passe sur 2 lignes**, déjà à 390 px. Ça laisse « 3 records. » seul sur sa ligne (`b-light-390-02`). C'est antérieur au lot de corrections, pas une régression. Une piste possible : une espace insécable entre le volume et les records, ou accepter tel quel.
2. **Le récap de c reste sans jalon**, comme prévu (« Cette semaine : 1 séance sur 3. »). Rien à corriger, je le note seulement parce que c'est le cas sensible du lot.

*Hors lot* : un profil qui a de l'historique mais aucun modèle de séance voit « Aucune séance pour l'instant. » sur Séances (`b-dark-390-07`). C'est un état atteignable en supprimant ses modèles, et le libellé peut se lire comme « tu n'as rien fait ». À garder pour un prochain lot, sans priorité.

## Ce qui marche bien (à ne pas casser)

- La tuile à 0 se lit comme un repère (« Objectif : 3 »), pas comme des cases en retard. Elle est cohérente avec la ligne de Séances (« Objectif de la semaine : 3 séances. »).
- « Non merci » se lit enfin comme un bouton, au même niveau visuel que les pastilles 2, 3, 4, et dit ce qui se passe.
- Le bilan n'a plus de doublon. Le 29 octobre, celui qui revient après 5 semaines ne voit plus septembre affiché face à « Ce mois 0 ».

## Captures

Dossier `docs/screenshots/review-lot3-verif/` (77 fichiers). Préfixe : profil, puis `light-390`, `dark-390` ou `light-375`.
- **(a)** `01-seances-vide`, `02-recap-1re`, `03-progres-apres-1`, `04-recap-2e`, `05-progres-proposition` (+ `05b-…-pleine-page`), `06-progres-apres-non-merci`, `07-progres-courbe-un-point`.
- **(a2)** `a2-light-390-01-progres-courbe-un-point`.
- **(b)** `01-seances-2-sur-3`, `02-progres-2-sur-3`, `03-recap-3-sur-3`, `04-seances-atteint`, `05-progres-atteint`, `06-recap-4`, `07-seances-4`, `08-progres-4`.
- **(c)** `01-seances-retour`, `02-progres-retour`, `03-historique-retour`, `04-recap-retour`, `05-progres-apres-retour`. Variantes : `c2-light-390-01/02`, `c3-light-390-01/02`.
- **(d)** `01-seances-sans-objectif`, `02-progres-sans-objectif`, `03-reglages-objectif`.
