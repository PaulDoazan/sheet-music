# Sheet Music

Apprendre à lire la musique, puis écrire, écouter et exporter des partitions.

**Brique 1 — Lecture de notes** : clé de Sol, de Fa ou les deux, 5 niveaux, 2 minutes pour nommer un maximum de notes (+1 juste, −1 fausse, score jamais négatif). Pensé d'abord pour mobile en paysage.

**Brique 2 — Écriture** : partitions à 1–5 portées (chœur SATB, SSATB, mélodie, piano), saisie au doigt par durée + Do → Si, dièses/bémols, annuler/rétablir ; écoute à tempo réglable avec muet/solo par voix ; export MIDI (une piste par voix). Sauvegarde automatique dans le navigateur.

▶ **Jouer / écrire** : https://pauldoazan.github.io/sheet-music/

## Stack

- Vue 3 + TypeScript + Vuetify 3 (Vite)
- [VexFlow](https://www.vexflow.com/) pour le rendu des portées
- Tone.js (lecture), @tonejs/midi (export), chargés seulement dans l'éditeur
- TanStack Query (`@tanstack/vue-query`) pour les partitions — aujourd'hui sur localStorage, demain sur le backend Go

## Développement

```bash
npm install
npm run dev        # http://localhost:5173/sheet-music/ (exposé sur le réseau local pour tester sur mobile)
npm test           # vitest
npm run build      # typecheck + build dans dist/
```

Clavier sur desktop : `C D E F G A B` ou `1`–`7`.

Éditeur au clavier : notes `C`–`B` / `1`–`7`, silence `R`/`0`, durées `W` ronde · `H` blanche · `Q` noire · `I` croche · `S` double, `.` point, `+`/`-` dièse/bémol, `↑`/`↓` monter/descendre (`⇧` octave), `←`/`→` curseur, `Alt ↑/↓` changer de voix, `⌫` supprimer, `Ctrl Z` / `Ctrl ⇧ Z`, `Espace` écouter.

## Organisation

```
src/music/model        modèle de partition (Score/Staff/Voice/Note) et calculs de durées/mesures
src/music/render       rendu VexFlow : StaffView (statique), ScrollingStaff (jeu), ScoreView (éditeur)
src/music/audio        lecteur Tone.js
src/music/midi         export MIDI
src/features/reading   jeu de lecture : niveaux, générateur, état de partie, écrans
src/features/editor    éditeur : logique de saisie, modèles, stockage (scoresApi + vue-query), écrans
```

Design : [lecture](docs/superpowers/specs/2026-11-19-lecture-notes-mvp-design.md) · [écriture](docs/superpowers/specs/2026-11-19-editeur-partition-design.md)

## Déploiement

- GitHub Pages : automatique à chaque push sur `main` (`.github/workflows/pages.yml`).
- Autre hébergement (ex. Dokploy) : `VITE_BASE=/ npm run build`.
