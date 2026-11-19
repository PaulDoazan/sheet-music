# Sheet Music

Apprendre à lire la musique, puis (bientôt) écrire, écouter et exporter des partitions.

**Brique 1 — Lecture de notes** : clé de Sol, de Fa ou les deux, 5 niveaux, 2 minutes pour nommer un maximum de notes (+1 juste, −1 fausse, score jamais négatif). Pensé d'abord pour mobile en paysage.

▶ **Jouer** : https://pauldoazan.github.io/sheet-music/

## Stack

- Vue 3 + TypeScript + Vuetify 3 (Vite)
- [VexFlow](https://www.vexflow.com/) pour le rendu des portées
- Prévu brique 2 : Tone.js (lecture, BPM), @tonejs/midi (export), multi-portées pour arrangements vocaux ; TanStack Query avec le futur backend Go

## Développement

```bash
npm install
npm run dev        # http://localhost:5173/sheet-music/ (exposé sur le réseau local pour tester sur mobile)
npm test           # vitest
npm run build      # typecheck + build dans dist/
```

Clavier sur desktop : `C D E F G A B` ou `1`–`7`.

## Organisation

```
src/music/model        modèle de partition (Score/Staff/Voice/Note) — partagé avec l'éditeur à venir
src/music/render       StaffView : rendu VexFlow générique (couleurs, curseur, étiquettes)
src/features/reading   jeu de lecture : niveaux, générateur, état de partie, écrans
```

Design : [`docs/superpowers/specs/2026-11-19-lecture-notes-mvp-design.md`](docs/superpowers/specs/2026-11-19-lecture-notes-mvp-design.md)

## Déploiement

- GitHub Pages : automatique à chaque push sur `main` (`.github/workflows/pages.yml`).
- Autre hébergement (ex. Dokploy) : `VITE_BASE=/ npm run build`.
