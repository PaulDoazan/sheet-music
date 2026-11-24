# Tessiture réglable, menu principal, export/import, prod Cloudflare — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** remplacer les niveaux 1–5 de la lecture par un réglage tessiture + saut max, ajouter un accueil Lecture/Écriture, un export/import des données, et préparer la mise en prod sur Cloudflare Pages.

**Architecture:** un module pur `settings.ts` porte le modèle `ReadingSettings`, la (dé)sérialisation URL/stockage et la clé de record ; le générateur et la partie le consomment. La logique de pose de `PageView` est extraite en fonctions pures réutilisées par une nouvelle mini-portée `PitchPickerStaff`. L'export/import est un module pur sur `localStorage`, exposé par une modale Réglages de l'accueil.

**Tech Stack:** Vue 3 + TypeScript + Vuetify 3, VexFlow 4 (`vexflow/bravura`), vue-router (hash), TanStack Query, Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-24-tessiture-menu-prod-design.md`

## Global Constraints
- Uniquement des notes naturelles (pas d'altération) dans la tessiture.
- Plage autorisée par clé = `MIN_STEP`…`MAX_STEP` de `src/music/render/pitchFromY.ts` (clé non octaviée) : Sol `C3–A6`, Fa `E1–C5`.
- Défauts : Sol `E4–F5`, Fa `G2–A3`, saut `2` (tierce).
- Saut max : `1…7` degrés ou `Infinity` ; libellés `2de · 3ce · 4te · 5te · 6te · 7e · Octave · Libre`.
- Garde-fou : grave ≤ aiguë − 1 degré ; la note déplacée bute, l'autre ne bouge jamais.
- Clés de stockage : derniers réglages `sheet-music:last-settings` ; records `sheet-music:records-v2` (l'ancienne `sheet-music:best-scores` n'est plus lue).
- URL de partie : `clef`, `tl`, `th`, `bl`, `bh`, `leap` (`leap=free` = libre), seules les clés jouées.
- Textes en français, solfège français (`SOLFEGE` + octave, ex. `Mi4`).
- Tout doit tenir sans défilement en mobile paysage (`max-height: 500px`).
- Commits : un par tâche, messages au format existant (`feat(reading): …`, `docs: …`), terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus
1. **Ancien `localStorage`** (`last-settings` au format `{clef, level}`, JSON corrompu, stockage indisponible) → l'app démarre sur les défauts (en gardant `clef` s'il est valide), sans exception. Test : Task 1.
2. **URL forgée ou ancienne** (`?clef=treble&level=3`, `tl=Z9`, `tl=A6&th=C3` inversés, `leap=99`) → partie jouable avec réglages valides (paramètres invalides remplacés, tessiture inversée → derniers réglages/défauts). Test : Task 1.
3. **Tessiture de 2 notes avec saut 2de** → le générateur alterne sans boucle infinie ni répétition. Test : Task 2.
4. **Fichier d'import étranger ou partiellement invalide** (autre JSON, `app` absent, partition sans `id`) → message d'erreur, rien n'est écrit. Test : Task 6.
5. **Glisser au-delà de l'autre note / hors portée** → la note bute à un degré de l'autre ; hors zone (au-delà de `MIN_STEP-6`/`MAX_STEP+6`), annulation et valeur inchangée. Test : Task 3 (fonctions pures) et Task 4 (`clampPick`).

---

### Task 1: Modèle `ReadingSettings` (settings.ts)

**Files:**
- Create: `src/features/reading/settings.ts`
- Test: `src/features/reading/settings.test.ts`

**Interfaces:**
- Produces :
  ```ts
  export type ClefMode = 'treble' | 'bass' | 'both'
  export const CLEF_MODES: { value: ClefMode; label: string }[]   // repris tel quel de levels.ts
  export function isClefMode(v: unknown): v is ClefMode
  export interface PitchRange { low: string; high: string }        // 'E4'
  export interface ReadingSettings { clefMode: ClefMode; ranges: Record<Clef, PitchRange>; maxLeap: number }
  export const DEFAULT_SETTINGS: ReadingSettings
  export const ALLOWED: Record<Clef, PitchRange>                    // { treble: C3–A6, bass: E1–C5 }
  export const LEAP_OPTIONS: { value: number; label: string }[]     // 1..7 + Infinity, libellés ci-dessus
  export function playedClefs(mode: ClefMode): Clef[]
  export function isValidRange(clef: Clef, r: PitchRange): boolean  // naturelles, dans ALLOWED, low < high
  export function loadSettings(): ReadingSettings                   // localStorage, tolérant
  export function saveSettings(s: ReadingSettings): void
  export function settingsToQuery(s: ReadingSettings): Record<string, string>
  export function settingsFromQuery(q: LocationQuery, fallback: ReadingSettings): ReadingSettings
  export function recordKey(s: ReadingSettings): string             // 'treble|E4-F5|2', 'both|E4-F5|G2-A3|free'
  export function summary(s: ReadingSettings, short?: boolean): string
  ```

- [ ] **Step 1: Write the failing tests** (`settings.test.ts`, `localStorage.clear()` en `beforeEach`)
  - `loadSettings()` sans rien → `DEFAULT_SETTINGS`.
  - `localStorage['sheet-music:last-settings'] = '{"clef":"bass","level":3}'` → `{ ...DEFAULT_SETTINGS, clefMode: 'bass' }`.
  - JSON corrompu (`'{'`) → `DEFAULT_SETTINGS`.
  - `saveSettings(s)` puis `loadSettings()` → égal à `s`, y compris `maxLeap: Infinity` (stocké comme `'free'`).
  - `settingsToQuery({clefMode:'treble', ranges:{treble:{low:'E4',high:'F5'}, bass:…}, maxLeap:2})` → `{ clef:'treble', tl:'E4', th:'F5', leap:'2' }` (pas de `bl/bh`).
  - `settingsFromQuery({clef:'both', tl:'A3', th:'C6', leap:'free'}, DEFAULT_SETTINGS)` → treble `A3–C6`, bass = fallback `G2–A3`, `maxLeap: Infinity`.
  - `settingsFromQuery({clef:'treble', level:'3'}, fb)` → `fb` avec `clefMode:'treble'`.
  - Invalides : `tl:'Z9'` → fallback ; `tl:'A6', th:'C3'` → fallback pour la clé ; `tl:'C2'` (hors ALLOWED) → fallback ; `tl:'F#4'` → fallback ; `leap:'99'` et `leap:'0'` → `fb.maxLeap`.
  - `recordKey` : `'treble|E4-F5|2'`, `'bass|G2-A3|7'`, `'both|E4-F5|G2-A3|free'`.
  - `summary(DEFAULT_SETTINGS avec clefMode 'both')` → `'Sol Mi4–Fa5 · Fa Sol2–La3 · sauts ≤ tierce'` ; `maxLeap: Infinity` → `'… · sauts libres'`.

- [ ] **Step 2: Run** `npx vitest run src/features/reading/settings.test.ts` → FAIL (module absent).
- [ ] **Step 3: Implement** `settings.ts` avec les signatures ci-dessus. Validation via `parsePitch` dans un `try`, refus si `alter`. Libellés de `summary` pour le saut : `seconde, tierce, quarte, quinte, sixte, septième, octave`.
- [ ] **Step 4: Run** la même commande → PASS.
- [ ] **Step 5: Commit** `feat(reading): modèle de réglages tessiture et saut max`

### Task 2: Générateur, partie et records sur `ReadingSettings`

**Files:**
- Modify: `src/features/reading/generator.ts`, `src/features/reading/game.ts`, `src/features/reading/bestScores.ts`
- Delete: `src/features/reading/levels.ts`
- Test: `src/features/reading/generator.test.ts`, `src/features/reading/game.test.ts`, `src/features/reading/bestScores.test.ts` (create)

**Interfaces:**
- Consumes : Task 1 (`ReadingSettings`, `playedClefs`, `recordKey`).
- Produces :
  ```ts
  generateNotes(opts: { settings: ReadingSettings; count: number; previous?: ExerciseNote[] }, rng?: Rng): ExerciseNote[]
  getBestScore(s: ReadingSettings): number
  saveBestScore(s: ReadingSettings, score: number): boolean        // clé 'sheet-music:records-v2'
  readRecords(): Record<string, number>; writeRecords(r: Record<string, number>): void  // pour Task 6
  createReadingGame().setup(settings: ReadingSettings, random?: Rng)  // state.settings remplace clefMode/level
  ```

- [ ] **Step 1: Adapt tests.** `generator.test.ts` : la boucle par niveau devient une table de 5 réglages équivalents aux anciens niveaux (copier les plages/sauts de `levels.ts`, niveau 5 → `Infinity`), mêmes assertions. Ajouter :
  - tessiture `E4–F4`, saut 1, 50 notes → toutes ∈ {E4, F4}, jamais deux identiques d'affilée ;
  - saut `Infinity` sur `C3–A6` → au moins un saut > 7 degrés sur 400 notes (seed fixe) ;
  - saut 7 sur tessiture `E4–G4` → reste dans la tessiture.
  `game.test.ts` : remplacer `setup('treble', 1, rng)` par `setup(settingsFor('treble'), rng)` (helper local). `bestScores.test.ts` : deux réglages différant seulement par le saut ont des records indépendants ; `saveBestScore` renvoie `true` puis `false` pour un score égal ; l'ancienne clé `sheet-music:best-scores` est ignorée.
- [ ] **Step 2: Run** `npx vitest run src/features/reading` → FAIL.
- [ ] **Step 3: Implement.** Le générateur lit `settings.ranges[clef]` et `settings.maxLeap` ; le reste de l'algorithme est inchangé. Supprimer `levels.ts` et tout import restant (`grep -rn "levels'" src` vide, sauf vues traitées en Task 4 — mettre à jour leurs imports `ClefMode/CLEF_MODES/isClefMode` vers `../settings` pour que le typecheck passe).
- [ ] **Step 4: Run** `npx vitest run src/features/reading` → PASS ; `npm run typecheck` → PASS (vues adaptées a minima : `GameView` construit les réglages via `settingsFromQuery(route.query, loadSettings())`, `MenuView` conserve ses niveaux en attendant Task 4 → si cela bloque le typecheck, faire le strict minimum dans MenuView : réglages par défaut + bouton Jouer).
- [ ] **Step 5: Commit** `feat(reading): générateur et records selon tessiture et saut`

### Task 3: Extraire la logique de pose de `PageView`

**Files:**
- Create: `src/music/render/placeGesture.ts`
- Modify: `src/music/render/PageView.vue` (fonctions `stepAt`, `updatePreview`, `previewView` : utiliser le module)
- Test: `src/music/render/placeGesture.test.ts`

**Interfaces:**
- Produces :
  ```ts
  export const CANCEL_MARGIN = 6
  /** Degré (demi-interlignes sous la ligne du haut) à l'ordonnée logique `ly`. */
  export function stepAtY(ly: number, staffTop: number): number
  /** Degré borné à [minStep, maxStep] et indicateur d'annulation (au-delà de ±CANCEL_MARGIN). */
  export function resolveStep(raw: number, minStep?: number, maxStep?: number): { step: number; cancelled: boolean }
  /** Degrés des lignes supplémentaires à tracer pour un degré donné. */
  export function ledgerSteps(step: number): number[]
  ```
  `minStep/maxStep` par défaut = `MIN_STEP/MAX_STEP` ; l'annulation se calcule toujours par rapport à `MIN_STEP/MAX_STEP`, le bornage par rapport aux bornes passées (le garde-fou de Task 4 passe des bornes plus serrées).

- [ ] **Step 1: Write the failing tests**
  - `stepAtY(top + 25, top)` → `5` ; `stepAtY(top - 7, top)` → `-1`.
  - `resolveStep(20)` → `{ step: 16, cancelled: false }` ; `resolveStep(23)` → `{ step: 16, cancelled: true }` ; `resolveStep(-15)` → cancelled.
  - `resolveStep(3, -8, 1)` → `{ step: 1, cancelled: false }`.
  - `ledgerSteps(4)` → `[]` ; `ledgerSteps(-5)` → `[-2, -4]` ; `ledgerSteps(13)` → `[10, 12]`.
- [ ] **Step 2: Run** `npx vitest run src/music/render/placeGesture.test.ts` → FAIL.
- [ ] **Step 3: Implement** et remplacer les calculs inline de `PageView` par ces fonctions (comportement identique).
- [ ] **Step 4: Run** `npm test` → PASS (tous les tests de l'éditeur inclus) ; `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `refactor(music): logique de pose partagée`

