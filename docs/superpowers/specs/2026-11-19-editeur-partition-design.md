# Sheet Music — Brique 2 « Écriture de partition » — Design

Date : 2026-11-19
Statut : Paul a dit « go » — décisions déléguées, à valider en testant sur mobile

## 1. Intention

Écrire des arrangements vocaux à 4–5 voix, les écouter à un tempo réglable et les exporter en MIDI. C'est la suite naturelle du trainer de lecture : même modèle de partition (`src/music/model`), même moteur de rendu (VexFlow), même charte.

Usage visé : un arrangeur ou un choriste qui saisit une partition courte (quelques dizaines de mesures) sur téléphone en paysage ou sur ordinateur, l'écoute voix par voix, puis l'exporte vers un séquenceur ou un logiciel de gravure.

## 2. Objectifs / non-objectifs / anti-objectifs

**Objectifs (première version)**
- Liste « Mes partitions » : créer depuis un modèle, ouvrir, renommer, supprimer.
- Modèles : Chœur SATB (4 portées), 5 voix SSATB, Mélodie (1 portée Sol), Piano (Sol + Fa).
- Éditeur : portées alignées mesure par mesure, défilement horizontal, barres de mesure, chiffrage 4/4 (3/4, 2/4, 6/8 au choix).
- Saisie : durée (ronde → double-croche, point), 7 boutons Do → Si (mêmes que le trainer), silence, dièse/bémol, monter/descendre la note, supprimer, annuler/rétablir. Clavier sur ordinateur.
- Lecture : play/stop depuis le début ou depuis la mesure du curseur, BPM réglable (40–208), notes jouées surlignées, la vue suit. Muet / solo par voix.
- Export MIDI : un fichier `.mid`, une piste par voix, tempo inclus.
- Sauvegarde automatique locale (navigateur).

**Non-objectifs (plus tard)**
- Liaisons, triolets, accords sur une même portée, plusieurs voix par portée, paroles, nuances, armure.
- Import MIDI / MusicXML, export PDF.
- Comptes et stockage serveur (backend Go).

**Anti-objectifs**
- Un éditeur inutilisable au doigt : tout doit être faisable sans clavier, en paysage sur ~844×390.
- Perdre une saisie : sauvegarde automatique, annuler/rétablir.
- Un modèle de données couplé à VexFlow ou à Tone.js.

## 3. Approches considérées

| Approche | Avantages | Inconvénients |
|---|---|---|
| **A. Saisie « pas à pas » par boutons + curseur d'insertion** *(retenue)* | Réutilise les 7 boutons du trainer (cohérence pédagogique), fiable au doigt, pas de précision de visée requise | Moins direct que poser la note à la souris |
| B. Poser la note en tapant sur la portée | Intuitif à la souris | Imprécis au doigt (interligne de 5–7 px en paysage), demande une loupe |
| C. Saisie texte (ABC) | Rapide pour les experts | Hors cible, rompt avec le reste de l'app |

A est retenue ; B pourra s'ajouter pour la sélection (taper sur une note la sélectionne déjà).

## 4. Décisions (déléguées)

- **Octave automatique** : la note saisie prend l'octave la plus proche de la note précédente de la portée (comme MuseScore). ↑/↓ corrige d'un degré, ⇧↑/⇧↓ d'une octave.
- **Curseur d'insertion** : on insère après la note sélectionnée ; altération, ↑/↓, durée s'appliquent à la note sélectionnée. Taper une note sur la partition la sélectionne.
- **Mesures** : une note trop longue pour la place restante dans la mesure est raccourcie à la plus grande durée qui tient (pas de liaisons dans cette version). Les mesures incomplètes sont complétées à l'affichage par des silences estompés, qui ne font pas partie de la partition.
- **Ténor** : clé de Sol octaviée (8 en dessous) ; la hauteur stockée est la hauteur réelle (`Staff.clefOctave = -1`).
- **Son** : Tone.js (décidé dans le design de la brique 1), synthé doux type « voix » ; export avec @tonejs/midi, programme General MIDI 53 « Voice Oohs » pour les voix, 1 « Piano » pour le modèle piano.
- **Stockage** : localStorage derrière une petite API asynchrone (`scoresApi`), consommée via TanStack Query (`@tanstack/vue-query`) : quand le backend Go arrive, seule l'implémentation de `scoresApi` change.
- **Chargement** : l'éditeur et Tone.js sont chargés à la demande (route paresseuse) ; le trainer ne grossit pas.
- **Accès** : bouton « Écrire » dans la barre du menu ; routes `#/scores` et `#/scores/:id`.

## 5. Modèle

Ajouts compatibles au modèle existant :
- `Note.dots?: 0 | 1`
- `Staff.name?: string`, `Staff.clefOctave?: -1`, `Staff.program?: number` (GM)
- `Score.updatedAt?: number`

## 6. Ce qui reste au constructeur

Mise en page fine de la barre d'outils, couleurs de surlignage, gestion fine du scroll.
