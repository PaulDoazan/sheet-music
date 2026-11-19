# Sheet Music — MVP « Lecture de notes » — Design

Date : 2026-11-19
Statut : validé par Paul (2026-11-19) — décisions restantes déléguées

## 1. Intention

Une web app pour apprendre à lire la musique, première brique d'un outil plus large d'écriture de partitions (arrangements vocaux à 4–5 voix, lecture MIDI, export MIDI, BPM réglable).

Le MVP est un entraîneur de lecture de notes chronométré, sur le principe des apps de solfège : une portée, un curseur qui avance de note en note, 7 boutons Do → Si, 2 minutes pour trouver un maximum de notes justes.

Les composants de rendu de portée et le modèle de données doivent être ceux que réutilisera la brique 2 (éditeur), pas un code jetable.

## 2. Objectifs / non-objectifs / anti-objectifs

**Objectifs (MVP)**
- Menu : choix de clé (Sol, Fa, Sol + Fa) et de niveau (1 à 5).
- Partie de 2 min : portée + curseur + 7 boutons + timeline en haut.
- Feedback : note juste → verte `#18a957`, note fausse → rouge ; le curseur passe à la note suivante dans les deux cas.
- Score = bonnes réponses − mauvaises réponses. Écran de fin avec le score.
- Charte graphique de big-or-small, mode clair/sombre dès le départ.
- Mobile paysage en priorité ; fonctionne aussi en portrait, tablette, desktop.
- Projet GitHub créé, tourne en local.

**Non-objectifs (MVP)**
- Altérations (dièses/bémols) : 7 boutons = notes naturelles uniquement.
- Son / lecture audio (Tone.js arrive en brique 2).
- Éditeur, multi-voix, export MIDI, BPM (brique 2).
- Backend Go, comptes utilisateurs, stockage serveur (plus tard).
- Déploiement Dokploy sur le VPS OVH (étape suivante, après validation locale).

**Anti-objectifs**
- Un rendu de portée « maison » non réutilisable par l'éditeur.
- Une UI qui demande de scroller en mobile paysage pendant une partie : portée, timeline et 7 boutons doivent tenir dans un écran ~ 844×390.
- Bloquer le portrait : on invite à tourner le téléphone, on ne force pas.

## 3. Contraintes

- Front : Vue 3 + TypeScript + Vuetify 3, build Vite.
- Rendu musical : VexFlow. Lecture/MIDI en brique 2 : Tone.js + @tonejs/midi.
- Backend futur en Go : le modèle de partition doit être sérialisable en JSON simple.
- Déploiement futur : Dokploy sur VPS OVH → l'app doit être une SPA statique buildable (Dockerfile ajouté à l'étape déploiement).

## 4. Approches considérées

| Approche | Avantages | Inconvénients |
|---|---|---|
| **A. VexFlow + Tone.js + @tonejs/midi + modèle TS maison** *(retenue)* | Contrôle fin (couleur par note, positions pour le curseur), grand système et multi-voix natifs, modèle JSON à nous partagé jeu/éditeur/backend | Interactions d'édition à construire en brique 2 |
| B. abcjs (notation ABC) | Rendu + lecture + MIDI + éditeur texte inclus | Le texte ABC devient le modèle ; éditeur visuel et contrôle curseur/couleurs pénibles |
| C. SVG maison pour le trainer | Minimal pour la brique 1 | À refaire entièrement pour la brique 2 |

Paul a choisi **A** : seule option où trainer et éditeur partagent exactement le même socle.

## 5. Décisions de Paul

- Clés : Sol / Fa / Sol + Fa. Niveaux 1 à 5, plus de dispersion et d'octaves en montant.
- Notes nommées Do Ré Mi Fa Sol La Si.
- Durée de partie : 2 minutes, timeline qui s'écoule en haut de l'écran.
- Mauvaise réponse : −1 au score, note marquée en rouge. Bonne réponse : +1, note en vert `#18a957`.
- Charte graphique = big-or-small, + mode clair/sombre.
- Mobile paysage prioritaire, portrait supporté avec invitation non bloquante à pivoter.
- Stack A (VexFlow / Tone.js / @tonejs/midi), Vue 3 + Vuetify + TS.