### Task 4: Mini-portée, modale « Notes travaillées », menu et partie

**Files:**
- Create: `src/music/render/PitchPickerStaff.vue`, `src/features/reading/components/RangeDialog.vue`, `src/features/reading/rangeEdit.ts`
- Modify: `src/features/reading/views/MenuView.vue`, `src/features/reading/views/GameView.vue`
- Test: `src/features/reading/rangeEdit.test.ts`

**Interfaces:**
- Consumes : Task 1, Task 3 (`stepAtY`, `resolveStep`, `ledgerSteps`), `pitchAtStep`/`stepOfPitch` de `pitchFromY.ts`.
- Produces :
  ```ts
  // rangeEdit.ts (pur)
  export type Bound = 'low' | 'high'
  /** Bornes de degré (stepOfPitch, clé non octaviée) autorisées pour `bound` vu l'autre note. */
  export function stepLimits(clef: Clef, range: PitchRange, bound: Bound): { minStep: number; maxStep: number }
  export function nudge(clef: Clef, range: PitchRange, bound: Bound, delta: 1 | -1): PitchRange   // inchangé si en butée
  export function canNudge(clef: Clef, range: PitchRange, bound: Bound, delta: 1 | -1): boolean
  ```
  ```vue
  <!-- PitchPickerStaff.vue -->
  props: { clef: Clef; pitch: Pitch; minStep: number; maxStep: number }
  emits: { 'update:pitch': [Pitch] }
  <!-- RangeDialog.vue -->
  props: { modelValue: boolean; settings: ReadingSettings }
  emits: { 'update:modelValue': [boolean]; apply: [ReadingSettings] }
  ```

