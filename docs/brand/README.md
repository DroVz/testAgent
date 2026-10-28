# MuscuTrack — trois directions de marque (2026-10-28)

Demande du propriétaire : « J'aime bien l'ux de l'appli mais pas trop l'ui. Je trouve que la couleur orange est pas folle et même si je veux que l'appli reste claire, ça manque un peu d'identité de "marque". »

**Planche de comparaison** : `docs/brand/directions.html`. Elle s'ouvre dans un navigateur, hors ligne, sur mobile comme sur desktop. Elle montre l'état actuel en référence.
Chaque direction a son dossier `docs/brand/<direction>/` avec :
- `tokens.css` : la surcharge de `src/styles.css`, à charger après lui. C'est la base pour l'implementer.
- `logo.svg` et `logo-dark.svg` : le logotype en couleur.
- `logo-app.svg` : le logotype monochrome utilisé dans l'app (`currentColor`).
- `icon.svg` : l'icône d'app, 512 px, lisible à 48 px.
- `light-*.png` et `dark-*.png` : les captures.

Les captures viennent de l'app réelle, à 390 × 844 avec des données réalistes. Le CSS et le logo ont été injectés avec Playwright, sans toucher au code. Les quatre écrans sont : Séances avec la carte suggérée, le mode séance (une série faite, la série en cours, le bouton Valider), le récap de fin et Progrès.

Ce qui ne change dans aucune direction : l'UX (§1 à §5), l'échelle typographique 40 / 24 / 16 / 13 et la grille de 8 px. Les cibles restent à 48 / 56 px. Il n'y a qu'un seul accent, réservé à la prochaine action, et les séries faites restent remplies d'encre. L'accent n'apparaît jamais sur le logo dans l'app : la couleur de marque ne vit que dans l'icône. Toutes les polices sont sous licence OFL-1.1 et s'embarquent hors ligne via `@fontsource/*`. Leurs chiffres tabulaires (`tnum`) ont été vérifiés dans les fichiers.

## Les trois directions

