# Sheet Music — Éditeur v3 : pose visible, mesures fixes, armure — Design

Date : 2026-11-21 · Statut : validé par Paul (dans la conversation)
Complète `2026-11-20-editeur-points-design.md`, dont tout ce qui n'est pas repris ici reste valable.

## 1. Intention
Après un essai sur smartphone, Paul veut :
- voir la note pendant qu'il la pose ;
- écrire sans que la page bouge ni que le rythme se corrige tout seul ;
- choisir lui-même la largeur des mesures ;
- écrire une armure ;
- insérer des lignes ailleurs qu'à la fin.

## 2. Décisions de Paul
1. **Aperçu décalé** : l'aperçu de la note s'affiche légèrement à gauche du doigt, pour ne pas être caché. La note est posée là où se trouve l'aperçu.
2. **Pas d'autocorrection rythmique pendant l'écriture**
   - La largeur d'une mesure ne s'adapte plus à son contenu.
   - Plus de silences de remplissage.
   - Rien de ce qui est écrit n'est jamais modifié automatiquement.
3. **« Vérifier le rythme »** : un bouton à bascule.
   - Allumé : chaque mesure incomplète ou trop pleine passe en rouge, en direct. Elle redevient normale dès qu'elle est juste.
   - Éteint : rien n'est rouge.
   - Le bouton ne modifie jamais ce qui est écrit : c'est Paul qui corrige.
4. **Armure** : 0 à 4 ♯ ou ♭, affichée au début de chaque ligne.
5. **Barres de mesure déplaçables**
   - Les 3 barres intermédiaires de chaque ligne se déplacent par glisser-déposer. La première et la dernière barre restent fixes.
   - La largeur choisie vaut pour toutes les portées de la ligne et elle est sauvegardée.
   - Par défaut, les 4 mesures ont la même largeur.
6. **Insérer une ligne** : un ＋ en haut de la page, un entre chaque ligne et un en bas.

## 3. Choix du constructeur (présentés à Paul et acceptés)
- **Mesures neutres** : une mesure vide, ou qui contient encore des points, n'est jamais rouge. La mesure vide garde sa pause centrée.
- **Armure et hauteurs**
  - L'armure s'entend : `Pitch.alter` reste l'altération réelle (absolue).
  - Un point posé prend l'altération de l'armure.
  - Le bouton ♮ (touche N) force le naturel. ♯ et ♭ basculent : appuyer à nouveau ramène à l'armure.
  - Une altération n'est dessinée que si elle diffère de l'armure, ou d'une altération précédente de la même note dans la mesure.
  - Monter ou descendre une note, ou la glisser à une autre hauteur, garde l'armure : une note qui suivait l'armure la suit encore. Une note altérée hors armure garde son altération en transposant, mais la reprend de l'armure si on la glisse.
- **Changer d'armure** : les notes qui suivaient l'ancienne armure suivent la nouvelle. Les autres gardent leur son.
- **Taille des mesures**
  - Une mesure ne peut pas être plus étroite qu'environ 40 unités.
  - Les largeurs sont des fractions de la ligne (`Score.lineWidths`). Elles suivent les insertions et suppressions de ligne.
  - Pendant le glisser, un trait guide suit le doigt ; la page se redessine au relâcher.
- **Décalage de l'aperçu** : environ 44 px écran à gauche du doigt. La hauteur reste celle du doigt.
- **État de la vérification** : l'état de « Vérifier le rythme » n'est pas sauvegardé. Le bouton est éteint à l'ouverture.

## 4. Modèle
- `Score.keySignature?: number` : de −4 à 4, positif pour les dièses.
- `Score.lineWidths?: (number[] | null)[]` : 4 fractions par ligne, de somme 1. `null`, ou une valeur absente, donne des largeurs égales.
- Annuler et rétablir couvrent aussi l'armure, les largeurs et l'insertion de lignes.

## 5. Non-objectifs
Pas de correction rythmique automatique sous aucune forme, pas d'armure au-delà de 4 altérations, pas de changement d'armure en cours de partition, pas de largeur de mesure propre à une seule portée.