## 6. Design

### 6.1 Charte (reprise de big-or-small)

Tokens de `PaulDoazan/big-or-small/public/style.css` :

| Token | Clair | Sombre *(proposition)* |
|---|---|---|
| background (paper) | `#f6f1e7` | `#16151f` |
| surface (card) | `#fffdf8` | `#1f1d2c` |
| surface-variant (paper-2) | `#efe7d8` | `#2a2839` |
| on-background (ink) | `#1d1b2f` | `#f6f1e7` |
| ink-2 (texte secondaire) | `#5c5873` | `#a9a5bd` |
| line | `#e2d8c6` | `#3a374d` |
| primary (accent) | `#ff5a36` | `#ff6a48` |
| success (good) | `#18a957` | `#18a957` |
| error | `#c0392b` | `#ff5c5c` |

- Polices : Bricolage Grotesque (titres/texte), JetBrains Mono (chiffres : score, chrono).
- Fond papier avec trame de points (radial-gradient 18px).
- Boutons « big-or-small » : bordure 2px couleur encre, ombre portée pleine `0 3px 0` encre, enfoncement au clic, rayon 14px ; cartes rayon 18px, bordure 1.5px `line`.
- Logo : marque à deux barres (reprise du principe), déclinée « Sheet Music ».
- Implémentation : deux thèmes Vuetify (`light`, `dark`) portant ces couleurs + une feuille SCSS de surcharge pour le style des boutons/cartes. Le thème suit la préférence système par défaut, bascule manuelle dans la barre du haut, choix mémorisé en `localStorage`.
- La portée VexFlow lit ses couleurs (encre, vert, rouge, accent du curseur) depuis le thème actif et se redessine au changement de thème.

### 6.2 Modèle de données (partagé brique 1 / brique 2)

`src/music/model/` — types purs, sérialisables JSON, sans dépendance à VexFlow :

```ts
type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
interface Pitch { step: Step; octave: number; alter?: -1 | 0 | 1 }   // alter inutilisé en MVP
type Clef = 'treble' | 'bass'
type Duration = 'w' | 'h' | 'q' | '8' | '16'                        // MVP : 'q' uniquement
interface Note  { id: string; pitch: Pitch | null; duration: Duration } // null = silence
interface Voice { id: string; name?: string; notes: Note[] }
interface Staff { id: string; clef: Clef; voices: Voice[] }
interface Score { id: string; title?: string; bpm: number; timeSignature: [number, number]; staves: Staff[] }
```

Utilitaires : `pitchToMidi`, `midiToPitch`, `pitchToVexKey` (`'c/4'`), `stepToSolfege` (`C → Do`…), `diatonicIndex` (pour calculer les intervalles par degrés).

### 6.3 Rendu : `<StaffView>`

`src/music/render/StaffView.vue` — composant générique, réutilisé par l'éditeur :

- Props : `score: Score`, `noteStyles?: Record<noteId, 'default' | 'correct' | 'wrong'>`, `cursorNoteId?: string`, `width/height` responsive (observe la taille du conteneur).
- Rend en SVG via VexFlow : une portée par `Staff`, accolade + connecteur si plusieurs portées (grand système), clé en début de ligne. Pas de chiffrage ni barres de mesure en mode trainer (option `showTimeSignature`).
- Expose (event `layout`) la position x de chaque note rendue → le curseur est un élément superposé (barre verticale accent semi-transparente) animé en CSS `transform` d'une note à l'autre.
- En mode Sol + Fa : chaque note du jeu est placée sur une des deux portées ; l'autre portée affiche un silence invisible (ghost note) à la même position pour garder l'alignement vertical.

