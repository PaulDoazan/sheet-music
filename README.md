# Sheet Music

Apprendre à lire la musique, puis écrire, écouter et exporter des partitions.

**Accueil** : deux entrées, Lecture et Écriture, plus un ⚙ Réglages pour exporter / importer toutes ses données (réglages, records, partitions).

**Brique 1 — Lecture de notes** : clé de Sol, de Fa ou les deux ; on règle la tessiture (étendue des notes jouées) et le saut maximal entre deux notes, puis 2 minutes pour nommer un maximum de notes (+1 juste, −1 fausse, score jamais négatif). Un record est gardé par combinaison de réglages. Pensé d'abord pour mobile en paysage.

**Brique 2 — Écriture** : partitions à 1–5 portées (chœur SATB, SSATB, mélodie, piano), présentées en lignes de 4 mesures (＋ pour en ajouter en haut, entre deux lignes ou en bas ; barres de mesure déplaçables au doigt). On pose la mélodie en touchant la portée (aperçu à gauche du doigt, glisser pour ajuster), puis on donne le rythme aux points (ronde → double croche, enchaînement automatique). Rien n'est corrigé automatiquement : « Vérifier le rythme » signale en rouge les mesures incomplètes ou trop pleines. Armure jusqu'à 4 ♯/♭, dièses/bémols/bécarres, sélection multiple, annuler/rétablir ; écoute à tempo réglable avec muet/solo par voix ; export MIDI. Sauvegarde automatique dans le navigateur.

▶ **Jouer / écrire** : https://<ton-domaine>/ (transitoire : https://pauldoazan.github.io/sheet-music/)

## Stack

- Vue 3 + TypeScript + Vuetify 3 (Vite)
- [VexFlow](https://www.vexflow.com/) pour le rendu des portées
- Tone.js (lecture), @tonejs/midi (export), chargés seulement dans l'éditeur
- TanStack Query (`@tanstack/vue-query`) pour les partitions — aujourd'hui sur localStorage, demain sur le backend Go

## Développement

```bash
npm install
npm run dev        # http://localhost:5173/ (exposé sur le réseau local pour tester sur mobile)
npm test           # vitest
npm run build      # typecheck + build dans dist/
```

Clavier sur desktop : `C D E F G A B` ou `1`–`7`.

Éditeur au clavier : `C`–`B` / `1`–`7` posent un point après la sélection, durées `W` ronde · `H` blanche · `Q` noire · `I` croche · `S` double, `.` point, `R` silence, `+`/`-`/`N` dièse/bémol/bécarre, `↑`/`↓` hauteur (`⇧` octave), `←`/`→` élément précédent/suivant, `Alt ↑/↓` voix, `⌫` supprimer, `Échap` désélectionner, `Ctrl Z` / `Ctrl ⇧ Z`, `Espace` écouter.

## Organisation

```
src/music/model        modèle de partition (Score/Staff/Voice/Note) et calculs de durées/mesures
src/music/render       rendu VexFlow : StaffView (statique), ScrollingStaff (jeu), PageView (éditeur)
src/music/audio        lecteur Tone.js
src/music/midi         export MIDI
src/features/reading   jeu de lecture : niveaux, générateur, état de partie, écrans
src/features/editor    éditeur : logique de saisie, modèles, stockage (scoresApi + vue-query), écrans
```

Design : [lecture](docs/superpowers/specs/2026-11-19-lecture-notes-mvp-design.md) · [écriture](docs/superpowers/specs/2026-11-19-editeur-partition-design.md) · [écriture v2](docs/superpowers/specs/2026-11-20-editeur-points-design.md)

## Déploiement

- **Production : Cloudflare Pages**, à la racine du domaine (`base: '/'`). Le fichier `public/_headers` règle le cache (assets immuables, `index.html` toujours revalidé).
- **Transitoire : GitHub Pages**, sous `/sheet-music/` (`.github/workflows/pages.yml`, qui build avec `VITE_BASE=/sheet-music/`), le temps de migrer les données.
- Autre base : `VITE_BASE=/mon-chemin/ npm run build`.

### Mise en place de Cloudflare Pages

1. Acheter le domaine (Cloudflare Registrar), appelé ici `<ton-domaine>`.
2. Dashboard Cloudflare → **Workers & Pages** → **Create** → onglet **Pages** → **Connect to Git** → autoriser GitHub et choisir `PaulDoazan/sheet-music`.
3. Branche de production `main`, preset de framework **None**, commande de build `npm test && npm run build`, dossier de sortie `dist`.
4. Variable d'environnement `NODE_VERSION=22` (le fichier `.nvmrc` la fournit aussi) → **Save and Deploy**.
5. Projet → **Custom domains** → **Set up a custom domain** : ajouter `<ton-domaine>` puis `www.<ton-domaine>`.
6. Rediriger `www` vers le domaine nu : **Rules** → **Redirect Rules** → règle « si le nom d'hôte est `www.<ton-domaine>`, rediriger (dynamique ou statique) vers `https://<ton-domaine>/`, code 301 ».
7. **Migrer les données** (le stockage est local à chaque origine) : sur `pauldoazan.github.io/sheet-music`, ⚙ sur l'accueil → **Exporter** ; sur `https://<ton-domaine>/`, ⚙ → **Importer**.
8. Plus tard, une fois les données migrées : remplacer le site GitHub Pages par une redirection vers le nouveau domaine.