- [ ] **Step 1: Write the failing tests** (`rangeEdit.test.ts`)
  - Sol `E4–F5`, `high` : `maxStep` = `stepOfPitch(A6)` (= `MIN_STEP`, -8) et `minStep` correspond à `F4` (un degré au-dessus de E4).
  - `nudge(treble, {low:'E4',high:'F4'}, 'low', 1)` → inchangé ; `canNudge(...)` → `false`.
  - `nudge(treble, {low:'C3',high:'F5'}, 'low', -1)` → inchangé (butée de plage).
  - `nudge(bass, {low:'G2',high:'A3'}, 'high', 1)` → `{ low:'G2', high:'B3' }`.
- [ ] **Step 2: Run** `npx vitest run src/features/reading/rangeEdit.test.ts` → FAIL.
- [ ] **Step 3: Implement `rangeEdit.ts`.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Implement `PitchPickerStaff.vue`.** Rendu VexFlow direct (`Renderer`, `Stave` avec clé, une `StaveNote` ronde centrée), géométrie logique fixe couvrant `MIN_STEP-1…MAX_STEP+1`, mise à l'échelle sur la hauteur du conteneur, couleur `ink` du thème (comme `StaffView`). Geste : `pointerdown` (capture) → aperçu (tête + lignes supplémentaires + étiquette `SOLFEGE`+octave, mêmes classes/visuel que `PageView`, « annulé » si annulé) au degré `resolveStep(stepAtY(...), minStep, maxStep)`, note centrée en x ; `pointermove` met à jour ; `pointerup` émet `update:pitch` si non annulé ; `pointercancel` efface. `touch-action: none` sur la portée.
- [ ] **Step 6: Implement `RangeDialog.vue`.** `v-dialog` (plein écran si `max-height: 500px`), copie de travail des réglages à l'ouverture. Pour chaque clé de `playedClefs(clefMode)` une ligne : libellé, puis pour `low` et `high` : `PitchPickerStaff` (bornes = `stepLimits`), colonne ▲▼ (`canNudge` → `disabled`), nom de note. En dessous, pastilles `LEAP_OPTIONS`. Boutons ✕ (annule) et **Valider** (`apply` + fermeture). Titre « Notes travaillées », colonnes « plus grave » / « plus aiguë ».
- [ ] **Step 7: Wire `MenuView.vue`.** Supprimer niveaux/`LEVEL_SPECS` ; état = `loadSettings()` surchargé par `settingsFromQuery(route.query, …)` ; `watch` → `saveSettings`. Ligne « Notes » : `summary(settings)` + bouton **Régler** ouvrant `RangeDialog`. Record = `getBestScore(settings)`. Jouer → `router.push({ name: 'play', query: settingsToQuery(settings) })`.
- [ ] **Step 8: Wire `GameView.vue`.** `settings = computed(() => settingsFromQuery(route.query, loadSettings()))` ; `extents` depuis `settings.ranges` ; `game.setup(settings.value)` ; en-tête : `{{ modeLabel }} · {{ summary(settings, true) }}` ; `quit()` → `{ name: 'read', query: settingsToQuery(settings) }` (route créée en Task 5 ; jusque-là `'menu'`) ; `watch(() => recordKey(settings.value), startGame)`.
- [ ] **Step 9: Verify** `npm test && npm run typecheck` → PASS. Puis `npm run dev` et, dans le navigateur en viewport 844×390 : ouvrir la modale en Sol + Fa (4 portées, pas de défilement), glisser une note au-delà de l'autre (bute), glisser loin hors portée (« annulé », valeur conservée), ▲▼ en butée désactivés, Valider → résumé et record mis à jour, Jouer → les notes respectent la tessiture.
- [ ] **Step 10: Commit** `feat(reading): réglage de la tessiture et du saut par mini-portées`

