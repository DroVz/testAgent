# Identité de l'app : la clarté et l'engagement

> À chaque écran, l'utilisateur sait **où il est, ce qu'il doit faire, et ce qui a changé**.
> Si un choix hésite entre « plus riche » et « plus clair », on prend « plus clair ».
>
> Deuxième pilier : donner envie de revenir à la salle par la progression réelle et un rythme choisi (§9). En cas de conflit, la clarté gagne.

## 1. Les trois piliers

| Pilier | Question à laquelle l'écran répond | Où dans l'app |
|---|---|---|
| **Créer** | « Qu'est-ce que je vais faire ? » | Onglet *Séances* : constructeur de séance |
| **Réaliser** | « Qu'est-ce que je fais là, maintenant ? » | Mode séance (plein écran) |
| **Suivre** | « Est-ce que je progresse ? » | Onglets *Historique* et *Progrès* |

Navigation : barre du bas à **3 onglets** (Séances · Historique · Progrès). Pas de menu caché, pas de burger.
Le mode séance prend tout l'écran et remplace la navigation, pour qu'on ne se perde pas pendant l'effort.

## 2. Personnalité

- **Trois mots** : clair, calme, précis.
- **Ce que l'app n'est pas** : bruyante, gamifiée à outrance, culpabilisante (pas de séries de jours à ne pas casser, pas de pourcentages de « réussite »). Un compte face à un objectif choisi par l'utilisateur (« 2 séances sur 3 ») est permis ; un taux ou une semaine « ratée », jamais.
- On parle comme un bon coach de salle : court, concret, sans cris.

## 3. Ton des textes

- Tutoiement, phrases courtes, verbes d'action.
- Les boutons disent ce qu'ils font : « Démarrer la séance », « Valider la série », « Terminer la séance ». Jamais « OK » ou « Envoyer ».
- Toujours une unité à côté d'un chiffre : `80 kg`, `8 reps`, `90 s`.
- Pas d'emoji décoratifs, pas de point d'exclamation sauf pour un record.

Exemples :
- État vide *Séances* : « Aucune séance pour l'instant. Commence avec un programme ou crée la tienne. » + bouton principal « Choisir un programme », puis « Créer une séance » en secondaire.
- Série validée : « Série 2 validée. Repos : 90 s. »
- Fin de séance : « Séance terminée : 5 exercices, 18 séries, 6 240 kg soulevés. »
- Record : « Nouveau record sur le développé couché : 82,5 kg ! »
- Erreur : dire ce qui s'est passé et quoi faire. « Impossible d'enregistrer. Vérifie ta connexion, tes données sont gardées sur l'appareil. »

## 4. Règles de clarté (non négociables)

