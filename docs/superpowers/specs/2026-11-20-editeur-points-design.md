# Sheet Music — Éditeur v2 « Points puis rythme » — Design

Date : 2026-11-20
Statut : relu (builder check) — à valider par Paul
Remplace l'UX de saisie de `2026-11-19-editeur-partition-design.md` (le reste de ce document — lecture, tempo, muet/solo, export MIDI, stockage — reste valable).

## 1. Intention

Écrire une partition comme sur papier : on voit des lignes de 4 mesures empilées comme une page, on pose la mélodie en touchant directement la portée à la bonne hauteur, puis on donne le rythme aux points posés.

La v1 (saisie par durée + boutons Do → Si dans un ruban horizontal) ne correspond pas à la façon dont Paul veut écrire : **la hauteur d'abord, le rythme ensuite, directement sur la portée.**

## 2. Décisions de Paul

- **Lignes de 4 mesures** empilées verticalement (page), pas de ruban horizontal.
- Une ligne regroupe **toutes les portées** de la partition (chœur SATB : 4 portées par ligne ; mélodie : 1 ; piano : 2).
- Un bouton **＋** sous la dernière ligne ajoute une ligne : 4 mesures vides à toutes les voix.
- **Poser un point** en touchant la portée : la hauteur du toucher donne la note. Le point n'a pas encore de durée.
- **Approche A — l'ordre seulement** : la position horizontale du toucher ne fixe que la mesure et la place du point parmi ses voisins ; les points sont espacés régulièrement. Pas de grille rythmique.
- On **sélectionne** des points puis on les **transforme** en ronde, blanche, noire, croche, etc. ; la mesure se réorganise. Une mesure trop pleine se colore en rouge ; une mesure incomplète montre la place restante.

## 3. Approches considérées

| Approche | Avantages | Inconvénients |
|---|---|---|
| **A. Ordre seulement** *(choisie par Paul)* | Fidèle à « mélodie d'abord, rythme ensuite » ; simple | Le rythme se décide entièrement dans un second temps |
| B. Grille rythmique (le x du toucher = début de la note) | Rythme en partie implicite à la pose | Plus contraignant, précision horizontale au doigt |

## 4. Objectifs / non-objectifs / anti-objectifs

**Objectifs**
- Page de lignes de 4 mesures, défilement vertical, ＋ pour ajouter une ligne, possibilité de supprimer une ligne.
- Pose directe des points au doigt et à la souris, avec aperçu et ajustement avant validation.
- Sélection d'un ou plusieurs points ; changement de durée, de hauteur, altération, transformation en silence, suppression.
- Indicateurs de remplissage par mesure.
- Conserver : tempo, écoute, muet/solo, export MIDI, sauvegarde auto, annuler/rétablir, modèles de partition, clair/sombre, paysage d'abord.

**Non-objectifs** (inchangés) : liaisons, triolets, accords sur une portée, plusieurs voix par portée, paroles, nuances, armure, import, PDF.

**Anti-objectifs**
- Poser une mauvaise note sans le voir avant de lever le doigt.
- Perdre des points quand on change le rythme (un point ne disparaît que si on le supprime).
- Casser le jeu de lecture (brique 1) qui partage le modèle et `StaffView`.

## 5. Comportement détaillé