### 1. Fonte : robuste, direct, franc
*La salle de muscu, pas le spa.* La palette est graphite et jaune signal (#FFD21F), avec des titres d'écran et des chiffres en **Barlow Condensed** 700 (capitales pour les titres).
- **Signature : la barre crantée.** La progression de séance compte un cran par exercice, comme des disques sur une barre ; l'icône reprend cette barre chargée. Le bandeau de marque et la barre d'onglets sont en graphite et portent la marque sans utiliser l'accent.
- **Formes** : rayons de 6 px pour les cartes et 8 px pour les boutons, sans ombre. Le bouton principal est jaune, cerclé d'encre sur 2 px en mode clair. La série en cours a un contour d'encre et une bande jaune de 8 px en tête (contour jaune en mode sombre).
- **Vigilance** : en clair, le jaune ne fait que 1,3:1 sur le fond. Il ne sert donc jamais de trait ni de texte : c'est toujours un aplat avec du texte encre (12,3:1), ou il est doublé d'encre.

### 2. Repère : précis, calme, technique
*L'instrument de mesure.* Un bleu cobalt (#2347E5, texte blanc à 6,8:1) sur un blanc légèrement bleuté (#F2F5FA), avec **Space Grotesk** 700 pour les titres, les noms et tous les chiffres.
- **Signature : la règle graduée.** Une graduation par exercice sous la barre de progression, une grille en pointillés dans le graphique, et le même motif croissant dans le logo et l'icône. La série en cours a un voile cobalt très léger (#EEF2FF) : c'est la seule zone teintée de l'écran.
- **Formes** : cartes à 16 px, boutons pilule conservés, ombre très légère en clair.
- **Vigilance** : le bleu est la couleur la plus banale des apps de santé. La marque tient donc surtout à la typo et à la règle.

### 3. Élan : énergique, fier, moderne
*L'énergie du mouvement, sans bruit.* Un magenta profond (#A3159A, texte blanc à 6,7:1), avec **Unbounded** très large : 800 pour les titres, 600 pour les chiffres.
- **Signature : le biais à 12°.** Les étiquettes d'état (« Suggérée », « En cours ») sont en encre et coupées en biais. Les crans de progression sont biseautés, et le logo et l'icône portent une double barre oblique.
- **Formes** : 14 px pour les cartes et les boutons (fin de la pilule).
- **Vigilance** : c'est la moins « calme » des trois. La police est très large : « +9,5 kg en 8 semaines » remplit la ligne à 24 px, il faut donc tester avec des noms d'exercice longs. Le magenta clair du mode sombre (#F07BE8) est vif.

## Recommandation : Fonte

1. **C'est la seule direction reconnaissable sans le logo.** Le trio graphite + jaune + chiffres condensés appartient à la salle : marquage des disques, chronos, signalétique. Repère ressemble à une bonne app de santé générique. Élan ressemble à une app de fitness lifestyle.
2. **Elle sert la clarté au lieu de lui faire concurrence.** Un aplat jaune avec du texte encre est le signal « à faire maintenant » le plus visible qui soit (12,3:1). Il garde la même valeur en clair et en sombre : l'utilisateur apprend une seule couleur.
3. **Le chiffre reste le héros.** À 40 px, le condensé est plus haut et plus serré, donc plus lisible à bout de bras, et la marge autour des boutons −/+ augmente.
4. **La marque ne repose pas sur l'accent.** Elle tient au graphite (bandeau, onglets), à la typo et aux formes droites. L'accent peut donc rester rare.

Il y a un coût. La règle « jaune = toujours un aplat cerclé ou posé sur de l'encre » doit être tenue partout. Le ton de la personnalité devient aussi un peu plus « franc » que « calme ». Si le propriétaire préfère rester au plus près des mots « clair, calme, précis », **Repère** est l'alternative sûre.

## Modifications de `docs/identity.md` §6 selon la direction choisie (à valider, non appliquées)

Dans les trois cas, il faudrait aussi ajouter à §6 un paragraphe **« Marque »**, dans le même esprit pour chaque direction :
- Le logotype figure en tête des trois onglets uniquement, jamais en mode séance, en monochrome.
- L'icône d'app reprend la couleur de marque.
- La signature se décrit en une phrase.

### Si Fonte
- **Couleurs**, en remplaçant le tableau :

| Rôle | Clair | Sombre |
|---|---|---|
| Fond | `#F3F3F0` | `#101113` |
| Surface (cartes) | `#FFFFFF` | `#1A1C1F` |
| Texte principal | `#16181B` | `#F3F3EF` |
| Texte secondaire | `#585E66` | `#A2A6AC` |
| Bordure | `#D9DAD5` | `#2F3236` |
| **Accent (prochaine action)** | `#FFD21F` (texte posé `#16181B`, 12,3:1) | `#FFD21F` (texte posé `#16181B`) |
| Succès / record | `#137A4B` | `#34C27C` |
| Danger | `#C62828` | `#FF6B6B` |
| Marque (bandeau, onglets) | `#202326` (texte `#FFFFFF`, inactif `#A9AEB4`) | `#000000` |

- **Règle à ajouter** : « En clair, l'accent jaune n'est jamais un trait ni un texte. Le bouton principal porte un contour d'encre de 2 px, et la série en cours a un contour d'encre et une bande d'accent de 8 px en tête. »
- **Typographie** : « Deux familles. **Barlow Condensed** 700 pour les titres d'écran (en capitales) et les chiffres héros (charge, reps, stats, phrase de progrès, records). **Inter** pour tout le reste. » L'échelle est inchangée.
- **Forme** : rayons de 6 px pour les cartes et 8 px pour les boutons et les pastilles, au lieu de 12 / 999. Pas d'ombre. La barre de progression devient une barre crantée de 10 px, avec un cran par exercice.

### Si Repère
- **Couleurs** :

| Rôle | Clair | Sombre |
|---|---|---|
| Fond | `#F2F5FA` | `#0A0E18` |
| Surface (cartes) | `#FFFFFF` | `#131A29` |
| Texte principal | `#0E1526` | `#EEF2FA` |
| Texte secondaire | `#536079` | `#9AA5BC` |
| Bordure | `#D9DFEA` | `#263049` |
| **Accent (prochaine action)** | `#2347E5` (texte posé `#FFFFFF`, 6,8:1) | `#7D9BFF` (texte posé `#0A0E18`, 7,4:1) |
| Succès / record | `#127A4F` | `#34C27C` |
| Danger | `#C62828` | `#FF6B6B` |
| Voile série en cours | `#EEF2FF` | `#18213A` |

- **Typographie** : « **Space Grotesk** 700 pour les titres, les noms de séance et tous les chiffres ; **Inter** pour le corps. »
- **Forme** : rayon de 16 px pour les cartes, 999 px pour les boutons et les pastilles. La barre de progression est graduée, avec une graduation par exercice, et la grille du graphique est en pointillés.

### Si Élan
- **Couleurs** :

| Rôle | Clair | Sombre |
|---|---|---|
| Fond | `#F8F5F7` | `#120D14` |
| Surface (cartes) | `#FFFFFF` | `#1D1720` |
| Texte principal | `#18121B` | `#F6F0F7` |
| Texte secondaire | `#64596A` | `#ADA2B3` |
| Bordure | `#E7E0E8` | `#342B39` |
| **Accent (prochaine action)** | `#A3159A` (texte posé `#FFFFFF`, 6,7:1) | `#F07BE8` (texte posé `#120D14`, 8,0:1) |
| Succès / record | `#137A4B` | `#34C27C` |
| Danger | `#C62828` | `#FF6B6B` |

- **Typographie** : « **Unbounded** 800 pour les titres d'écran, 600 pour les chiffres héros ; **Inter** pour le corps. »
- **Forme** : rayon de 14 px pour les cartes et les boutons, plus de pilule. Les étiquettes d'état sont en encre et coupées à 12°, et la progression est faite de crans biseautés.

## Évolutions de l'identité (proposition)
- §6 « Une seule famille : Inter » devient « Inter pour le corps + une police de titres et de chiffres ». C'est la principale source d'identité, hors couleur.
- §6 gagne un paragraphe « Marque » (logo, icône, signature), aujourd'hui absent.
- Si Fonte est retenue, §2 « Trois mots » pourrait garder « clair, calme, précis » pour le ton des textes, la personnalité visuelle (« robuste, direct ») ne concernant que l'interface.

## Notes pour l'implementer
- La barre crantée et la règle graduée ont besoin de la variable `--steps`, égale au nombre d'exercices, posée sur `.session-progress__track` et sur son parent : `style={{'--steps': n}}`.
- `.brand-header` est un nouveau composant : un `div` en tête de `.app__content` sur les 3 onglets, qui contient `logo-app.svg` en ligne.
- Les woff2 de la planche sont copiés dans `docs/brand/fonts/` (OFL). Dans l'app, il faut passer par `@fontsource/*`, comme Inter dans `src/fonts.css`.
- Le récap affiche une durée « < 1 min » dans les captures parce que la séance a été jouée par le robot. Ce n'est pas un défaut.

---

# Itération 2 : hybrides Repère × Élan

Retour du propriétaire : « Je suis pas trop fan de la 1ère, ça fait trop Fitness Park. Par contre j'aime bien la 2 et la 3. Je suis d'accord sur le fait que la 2 fait trop générique et pour la 3 je trouve que le rose principal (mode blanc) est trop puissant. »

Fonte est donc écartée.

**Planche** : `docs/brand/hybrides.html`. Elle présente les 3 hybrides, avec Repère et Élan d'origine en référence et une mesure de la puissance de l'accent.
Chaque variante a son dossier `docs/brand/hybride-a|b|c/` avec `tokens.css`, `logo.svg`, `logo-dark.svg`, `logo-app.svg`, `icon.svg` et les captures `light-1…4` et `dark-1…4`.

## Avis du designer sur le retour et sur la proposition du chef de projet

- **Le retour est juste.** Le propriétaire aime la *structure* de Repère et l'*énergie* d'Élan, mais ni le bleu générique ni le magenta criard. Le compromis « Repère + une couleur à nous entre cobalt et magenta, sans Unbounded » est la bonne base, et je la retiens.
- **Je conteste un point : on ne baisse pas la puissance de l'accent en réduisant sa surface.** J'ai mesuré la surface d'accent visible sur les 4 écrans réels : elle est **identique dans toutes les directions**. Elle vaut 5,5 % de l'écran sur Séances, 6,8 % en mode séance, 6,1 % sur le récap et 0 % sur Progrès. Le bouton principal pleine largeur de 56 px est imposé par identity.md §4 et §5, il ne faut pas y toucher. Le seul levier est la **saturation** (chroma OKLCH). Mesurée en masse chromatique (surface × chroma sur l'écran de séance), elle donne : Élan 1,46, actuel 1,38, Repère 1,63 ; hybrides A 0,82, B 1,01 et C 0,88. C'est 31 à 44 % de moins qu'Élan. Les accents plus profonds *augmentent* au passage le contraste avec le fond (7 à 8:1 contre 6,2:1) : la prochaine action reste évidente, elle est simplement moins criarde.
- **Deux signatures, c'est une de trop.** Garder à la fois les graduations de Repère et la pente d'Élan dans l'interface disperserait l'identité. Il faut choisir (A choisit la règle, B choisit la pente) ou les fondre en **un seul motif** (C : des graduations penchées à 12°, présentes uniquement dans le logo et l'icône).
- **La marque ne doit pas dépendre de l'accent.** L'accent n'apparaît que sur un bouton par écran, et nulle part sur Progrès. Si l'identité tient à la teinte de l'accent, elle disparaît dès que l'accent est absent. D'où ma variante C, où la marque est portée par l'encre et les neutres.
- **La leçon « Fitness Park »** : pas de bandeau sombre ni de capitales condensées. Les trois hybrides restent clairs, avec des boutons en pilule et des cartes douces.

## Les 3 variantes

Points communs aux trois :
- Space Grotesk 700 pour les titres et les chiffres, Inter pour le corps, échelle 40/24/16/13 conservée.
- Logo monochrome dans l'app.
- Succès `#137A4B` / `#34C27C` et danger `#C62828` / `#FF6B6B` inchangés.
- Tous les contrastes de texte ≥ 4,5:1, y compris le texte posé sur l'accent (≥ 6,9:1).

### A · Prune : Repère recoloré
- **Couleur** : prune profond `#7E2E59` (C = 0,12), neutres gris à peine rosés.
- **Signature** : la règle graduée de Repère sous la progression, et un voile `#FBF1F5` sur la série en cours.
- **Formes** : cartes 16 px, boutons en pilule.
- **Limites** : c'est la plus sûre. Le prune est sombre (L 0,43) et se rapproche un peu des séries faites remplies d'encre (la coche et « Faite » les distinguent). Le voile reste perçu comme rosé.

### B · Améthyste : la pente dosée
- **Couleur** : violet désaturé `#584CAD` (C = 0,15), neutres gris froid.
- **Signature** : la pente de 12° d'Élan, limitée aux crans de progression biseautés et au logo (double barre oblique).
- **Formes** : cartes 14 px.
- **Limites** : la plus « couleur » des trois. Le violet-indigo est fréquent dans les produits numériques, donc le risque de faire générique revient, en moins fort que le cobalt.

### C · Mûre : la marque dans l'encre (proposition du designer)
- **Couleur** : tout l'écran est un camaïeu d'une seule teinte. Le fond est lavande pâle `#F6F0FB`. L'encre aubergine `#24162E` sert au texte, aux séries faites, à la barre de progression et à la courbe. L'accent `#75387F` (C = 0,13) est le seul échelon saturé de cette teinte.
- **Signature** : les graduations penchées à 12°, dans le logo et l'icône seulement. L'icône est sur fond aubergine, la seule icône sombre des trois, très reconnaissable sur l'écran d'accueil. Dans l'app, la progression est en crans droits, en encre.
- **Limites** : l'app n'est plus d'un blanc neutre. Il faut vérifier ce rendu en plein soleil et sur un écran mal calibré.

## Recommandation (itération 2) : C · Mûre, avec A en second choix

C est la seule variante qui répond aux deux critiques à la fois :
- **« Trop puissant »** : l'accent est 40 % moins saturé que le magenta d'Élan, tout en restant contrasté à 7,1:1 sur le fond.
- **« Trop générique »** : l'identité ne dépend plus de l'accent. L'encre aubergine, le fond teinté, les séries faites et la courbe la portent, y compris sur Progrès où il n'y a aucun accent. Son logo réunit les deux directions que le propriétaire a aimées.

A est l'option la plus sûre si le propriétaire veut garder un fond neutre. Je ne recommande pas B : son violet nous ramène vers le générique.

## Diff identity.md §6 par variante (à valider, non appliqué)

Pour les trois variantes, la typographie §6 devient : « **Space Grotesk** 700 pour les titres d'écran, les noms de séance et tous les chiffres (`tnum`) ; **Inter** pour le corps. Échelle inchangée. » On ajoute aussi un paragraphe « Marque » : logotype monochrome en tête des 3 onglets uniquement, icône en couleur de marque, signature décrite ci-dessous.

### Si A · Prune

| Rôle | Clair | Sombre |
|---|---|---|
| Fond | `#F8F5F6` | `#100C0E` |
| Surface (cartes) | `#FFFFFF` | `#1B1518` |
| Texte principal | `#1A1417` | `#F4F1F2` |
| Texte secondaire | `#695C63` (5,9:1) | `#AEA0A7` (7,2:1) |
| Bordure | `#E2DCDF` | `#383034` |
| **Accent (prochaine action)** | `#7E2E59`, texte posé `#FFFFFF` 8,7:1 | `#E7A3C3`, texte posé `#100C0E` 9,6:1 |
| Succès / record | `#137A4B` | `#34C27C` |
| Danger | `#C62828` | `#FF6B6B` |
| Voile série en cours | `#FBF1F5` | `#2E1D25` |

**Forme** : cartes 16 px, boutons et pastilles 999 px. La barre de progression est graduée (une graduation par exercice). La série en cours a un contour d'accent et le voile.

### Si B · Améthyste

| Rôle | Clair | Sombre |
|---|---|---|
| Fond | `#F5F5FA` | `#0B0B12` |
| Surface (cartes) | `#FFFFFF` | `#161620` |
| Texte principal | `#13131C` | `#F1F1F6` |
| Texte secondaire | `#5E5E71` (5,8:1) | `#A5A5BA` (7,4:1) |
| Bordure | `#DDDDE6` | `#31313F` |
| **Accent (prochaine action)** | `#584CAD`, texte posé `#FFFFFF` 6,9:1 | `#ADAAF8`, texte posé `#0B0B12` 9,2:1 |
| Succès / record | `#137A4B` | `#34C27C` |
| Danger | `#C62828` | `#FF6B6B` |

**Forme** : cartes 14 px, boutons et pastilles 999 px. La pente de 12° est réservée aux crans de progression (un par exercice) et au logo, nulle part ailleurs.

### Si C · Mûre

| Rôle | Clair | Sombre |
|---|---|---|
| Fond | `#F6F0FB` | `#100B14` |
| Surface (cartes) | `#FFFFFF` | `#1C1521` |
| Texte principal (encre de marque) | `#24162E` (15,3:1) | `#F4F0F7` |
| Texte secondaire | `#655771` (6,0:1) | `#B1A6B9` (7,7:1) |
| Bordure | `#DFD7E6` | `#3A3141` |
| **Accent (prochaine action)** | `#75387F`, texte posé `#FFFFFF` 8,0:1 | `#D8A6DF`, texte posé `#100B14` 9,7:1 |
| Succès / record | `#137A4B` | `#34C27C` |
| Danger | `#C62828` | `#FF6B6B` |

**Règle à ajouter** : « Fond, bordures et texte sont teintés de la même teinte que l'accent (camaïeu). L'accent reste le seul échelon saturé. »

**Forme** : cartes 16 px, boutons et pastilles 999 px. Progression en crans droits de 8 px, en encre. Le motif « graduations penchées à 12° » est réservé au logo et à l'icône.

## Notes pour l'implementer (itération 2)
- `--steps` (nombre d'exercices) est nécessaire pour A (graduations) et pour B et C (crans).
- Le texte « Exercice 2 sur 5 » reste affiché : la progression n'est jamais portée par la forme seule.
- La puissance d'accent a été mesurée par `getComputedStyle` sur les aplats et contours de la couleur `--accent`, rapportés au viewport 390 × 844.

---

# Décision (2026-10-28)

Retour du propriétaire après avoir vu les maquettes : « J'aime beaucoup Hybride B · Améthyste. Je pense qu'on peut partir dessus. »

**Direction retenue : B · Améthyste.** Elle remplace la recommandation C du designer. Elle est intégrée à l'app à partir du lot « Marque Améthyste » ; `docs/identity.md` §6 est mis à jour en conséquence. Le point de vigilance noté plus haut (le violet-indigo peut faire générique) se traite par la typo Space Grotesk, la pente de 12° et le logo, pas par la couleur.