1. **Une action principale par écran**, visuellement évidente (couleur d'accent, pleine largeur ou grande taille). Les actions secondaires sont discrètes.
2. **Une seule couleur d'accent**, réservée à « la prochaine chose à faire ». Si tout est coloré, rien n'est clair.
3. **Le chiffre est le héros** : poids, reps et temps s'affichent en grand, en chiffres tabulaires (alignés).
4. **On montre toujours la référence** : à côté de chaque champ à remplir, « Dernière fois : 80 kg × 8 ».
5. **Cibles tactiles ≥ 48 px**, boutons principaux 56 px : on s'entraîne d'une main, avec les doigts moites.
6. **Pas de saisie au clavier si on peut l'éviter** : boutons − / + (pas de 2,5 kg configurable), valeurs pré-remplies depuis la dernière séance.
7. **Un état, un seul signal** : à faire = contour, en cours = accent, fait = rempli. Jamais la couleur seule : toujours aussi une icône ou un libellé.
8. **Rien ne se perd** : toute action destructive est annulable (toast « Annuler » pendant 5 s), la séance en cours survit à un rechargement.

## 5. Parcours clés

### Créer (onglet Séances)
- Liste de séances sous forme de cartes : nom, nombre d'exercices, durée estimée, dernier passage. Liste vide : bouton principal « Choisir un programme » (programmes de départ), puis « Créer une séance » en secondaire. Liste non vide : « Créer une séance », « Séance libre » et « Ajouter un programme de départ », tous en secondaire.
- Constructeur en une page : nom en haut, liste d'exercices en dessous, bouton « Ajouter un exercice » (recherche instantanée, récents en premier). Pour chaque exercice : séries × reps × charge cible, modifiables en place. Réordonner par glisser ou boutons ↑ ↓.
- Action secondaire : « Dupliquer » une séance existante.

### Réaliser (mode séance)
- **Un exercice à la fois.** En haut : « Exercice 2 sur 5 » + barre de progression fine.
- Au centre : nom de l'exercice, puis la liste des séries. La série **en cours** est mise en avant (accent, grande), les séries faites sont compactes avec une coche, les suivantes sont grisées.
- Dans la série en cours : charge et reps avec −/+ ; valeurs pré-remplies ; rappel « Dernière fois : … ».
- Si la dernière fois toutes les séries ont atteint l'objectif, la charge est montée de 2,5 kg (1 rep au poids du corps) et l'écran l'explique : « Charge proposée : 82,5 kg », « La dernière fois : 80 kg × 8 à chaque série. », avec « Rester à 80 kg » en secondaire. La note disparaît dès la première série validée.
- **Bouton principal fixe en bas : « Valider la série »** (56 px, accent). Après validation, un minuteur de repos discret apparaît avec « Passer ».
- Dernière série d'un exercice validée → l'écran passe à l'exercice suivant, avec un bouton « Exercice précédent » en secondaire.
- « Terminer la séance » est toujours accessible mais secondaire, avec confirmation légère s'il reste des séries.
- Récap de fin : volume, durée, records battus, et un bouton « Voir mes progrès ».

### Suivre (Historique + Progrès)
- **Historique** : liste chronologique des séances faites ; au clic, le détail exercice par exercice.
- **Progrès** : on choisit un exercice, on voit **un seul graphique** (charge max ou 1RM estimé dans le temps) et **une phrase qui résume** : « +7,5 kg en 8 semaines ». Les records sont listés sous le graphique.
- Toujours comparer à la fois précédente, pas à un idéal.

## 6. Design visuel

### Couleurs (variables CSS, mode clair par défaut, mode sombre prévu) — marque « B · Améthyste »
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

Contraste texte/fond ≥ 4.5:1 partout. Les séries validées sont **remplies en encre** (texte principal) avec une coche, pas en couleur vive : l'accent reste réservé à la prochaine action.

Le rouge plein est réservé au bouton qui confirme une action irréversible ; ailleurs, le danger est en contour ou en texte.

### Typographie
- Deux familles : **Space Grotesk** 700 pour les titres d'écran, les noms (séances, exercices) et tous les chiffres héros ; **Inter** (variable) pour le corps. `font-variant-numeric: tabular-nums` (`tnum`) sur tous les chiffres.
- Échelle inchangée : chiffres de série 40 px / 700 ; titres d'écran 24 px / 700 ; corps 16 px / 400 ; légendes 13 px / 500. Jamais de texte < 13 px.

### Forme et espace
- Grille d'espacement de **8 px**. Marges d'écran 16 px.
- Rayons : 14 px (cartes), 999 px (boutons, pastilles).
- Pente de 12° réservée aux crans de la barre de progression de séance (un cran par exercice) et au logo, nulle part ailleurs.
- Pas d'ombres lourdes : bordure fine ou léger relief seulement. Beaucoup d'espace blanc.
- Icônes : un seul jeu (ex. Lucide), trait 2 px, toujours accompagnées d'un libellé quand l'action est importante.

### Marque
- Logotype monochrome (couleur du texte principal), en tête des 3 onglets uniquement (Séances, Historique, Progrès) ; jamais en mode séance, sur le récap ni dans les réglages.
- L'icône d'app est la seule à porter la couleur de marque (`#584CAD`) ; l'accent n'apparaît jamais sur le logo dans l'app.
- Signature : la pente de 12°, une double barre oblique dans le logo et l'icône, reprise par les crans biseautés de la progression de séance.

### Mouvement
- Discret et utile : 150 à 200 ms, pour confirmer une action. Coche animée à la validation d'une série, transition horizontale entre exercices, petit « pulse » sur un record.
- Respecter `prefers-reduced-motion`.

## 7. Accessibilité
- Navigation clavier et focus visibles, libellés ARIA sur les boutons −/+ et les icônes.
- Pas d'information portée par la couleur seule.
- Test systématique à 390 × 844 (mobile) puis tablette/desktop ; l'app est pensée **mobile d'abord**.

## 8. Comment juger un écran
Pose-toi ces cinq questions. Une réponse « non » est un défaut à corriger :
1. Voit-on en 2 secondes quelle est l'action principale ?
2. Sait-on où on est dans la séance / dans l'app ?
3. Les chiffres sont-ils lisibles à bout de bras ?
4. Peut-on tout faire d'une main, sans clavier ?
5. Après une action, voit-on clairement que ça a marché ?

## 9. L'engagement : donner envie de revenir, sans bruit

> On revient à la salle parce qu'on **voit ses progrès réels** et qu'on tient **un rythme qu'on a choisi**, pas parce que l'app nous récompense ou nous fait culpabiliser.
> L'engagement ne passe jamais avant la clarté : si un élément d'engagement rend un écran moins lisible, on le retire.

### 9.1 Principes

1. **Du vrai, pas de l'artificiel.** Tout ce qui motive vient des données de l'utilisateur : une charge, des reps, un record, un nombre de séances. Aucun point, aucun niveau, aucune monnaie.
2. **Le coach propose, l'utilisateur décide.** Une suggestion dit toujours **pourquoi** (« La dernière fois : 80 kg × 8 à chaque série. ») et se refuse en un tap (« Rester à 80 kg »).
3. **L'objectif appartient à l'utilisateur.** Le rythme hebdo est choisi par lui, réglable à tout moment, et « Aucun » par défaut. L'app n'en impose jamais.
4. **On montre ce qui est fait, jamais ce qui manque.** Une semaine sous l'objectif ne laisse aucune trace. Une baisse se constate, puis se relativise : « Ça arrive, la prochaine séance compte. »
5. **Comparer à soi, à la fois précédente.** Jamais aux autres, jamais à une moyenne ni à un idéal.
6. **Discret par défaut.** L'engagement s'exprime en texte, avec les styles existants. Il ne prend jamais l'accent, qui reste réservé à la prochaine action.

### 9.2 Ce qu'on s'autorise

| Élément | Forme autorisée | Exemple de texte |
|---|---|---|
| Charge proposée | Note de deux lignes, en texte principal et secondaire, icône en encre. Pas de proposition si la dernière fois date de plus de 4 semaines. | « Charge proposée : 82,5 kg » / « La dernière fois : 80 kg × 8 à chaque série. » |
| Record | Seul endroit où le « ! » et le vert « succès » sont permis ; petit « pulse » de 150 à 200 ms | « Nouveau record en développé couché : 82,5 kg ! » |
| Rythme de la semaine | Un compte face à un objectif choisi, avec des pastilles en encre | « Cette semaine : 2 séances sur 3. » / « Objectif atteint. » |
| Bilan | Une phrase factuelle, avec des unités | « Semaine dernière : 3 séances, 14 520 kg, 1 record. » |
| Jalon | Une ligne de texte secondaire dans le récap, sans « ! » ni icône | « 10ᵉ séance enregistrée. » |
| Rappel de séance | Désactivé par défaut ; jours et heure choisis ; texte neutre ; pas de rappel si la séance du jour est déjà faite | « C'est l'heure de ta séance. Suggérée : Jambes. » |
| Programmes de départ | Choix guidé à la place d'un écran vide, sans questionnaire | « Commence avec un programme ou crée la tienne. » |

### 9.3 Ce qu'on s'interdit

- **Les séries de jours** (« streaks ») et tout compteur qui repart à zéro quand on rate un jour.
- **Les badges, trophées, points, niveaux, confettis, sons de victoire**, les animations de plus de 200 ms.
- **Les pourcentages et les taux** : pas de « 67 % », pas de jauge de réussite, pas de note sur 10.
- **Le vocabulaire de l'échec** : « raté », « manqué », « perdu », « en retard », « tu peux mieux faire ». Le mot « série » s'emploie uniquement pour la série d'exercice.
- **Les relances** : aucun message ni notification qui pointe une absence (« Ça fait 5 jours… »), aucune notification non demandée, pas de fausse urgence.
- **La comparaison sociale** : classements, fil d'actualité, « mieux que 80 % des utilisateurs ».
- **Les récompenses détachées de l'effort** : rien ne se « débloque ».
- **Les suggestions opaques** : un chiffre qu'on ne peut pas expliquer en une phrase ne s'affiche pas.

### 9.4 Comment juger qu'un écran engage sans bruit

En plus des cinq questions du §8, pose-toi ces cinq-là pour chaque élément d'engagement. Une réponse « non » est un défaut.

1. **Est-ce vrai ?** Le chiffre ou le message vient-il des données de l'utilisateur, et peut-on dire d'où en une phrase ?
2. **Est-ce choisi ?** L'utilisateur peut-il refuser, couper ou régler cet élément, et le défaut est-il raisonnable ?
3. **L'action principale reste-t-elle seule en accent ?** Si on masque l'élément, l'écran garde-t-il la même hiérarchie ?
4. **Un mauvais jour, est-ce neutre ?** Relis l'écran comme quelqu'un qui n'est pas venu depuis 3 semaines, ou qui a baissé : ne se sent-il ni jugé ni pressé ?
5. **Est-ce que ça pousse vers la pratique ?** L'élément donne-t-il une raison concrète de faire la prochaine séance (une charge à tenter, une séance de plus pour le rythme), plutôt qu'une raison d'ouvrir l'app ?

Pastilles de rythme : en encre (remplies = faites, contour = à venir), aucune nouvelle couleur.
