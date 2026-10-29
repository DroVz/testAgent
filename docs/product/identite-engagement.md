# Proposition : pilier « Engagement » pour `docs/identity.md`

*Product owner, 28 octobre 2026. Appliquée à `identity.md` le 29 octobre 2026 par le chef de projet (le propriétaire avait demandé ce pilier ; à confirmer à son retour).*

## Où l'insérer

- Ajouter le texte ci-dessous comme **nouveau §9**, après « 8. Comment juger un écran ».
- Faire trois retouches ailleurs (voir en fin de document) : l'en-tête, l'exemple d'état vide du §3, et une précision au §2.

---

<!-- Début du texte proposé -->

## 9. L'engagement : donner envie de revenir, sans bruit

> On revient à la salle parce qu'on **voit ses progrès réels** et qu'on tient **un rythme qu'on a choisi**, pas parce que l'app nous récompense ou nous fait culpabiliser.
> L'engagement ne passe jamais avant la clarté : si un élément d'engagement rend un écran moins lisible, on le retire.

### 9.1 Principes

1. **Du vrai, pas de l'artificiel.** Tout ce qui motive vient des données de l'utilisateur : une charge, des reps, un record, un nombre de séances. Aucun point, aucun niveau, aucune monnaie.
2. **Le coach propose, l'utilisateur décide.** Une suggestion dit toujours **pourquoi** (« La dernière fois : 80 kg × 8 sur toutes les séries. ») et se refuse en un tap (« Rester à 80 kg »).
3. **L'objectif appartient à l'utilisateur.** Le rythme hebdo est choisi par lui, réglable à tout moment, et « Aucun » par défaut. L'app n'en impose jamais.
4. **On montre ce qui est fait, jamais ce qui manque.** Une semaine sous l'objectif ne laisse aucune trace. Une baisse se constate, puis se relativise : « Ça arrive, la prochaine séance compte. »
5. **Comparer à soi, à la fois précédente.** Jamais aux autres, jamais à une moyenne ni à un idéal.
6. **Discret par défaut.** L'engagement s'exprime en texte, avec les styles existants. Il ne prend jamais l'accent, qui reste réservé à la prochaine action.

### 9.2 Ce qu'on s'autorise

| Élément | Forme autorisée | Exemple de texte |
|---|---|---|
| Charge proposée | Note de deux lignes, en texte principal et secondaire, icône en encre | « Charge proposée : 82,5 kg » / « La dernière fois : 80 kg × 8 sur toutes les séries. » |
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

<!-- Fin du texte proposé -->

---

## Retouches associées dans `identity.md`

1. **En-tête du fichier** : le titre devient « Identité de l'app : la clarté et l'engagement ». Sous la citation existante, ajouter :
   > Deuxième pilier : donner envie de revenir à la salle par la progression réelle et un rythme choisi (§9). En cas de conflit, la clarté gagne.
2. **§2 Personnalité**, ligne « Ce que l'app n'est pas », ajouter à la fin :
   > Un compte face à un objectif choisi par l'utilisateur (« 2 séances sur 3 ») est permis ; un taux ou une semaine « ratée », jamais.
3. **§3, exemple d'état vide *Séances*** (lot 2 de la roadmap) :
   - avant : « Aucune séance pour l'instant. Crée la première en 1 minute. » + bouton « Créer une séance ».
   - après : « Aucune séance pour l'instant. Commence avec un programme ou crée la tienne. » + bouton principal « Choisir un programme », puis « Créer une séance » en secondaire.
4. **§5 Réaliser**, ajouter après la ligne « Dans la série en cours… » :
   > Si la dernière fois toutes les séries ont atteint l'objectif, la charge est montée de 2,5 kg (1 rep au poids du corps) et l'écran l'explique : « Charge proposée : 82,5 kg », « La dernière fois : 80 kg × 8 sur toutes les séries. », avec « Rester à 80 kg » en secondaire.
5. **§6** : aucune nouvelle couleur.
   - Les pastilles de rythme sont en encre (remplies = faites, contour = à venir).
   - Les crans biseautés à 12° de la direction B · Améthyste restent réservés à la progression de séance et au logo.