### 6.4 Générateur d'exercices

`src/features/reading/generator.ts` — fonction pure, testée, avec RNG injectable (seed) :

`generateNotes({ clefMode, level, count, previous? }): { clef: Clef; pitch: Pitch }[]`

Niveaux *(proposition, à ajuster en jouant)* :

| Niveau | Clé de Sol (tessiture) | Clé de Fa (tessiture) | Saut max entre 2 notes |
|---|---|---|---|
| 1 | Mi4 – Fa5 (dans la portée) | Sol2 – La3 (dans la portée) | tierce |
| 2 | Do4 – La5 (1 ligne add.) | Mi2 – Do4 | quinte |
| 3 | La3 – Do6 (2 lignes add.) | Do2 – Mi4 | sixte |
| 4 | Fa3 – Mi6 (3 lignes add.) | La1 – Sol4 | octave |
| 5 | Do3 – La6 | Mi1 – Do5 | illimité |

- Marche aléatoire : chaque note est tirée dans la tessiture, à distance ≤ saut max de la précédente, jamais deux fois la même note d'affilée.
- Mode Sol + Fa : clé tirée au hasard pour chaque note (avec ≤ 3 notes d'affilée sur la même clé) ; le saut max s'applique au sein d'une même clé, changement de clé = nouveau départ libre.

### 6.5 Déroulé de partie

État dans un store Pinia `useReadingGame` : `phase: 'ready' | 'playing' | 'finished'`, `page` (notes affichées), `cursor`, `results[]`, `correct`, `wrong`, `score`, `endsAt`.

1. **Menu** (`/`) : choix de clé (3 cartes illustrées d'une mini-portée) et de niveau (1–5, sélecteur segmenté), bouton « Jouer ». Meilleur score par (clé, niveau) affiché, stocké en `localStorage`.
2. **Partie** (`/play?clef=treble&level=3`) :
   - Compte à rebours 3-2-1 puis démarrage du chrono.
   - Timeline en haut (barre qui se vide, temps restant en mono ; passe en accent les 15 dernières secondes), score à droite, bouton quitter.
   - ~~Portée avec une « page » de notes~~ → remplacée par un ruban défilant (voir §8).
   - 7 boutons Do Ré Mi Fa Sol La Si sur une rangée. Clavier desktop : touches `C D E F G A B` (notation anglaise) et `1`–`7`.
   - Clic : la note prend la couleur verte ou rouge, score ±1, le curseur avance. Bouton pressé : flash vert/rouge bref.
   - Fin de page : nouvelle page générée (continuité de la marche aléatoire).
   - À 0:00 : les entrées sont bloquées, passage à l'écran de fin.
3. **Résultats** : score (grand, mono), bonnes / fausses, précision %, notes/min, nouveau record éventuel ; boutons « Rejouer » et « Menu ».

Score : jamais négatif (plancher à 0, décision de Paul). Une fausse réponse à 0 laisse le score à 0 mais compte dans les fausses.

**Correction affichée** : sur une fausse réponse, le nom correct (ex. « Sol ») s'affiche sous la note rouge, sans pause.

**Micro-animation (décision de Paul)** : à chaque réponse, une tête de note (verte ou rouge) part de la note sur la portée et vole vers la jauge de score en haut. À son arrivée, le score s'incrémente (vert) ou se décrémente (rouge) avec un petit rebond, et la jauge se remplit / se vide. La jauge représente le score rapporté à un objectif : le record pour (clé, niveau), ou 30 par défaut s'il n'y a pas de record.

### 6.6 Responsive & orientation

- Cible principale : mobile paysage (~ 844×390 et plus petit, ex. 667×375). En partie, layout en colonne plein écran : timeline (≈ 36px) / portée (flex) / boutons (≈ 64px), sans scroll. Topbar masquée en partie.
- Portrait : même layout, moins de notes par page, boutons sur une rangée (taille réduite). Bandeau fermable « Tourne ton téléphone pour plus de confort » détecté via `matchMedia('(orientation: portrait)')` sur appareils tactiles ; fermeture mémorisée pour la session.
- Tablette / desktop : contenu centré, largeur max ~ 1100px (comme big-or-small).
- `100dvh`, `viewport-fit=cover`, safe areas iOS. Cibles tactiles ≥ 44px.

### 6.7 Arborescence

```
src/
  main.ts, App.vue, router.ts
  plugins/vuetify.ts           # thèmes light/dark
  styles/                      # tokens + surcharges big-or-small
  components/                  # AppTopBar, ThemeToggle, RotateHint, BrandMark
  music/
    model/                     # types + utilitaires pitch (réutilisés brique 2)
    render/StaffView.vue       # wrapper VexFlow (réutilisé brique 2)
  features/reading/
    generator.ts, levels.ts, store.ts
    views/MenuView.vue, GameView.vue, ResultsView.vue
    components/NoteButtons.vue, TimelineBar.vue
```

Prévu pour la brique 2 (non implémenté) : `music/playback/` (Tone.js), `music/midi/` (@tonejs/midi), `features/editor/`.

### 6.8 Qualité

- Vitest : modèle (conversions pitch), générateur (tessitures et sauts respectés pour chaque niveau/clé, seedé), store (score, avance du curseur, fin de partie avec fausse horloge).
- ESLint + Prettier, `vue-tsc` en CI-ready (`npm run typecheck`).
- Vérification manuelle en local dans le navigateur, en émulation mobile paysage et portrait.

### 6.9 Dépôt & livraison

- Dépôt GitHub public `PaulDoazan/sheet-music` (décision de Paul). Travail sur `pauldoazan/read-music`, PR vers `main`, mergée pour publier le MVP.
- **GitHub Pages** : déploiement par GitHub Actions à chaque push sur `main` ; `base: '/sheet-music/'` dans Vite, router en mode hash (pas de réécriture d'URL sur Pages).
- Lancement local : `npm install && npm run dev`.
- Déploiement Dokploy : étape ultérieure (Dockerfile nginx statique, `base` configurable par variable d'env).
- Mise à l'échelle : en Sol + Fa aux niveaux 4–5, la portée se réduit pour tenir dans la hauteur disponible ; on ne réduit pas les tessitures.

## 7. Laissé au builder

- Valeurs exactes de la palette sombre (proposition ci-dessus, à ajuster à l'œil).
- Animation précise du curseur et des flashs de boutons.
- Choix de la version de VexFlow (dernière stable) et réglages de mise en page (espacement des notes, échelle selon la hauteur dispo).
- Visuel des cartes de choix de clé.

## 8. Évolution — portée défilante et plein écran (2026-11-19)

Demande de Paul : la portée défile de droite à gauche, à une vitesse qui s'adapte au rythme des réponses ; le curseur suit la prochaine note ; bouton plein écran.

- **Ruban** : les notes forment un flux continu (plus de « pages ») ; 24 notes générées d'avance. Clés et portées fixes, notes qui défilent dessous, fondu aux deux bords.
- **Vitesse** (`src/music/render/tapeScroller.ts`) : moyenne glissante des réponses/s × espacement, plus un terme de rattrapage quand la note courante est à droite de la cible (~22 % de la largeur). *Ma décision* : si le joueur ralentit ou s'arrête, le ruban freine en douceur et s'arrête avant la clé — aucune note n'est perdue ni comptée fausse.
- **Curseur** : accroché à la note courante, il se déplace avec elle.
- **Plein écran** : bouton dans la barre de jeu et le menu (Fullscreen API ; verrouillage paysage sur Android). Indisponible sur iPhone : manifeste web `display: fullscreen` pour l'ajout à l'écran d'accueil.
- `StaffView` (rendu statique) reste le composant de l'éditeur à venir ; `ScrollingStaff` est spécifique au mode lecture.