### Task 5: Accueil Lecture / Écriture

**Files:**
- Create: `src/features/home/HomeView.vue`
- Modify: `src/router.ts`, `src/features/reading/views/MenuView.vue`, `src/features/reading/views/GameView.vue`, `src/features/editor/views/ScoresView.vue`, `index.html`, `src/App.vue` (si `RotateHint` dépend du nom de route)
- Test: `src/router.test.ts`

**Interfaces:**
- Produces : routes `home` (`/`), `read` (`/read`), `play`, `scores`, `editor` ; le nom `menu` disparaît.

- [ ] **Step 1: Write the failing test** (`router.test.ts`) : `router.resolve('/').name === 'home'`, `router.resolve('/read').name === 'read'`, `router.resolve('/?clef=treble&level=3').name === 'home'`, `router.resolve('/nimporte').name` → redirection vers `home` (vérifier via `router.push` + `currentRoute`).
- [ ] **Step 2: Run** `npx vitest run src/router.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Routes ; `HomeView` : barre du haut (marque, emplacement réglages pour Task 6, plein écran, thème) + deux grandes cartes `router-link` **Lecture** (« Lis les notes ») → `read`, **Écriture** (« Écris, écoute, exporte ») → `scores`, chacune avec une petite `StaffView` d'illustration (réutiliser le motif `miniScore` de `MenuView`). `MenuView` : retirer le lien « Écrire », marque précédée de `mdiArrowLeft` en `router-link` vers `home` (même motif que `ScoresView`). `ScoresView` : lien vers `home`. `GameView.quit()` → `read`. `index.html` : `<title>Sheet Music — Lire et écrire la musique</title>` et description couvrant lecture + écriture.
- [ ] **Step 4: Run** `npm test && npm run typecheck` → PASS ; vérif navigateur : Accueil → Lecture → ← Accueil → Écriture → ← Accueil ; quitter une partie revient à `/read` avec les mêmes réglages.
- [ ] **Step 5: Commit** `feat(ui): accueil Lecture / Écriture`

### Task 6: Exporter / importer les données

**Files:**
- Create: `src/features/settings/dataTransfer.ts`, `src/features/settings/SettingsDialog.vue`
- Modify: `src/features/home/HomeView.vue` (roue `mdiCogOutline`)
- Test: `src/features/settings/dataTransfer.test.ts`

**Interfaces:**
- Consumes : `scoresApi` (`list/get/save`), `readRecords/writeRecords` (Task 2), `loadSettings/saveSettings` (Task 1).
- Produces :
  ```ts
  export interface ExportFile { app: 'sheet-music'; version: 1; exportedAt: string; scores: Score[]; records: Record<string, number>; settings: unknown; theme?: string }
  export async function buildExport(): Promise<ExportFile>
  export function parseImport(text: string): { ok: true; file: ExportFile } | { ok: false; error: string }
  export function importSummary(f: ExportFile): string                  // '3 partitions, 12 records'
  export async function applyImport(f: ExportFile): Promise<void>
  export function exportFileName(d: Date): string                       // 'sheet-music-2026-11-24.json'
  ```
  Note : l'export lit les partitions via `scoresApi` (et non une copie brute des clés) pour rester valable quand le stockage passera au backend ; les records et réglages via leurs modules. `updatedAt` des partitions importées est conservé : `applyImport` écrit l'objet tel quel (ajouter `scoresApi.put(score)` qui n'écrase pas `updatedAt`, ou un paramètre `{ keepUpdatedAt: true }` à `save`).

- [ ] **Step 1: Write the failing tests**
  - aller-retour : 2 partitions + records + réglages → `buildExport` → `JSON.stringify` → `localStorage.clear()` → `parseImport` → `applyImport` → `scoresApi.list()` a 2 entrées avec les mêmes `updatedAt`, records et réglages identiques.
  - fusion : une partition locale `id:a` (titre « Local ») et une `id:b` ; import contenant `id:a` (titre « Importé ») → `a` a le titre « Importé », `b` est toujours là.
  - records : local `{k:10, j:5}`, import `{k:7, m:3}` → `{k:10, j:5, m:3}`.
  - `parseImport('nope')`, `parseImport('{"foo":1}')`, `parseImport` avec `app:'autre'`, et avec une partition sans `id` → `ok:false` avec un message ; aucune écriture.
  - `importSummary` → `'2 partitions, 3 records'` (`'1 partition, 1 record'` au singulier).
  - `exportFileName(new Date('2026-11-24T10:00:00'))` → `'sheet-music-2026-11-24.json'`.
- [ ] **Step 2: Run** `npx vitest run src/features/settings` → FAIL.
- [ ] **Step 3: Implement `dataTransfer.ts`** (+ la variante d'écriture de `scoresApi`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Implement `SettingsDialog.vue`** et la roue dans `HomeView`. Export : `Blob` + `<a download>`. Import : `<input type="file" accept="application/json">`, erreur affichée dans la modale, sinon `window.confirm('Importer ' + importSummary(f) + ' ? Les partitions de même nom seront remplacées.')`, puis `applyImport` et `queryClient.invalidateQueries({ queryKey: scoreKeys.all })`, message « Import terminé ».
- [ ] **Step 6: Verify** `npm test && npm run typecheck` → PASS ; navigateur : exporter, supprimer une partition, importer → elle revient dans la liste sans recharger.
- [ ] **Step 7: Commit** `feat(settings): exporter et importer ses données`

### Task 7: Préparer la prod Cloudflare Pages

**Files:**
- Modify: `vite.config.ts`, `.github/workflows/pages.yml`, `README.md`
- Create: `.nvmrc`, `public/_headers`

- [ ] **Step 1:** `vite.config.ts` : `base: process.env.VITE_BASE ?? '/'` (mettre à jour le commentaire). `pages.yml` : ajouter `env: VITE_BASE: /sheet-music/` à l'étape `npm run build`. `.nvmrc` : `22`.
- [ ] **Step 2:** `public/_headers` :
  ```
  /assets/*
    Cache-Control: public, max-age=31536000, immutable
  /index.html
    Cache-Control: no-cache
  /
    Cache-Control: no-cache
  ```
- [ ] **Step 3: Verify** `npm test && npm run build` → PASS et `grep -c '"/assets/' dist/index.html` ≥ 1 (base `/`) ; `VITE_BASE=/sheet-music/ npm run build` → `dist/index.html` référence `/sheet-music/assets/`. `ls dist/_headers` présent. `npm run preview` → l'app s'ouvre sur `/`.
- [ ] **Step 4: README** : décrire les 4 parties de l'app à jour (plus de « 5 niveaux »), section **Déploiement** : Cloudflare Pages (prod) + GitHub Pages (transitoire), et procédure pas à pas : acheter le domaine (Cloudflare Registrar) → Workers & Pages → Create → Pages → Connect to Git → `PaulDoazan/sheet-music`, branche `main`, preset « None », build `npm test && npm run build`, output `dist`, variable `NODE_VERSION=22` (ou `.nvmrc`) → Custom domains : domaine nu + `www` → règle de redirection `www` → domaine nu (Rules → Redirect Rules) → migration des données : Exporter sur github.io, Importer sur le domaine.
- [ ] **Step 5: Commit** `ci: préparation du déploiement Cloudflare Pages`

### Task 8 (sur feu vert de Paul, après migration des données) : redirection GitHub Pages

À ne lancer que lorsque Paul a confirmé que le domaine est en ligne et que ses données sont importées. Le domaine est à demander à Paul.

**Files:** Modify `.github/workflows/pages.yml` ; Create `redirect/index.html`.

- [ ] **Step 1:** `redirect/index.html` : `<meta http-equiv="refresh">` + `location.replace('https://<domaine>/' + location.hash)`, lien visible de secours.
- [ ] **Step 2:** `pages.yml` : ne plus construire l'app, publier `redirect/` comme artefact (supprimer `npm ci/test/build`).
- [ ] **Step 3: Verify** après push : `https://pauldoazan.github.io/sheet-music/#/read` → `https://<domaine>/#/read`.
- [ ] **Step 4: Commit** `ci: GitHub Pages redirige vers le domaine`
