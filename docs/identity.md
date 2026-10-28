# Identité de l'app : la clarté

> À chaque écran, l'utilisateur sait **où il est, ce qu'il doit faire, et ce qui a changé**.
> Si un choix hésite entre « plus riche » et « plus clair », on prend « plus clair ».

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
- **Ce que l'app n'est pas** : bruyante, gamifiée à outrance, culpabilisante (pas de séries de jours à ne pas casser, pas de pourcentages de « réussite »).
- On parle comme un bon coach de salle : court, concret, sans cris.

## 3. Ton des textes

- Tutoiement, phrases courtes, verbes d'action.
- Les boutons disent ce qu'ils font : « Démarrer la séance », « Valider la série », « Terminer la séance ». Jamais « OK » ou « Envoyer ».
- Toujours une unité à côté d'un chiffre : `80 kg`, `8 reps`, `90 s`.
- Pas d'emoji décoratifs, pas de point d'exclamation sauf pour un record.

Exemples :
- État vide *Séances* : « Aucune séance pour l'instant. Crée la première en 1 minute. » + bouton « Créer une séance ».
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
- Liste de séances sous forme de cartes : nom, nombre d'exercices, durée estimée, dernier passage. Bouton principal : « Créer une séance ».
- Constructeur en une page : nom en haut, liste d'exercices en dessous, bouton « Ajouter un exercice » (recherche instantanée, récents en premier). Pour chaque exercice : séries × reps × charge cible, modifiables en place. Réordonner par glisser ou boutons ↑ ↓.
- Action secondaire : « Dupliquer » une séance existante.

### Réaliser (mode séance)
- **Un exercice à la fois.** En haut : « Exercice 2 sur 5 » + barre de progression fine.
- Au centre : nom de l'exercice, puis la liste des séries. La série **en cours** est mise en avant (accent, grande), les séries faites sont compactes avec une coche, les suivantes sont grisées.
- Dans la série en cours : charge et reps avec −/+ ; valeurs pré-remplies ; rappel « Dernière fois : … ».
- **Bouton principal fixe en bas : « Valider la série »** (56 px, accent). Après validation, un minuteur de repos discret apparaît avec « Passer ».
- Dernière série d'un exercice validée → l'écran passe à l'exercice suivant, avec un bouton « Exercice précédent » en secondaire.
- « Terminer la séance » est toujours accessible mais secondaire, avec confirmation légère s'il reste des séries.
- Récap de fin : volume, durée, records battus, et un bouton « Voir mes progrès ».

### Suivre (Historique + Progrès)
- **Historique** : liste chronologique des séances faites ; au clic, le détail exercice par exercice.
- **Progrès** : on choisit un exercice, on voit **un seul graphique** (charge max ou 1RM estimé dans le temps) et **une phrase qui résume** : « +7,5 kg en 8 semaines ». Les records sont listés sous le graphique.
- Toujours comparer à la fois précédente, pas à un idéal.

## 6. Design visuel

### Couleurs (variables CSS, mode clair par défaut, mode sombre prévu)
| Rôle | Clair | Sombre |
|---|---|---|
| Fond | `#F7F7F4` | `#0F1114` |
| Surface (cartes) | `#FFFFFF` | `#181B20` |
| Texte principal | `#111418` | `#F2F3F5` |
| Texte secondaire | `#5B636E` | `#9AA3AF` |
| Bordure | `#E3E5E8` | `#2A2F36` |
| **Accent (prochaine action)** | `#E8481C` | `#FF6A3D` |
| Succès / record | `#137A4B` | `#34C27C` |
| Danger | `#C62828` | `#FF6B6B` |

Contraste texte/fond ≥ 4.5:1 partout. Les séries validées sont **remplies en encre** (texte principal) avec une coche, pas en couleur vive : l'accent reste réservé à la prochaine action.

### Typographie
- Une seule famille : **Inter** (variable), avec `font-variant-numeric: tabular-nums` sur tous les chiffres.
- Échelle : chiffres de série 40 px / 700 ; titres d'écran 24 px / 700 ; corps 16 px / 400 ; légendes 13 px / 500. Jamais de texte < 13 px.

### Forme et espace
- Grille d'espacement de **8 px**. Marges d'écran 16 px.
- Rayons : 12 px (cartes), 999 px (boutons principaux, pastilles).
- Pas d'ombres lourdes : bordure fine ou léger relief seulement. Beaucoup d'espace blanc.
- Icônes : un seul jeu (ex. Lucide), trait 2 px, toujours accompagnées d'un libellé quand l'action est importante.

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