### 5.1 Page
- Chaque ligne = un système VexFlow : clé (et chiffrage sur la 1re ligne) + 4 mesures, sur toute la largeur disponible ; les portées d'une ligne sont reliées (accolade/crochet comme en v1).
- Les lignes s'empilent ; la page défile verticalement. Le nom court des voix reste à gauche de chaque portée.
- Sous la dernière ligne : bouton ＋ « Ajouter 4 mesures ».
- Supprimer une ligne : bouton discret sur la ligne (visible quand il y a plus d'une ligne) ; confirmation si elle contient des notes.
- Une nouvelle partition démarre avec **une ligne** (4 mesures).

### 5.2 Poser un point (toucher sur une zone vide d'une portée)
- Doigt posé : un **aperçu** de tête de note apparaît à la hauteur visée (arrondie à la ligne/l'interligne le plus proche), avec une étiquette du nom (« Sol4 »). Les lignes supplémentaires nécessaires s'affichent.
- En glissant verticalement, l'aperçu suit (ajustement de hauteur) ; glisser horizontalement change la place d'insertion.
- Lever le doigt : le point est posé dans la mesure touchée, inséré entre les notes dont il est entre les x. Le nouveau point devient la sélection.
- Annulation de la pose : glisser hors de la portée avant de lever.
- Tessiture accessible : jusqu'à 4 lignes supplémentaires au-dessus et au-dessous de la portée.
- Le point est une hauteur naturelle ; ♯/♭ s'ajoutent ensuite.

### 5.3 Sélection
- Toucher un point/une note existant(e) le sélectionne (seul).
- Sélection multiple : bouton « sélection multiple » dans la barre d'outils. Quand il est actif :
  - toucher un élément l'ajoute à la sélection ou l'en retire ;
  - toucher une zone vide d'une mesure sélectionne tous les éléments de cette mesure, sur cette portée ;
  - on ne peut pas poser de point.

  *(Choix du constructeur : pas de bandeau d'en-tête par mesure, pour ne pas manger de hauteur.)*
- Glisser verticalement une note sélectionnée change sa hauteur (même aperçu qu'à la pose).
- Toucher une zone vide pose un nouveau point (et remplace la sélection).

### 5.4 Donner le rythme
- Barre d'outils : ronde, blanche, noire, croche, double croche, point (note pointée), silence, ♯, ♭, supprimer, annuler, rétablir, sélection multiple.
- Choisir une durée l'applique à toute la sélection.
- **Enchaînement rapide** : si un seul élément est sélectionné, après application de la durée la sélection passe au point suivant de la même portée (y compris dans la mesure suivante). On rythme ainsi une mélodie en tapant les durées à la suite.
- « Silence » transforme la sélection en silences (de la durée choisie si elle en a une, sinon noire) ; un silence se retransforme en note en le glissant à une hauteur.
- ♯/♭ : bascule sur les notes sélectionnées.
- Supprimer : retire les éléments sélectionnés ; la sélection passe à l'élément précédent.

### 5.5 Mesures
- Une mesure contient une suite ordonnée d'éléments : points (sans durée), notes, silences.
- Affichage :
  - points : têtes de note noires sans hampe ;
  - si la mesure ne contient que des points, ils sont espacés régulièrement ;
  - sinon les éléments sont formatés par VexFlow, les points comptant comme une noire pour l'espacement.
- Remplissage (points exclus) :
  - **pleine** : rien de spécial ;
  - **incomplète** (et sans points) : la place restante en silences estompés, comme en v1 ;
  - **trop pleine** : fond de mesure teinté rouge (`--bad` translucide) ; rien n'est déplacé automatiquement.
  - Une mesure contenant encore des points n'affiche ni silences de remplissage ni rouge (elle est « en cours »).
- Les portées d'une même ligne restent alignées mesure par mesure (largeurs de mesure communes).

### 5.6 Écoute et export
- Les points se jouent et s'exportent **comme des noires**, pour entendre la mélodie avant d'avoir posé le rythme.
- Chaque mesure commence à `index × longueur de mesure`, en temps ; ses éléments s'enchaînent depuis ce début. Une mesure trop pleine déborde sur la suivante (les notes se chevauchent) ; on ne corrige rien automatiquement.
- Un élément sélectionné détermine la mesure de départ de ▶ (comme le curseur en v1).

### 5.7 Clavier (ordinateur)
- Flèches ←/→ : sélection précédente/suivante ; ↑/↓ : hauteur (⇧ : octave) ; Alt ↑/↓ : portée.
- W H Q I S : durées ; `.` point ; R : silence ; + / - : ♯/♭ ; ⌫ : supprimer ; Ctrl Z / Ctrl ⇧ Z ; Espace : écouter.
- C–B / 1–7 : pose un point après la sélection, à l'octave la plus proche (garde l'atout de la v1 au clavier).

### 5.8 Barre de saisie en paysage
- Les 7 boutons Do → Si disparaissent de l'éditeur (la pose se fait sur la portée) : la barre d'outils tient sur une ligne et la page gagne de la hauteur.

## 6. Modèle

Les mesures deviennent explicites (un point n'a pas de durée, donc la mesure ne peut plus se déduire des durées) :

- `Note.duration` reste **obligatoire** : le modèle partagé et le jeu de lecture ne changent pas.
- Nouveau champ `Note.point?: true` : la durée n'est pas encore choisie. `duration` vaut alors `'q'` et sert à l'espacement, à l'écoute et à l'export.
- Donner une durée enlève `point`. `Note.pitch: null` reste un silence, et un silence n'est jamais un point.
- `Voice.measures?: Note[][]` : c'est la source de vérité pour les partitions de l'éditeur, qui laissent `Voice.notes` vide. `Voice.notes` reste réservé au jeu de lecture et à `StaffView`.
  *(Choix du constructeur.)*
- `Score.measureCount` est un multiple de 4 ; toutes les voix ont `measureCount` mesures.
- **Migration** des partitions v1 en localStorage : `measures = splitMeasures(notes)`, complétée à un multiple de 4 ; faite au chargement.
- Écoute et export lisent `measures`. Le code du jeu lit encore `notes` et reste inchangé.
- **Changer de mesure** (chiffrage) garde le contenu de chaque mesure tel quel. Les mesures deviennent trop pleines (rouge) ou incomplètes, et on corrige à la main. C'est cohérent avec « rien n'est déplacé automatiquement » et « un point ne disparaît jamais ».
  *(Choix du constructeur.)*

## 7. Contraintes

- Même stack : Vue 3, Vuetify, VexFlow (`vexflow/bravura`), Tone.js et @tonejs/midi chargés à la demande, TanStack Query sur `scoresApi`.
- Mobile paysage d'abord (~844×390). En paysage, une ligne SATB peut demander de défiler verticalement : c'est accepté.
- Le jeu de lecture (brique 1) ne régresse pas.

## 8. Ce qui reste au constructeur

- Rendu des points (tête de note sans hampe : `GhostNote` + glyphe, ou `StaveNote` sans hampe).
- Seuils de toucher et du glissement.
- Teinte exacte des mesures trop pleines.
- Animation de réorganisation.
- Taille des lignes selon l'écran : les 4 mesures doivent toujours tenir en largeur.
