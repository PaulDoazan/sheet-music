# Éditeur v2 « points puis rythme » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the v1 editor's input UX with a page of 4-measure lines. Pitches are placed as points by touching the staff; the rhythm is assigned afterwards.

**Architecture:**
- Measures become explicit (`Voice.measures`), and a point is a `Note` with `point: true` and a placeholder `'q'` duration.
- Pure model helpers (`measures.ts`) feed the editor logic (`editor.ts`, selection by note ids), playback and MIDI export.
- A new VexFlow view (`PageView.vue`) lays out stacked systems. It hit-tests pointer input into place, select and repitch events, and `EditorView` wires them to the editor.

**Tech Stack:** Vue 3.5, TypeScript 5.6, VexFlow 4 (`vexflow/bravura`), Tone.js, @tonejs/midi, @tanstack/vue-query, vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-editeur-points-design.md`

## Global Constraints

- Reading game (`src/features/reading`, `StaffView`, `ScrollingStaff`) unchanged; `Note.duration` stays required.
- Lines of exactly 4 measures; `measureCount` is always a multiple of 4. A new score has 4 measures.
- Points play and export as quarter notes.
- Overfull measures are never auto-fixed. A point disappears only when it is deleted.
- Changing the time signature keeps each measure's content as-is.
- Ledger range for placement: 4 ledger lines above and below each staff.
- Mobile landscape first (~844×390). Light and dark themes. All UI copy in French.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01PVXhenTo6PcVdCyrSCE2AQ`.
- Binaries: `./node_modules/.bin/vitest run`, `./node_modules/.bin/vue-tsc --noEmit`.

## Review Focus

1. A v1 score saved in localStorage (only `notes`) opens without loss → migrated into measures padded to a multiple of 4.
2. Deleting the last element of a measure, or removing a line while elements are selected → selection never points at a missing id.
3. Chaining durations across a measure boundary and past the last element → selection moves to the next element, or stays on the last one.
4. Time-signature change on a full score → content kept; fill states recomputed (over/under).
5. Undo after addLine/removeLine/setTimeSignature → measureCount, staves and timeSignature all restored together.

---

### Task 1: Measure model, migration and timeline

**Files:**
- Modify: `src/music/model/types.ts`, `src/music/model/index.ts`
- Create: `src/music/model/measures.ts`, `src/music/model/measures.test.ts`

**Interfaces — Produces:**
- `Note.point?: true`, `Voice.measures?: Note[][]`, `Score.measureCount?: number`
- `LINE_MEASURES = 4`
- `measureFill(m: Note[], perMeasure: number): { used: number; state: 'empty' | 'points' | 'full' | 'under' | 'over' }`. `'points'` wins whenever the measure contains a point.
- `migrateScore(s: Score): Score`. Fills `voices[0].measures` from `notes` via `splitMeasures` when `measures` is absent; empties `notes`; pads every voice to the shared `measureCount`, rounded up to a multiple of 4 with a minimum of 4. Idempotent.
- `timeline(s: Score): { staff: number; note: Note; start: number }[]`. Start = `measureIndex * measureBeats + offset in measure`.

- [ ] Tests:
  - `measureFill` returns each of the 5 states.
  - `migrateScore` turns a v1 score with 6 quarter notes into 4 measures `[4 notes, 2 notes, [], []]`, and running it twice gives the same result.
  - `timeline` puts an overfull measure's 5th quarter at start 4, and the first element of measure 2 at start 4.
- [ ] Implement, run tests, commit `feat(music): mesures explicites et points`.

### Task 2: Editor logic (selection by ids)

**Files:** rewrite `src/features/editor/editor.ts` and `editor.test.ts`; modify `templates.ts` (`createScore` sets `measureCount: 4`, `measures: [[],[],[],[]]`, `notes: []`).

**Interfaces — Consumes:** Task 1.
**Interfaces — Produces:** `createScoreEditor(score: Ref<Score>)` returns:
- state: `selectedIds: Ref<string[]>`, `multi: Ref<boolean>`, `duration: Ref<Duration>`, `dotted: Ref<boolean>`, `canUndo`, `canRedo`, `primary: ComputedRef<Loc | null>`
  - `type Loc = { staff: number; measure: number; index: number; note: Note }`
- `locate(id): Loc | null`
- `placePoint(staff, measure, index, pitch: Pitch): Note` (point, selected alone)
- `insertPointAfterSelection(step: Step)` (nearest octave, like v1 `nearestIndex`/`centerIndex`, kept exported)
- `tapElement(id)` (multi ? toggle : select alone; syncs palette), `selectMeasure(staff, measure)`, `clearSelection()`
- `setDuration(d)`, `toggleDot()`. Both apply to the selection, drop `point`, and chain to the next element of the staff when exactly one element is selected. `setDuration` also sets the palette even with an empty selection.
- `toRest()`, `setAlter(a)`, `transpose(deg)`, `setPitch(id, pitch)`, `removeSelected()` (then selects the previous element of the primary's staff, else none)
- `addLine()`, `removeLine(line: number)`, `setTimeSignature(ts)`
- `move(±1)` (prev/next element in the staff, across measures), `moveStaff(±1)` (element at the same start beat or just before it, in the adjacent staff)
- `undo()`, `redo()`. Snapshot = `{staves, measureCount, timeSignature, selectedIds}`.

- [ ] Tests:
  - placing gives a point, selected alone.
  - chain: 3 points, select the first, `setDuration('h')` ×3 → all halves, none are points; the 2nd is in measure 0 and the 3rd is in measure 1, and the selection goes 1st → 2nd → 3rd and stays on the 3rd.
  - multi + `setDuration('8')` applies to all selected elements with no chaining.
  - `toRest` turns a point into a rest; `removeSelected` selects the previous element.
  - `addLine` → 8 measures in every staff; `removeLine(1)` → 4; `undo` → 8.
  - `setTimeSignature([3,4])` keeps the content.
  - `insertPointAfterSelection('C')` after B4 → C5.
  - `transpose(7)` adds one octave.
- [ ] Implement, run tests, commit `feat(editor): logique points + rythme`.

### Task 3: Playback & export on measures

**Files:**
- Modify: `src/music/audio/player.ts`, `src/music/midi/exportMidi.ts`, `exportMidi.test.ts`

**Interfaces — Consumes:** `timeline`, `migrateScore`.

- [ ] Both iterate `timeline(migrateScore(score))`. Points use their placeholder `'q'`. The end of playback = max(start + beats).
- [ ] Update the MIDI test to a measures-based score with a point (quarter length) and a note in measure 2 (`ticks = perMeasure * ppq`). Run, commit `feat(music): écoute et export à partir des mesures`.

### Task 4: PageView renderer + interaction

**Files:**
- Create: `src/music/render/PageView.vue`, `src/music/render/pitchFromY.ts`, `pitchFromY.test.ts`
- Delete: `src/music/render/ScoreView.vue`

**Interfaces — Produces:**
- `pitchAtStep(clef, clefOctave, stepsBelowTopLine: number): Pitch`. Top line is F5 for treble and A3 for bass, shifted by `clefOctave*7`. Each step is half a line spacing. The result is clamped to [top+8, top−16] diatonic.
- `PageView` props: `score`, `selectedIds: string[]`, `playingIds: string[]`, `mutedStaves: boolean[]`, `multi: boolean`
- `PageView` emits:
  - `place(staff, measure, index, pitch)`
  - `tapElement(id)`
  - `repitch(id, pitch)` (vertical drag of a selected note)
  - `tapMeasure(staff, measure)` (empty area in multi mode)
  - `addLine()`, `removeLine(line)`
- `PageView` exposes `ensureVisible(id)`.

- [ ] Tests for `pitchAtStep`:
  - `('treble', 0, 0)` → F5
  - `('treble', 0, 8)` → E4
  - `('bass', 0, 4)` → D3
  - `('treble', -1, 8)` → E3
  - `('treble', 0, -20)` clamps to top+8 = E6
- [ ] Layout:
  - One system per 4 measures, stacked vertically; the page scrolls vertically.
  - Scale = clamp(viewW/720, 0.6, 1.4).
  - Staff gap = 8 line spacings, since the ledger room must fit.
  - The first measure of each line gets the clef; the first line also gets the time signature.
  - Measure widths: proportional to `max(preCalculateMinTotalWidth, 60)` and filling the line width.
  - Connectors as in v1: bracket for choir, brace and a through barline for piano.
  - Staff names as small pills left of each line, as v1 `shortName`.
- [ ] Elements:
  - Points are `StaveNote` with duration `'q'` and the stem hidden (`getStem()?.setVisibility(false)`).
  - Filler rests appear only when the state is `'under'`.
  - A whole rest is centred in `'empty'` measures.
  - Overfull measures get a DOM overlay tinted with `rgba(var(--v-theme-error),0.12)`.
  - Classes: `is-selected` (accent) and `is-playing` (good), as in v1.
  - Ledger line style uses the ink colour.
- [ ] Pointer handling:
  - On pointerdown, hit-test the nearest staff within its system band and the measure by x.
  - An element within 14 logical units: tap → `tapElement`. If it is already selected and the pointer moves more than 6px vertically → repitch preview, then `repitch` on up.
  - Empty area: in multi mode → `tapMeasure`; otherwise show the preview (head + ledger stubs + label `SOLFEGE[step]+octave`, with ♯ absent), follow the pointer, and on up emit `place` with index = elements with x < pointer x.
  - Leaving the staff band (more than 6 steps beyond the range) cancels.
  - Use `setPointerCapture`; `touch-action: pan-y` only outside an active gesture.
- [ ] A ＋ button below the last line ("Ajouter 4 mesures"). An × on each line when there is more than one line; confirm via `window.confirm` if the line has content.
- [ ] Typecheck, commit `feat(editor): page de lignes de 4 mesures et pose au doigt`.

### Task 5: EditorView wiring

**Files:** modify `src/features/editor/views/EditorView.vue` and `components/EditorToolbar.vue`.

- [ ] Load: `score.value = migrateScore(clone(d))`.
- [ ] Remove `NoteButtons`.
- [ ] Toolbar: durations, dot, rest (`toRest`), ♯, ♭, ↑, ↓, delete, undo, redo, and a multi-select toggle (`mdiSelectMultiple`, label « Sélection multiple »). Buttons that act on the selection are disabled when it is empty.
- [ ] Play from the measure of `primary`, else from 0.
- [ ] ⏮ clears the selection and scrolls to the top.
- [ ] Time-signature buttons call `setTimeSignature`.
- [ ] `ensureVisible` on the primary after chaining.
- [ ] Keyboard per spec §5.7: C–B/1–7 → `insertPointAfterSelection`.
- [ ] Empty-state hint: « Touche la portée pour poser une note, puis choisis son rythme. »
- [ ] Playwright check (844×390 light, 390×844, dark):
  - place 4 points;
  - chain durations;
  - overfull red;
  - ＋ adds a line;
  - × removes it;
  - a v1 localStorage score migrates.
- [ ] Commit `feat(editor): écran éditeur v2`.

### Task 6: Ship

- [ ] Update the README editor paragraph and shortcuts.
- [ ] Full tests + build, push the branch, open a PR, merge, wait for the Pages run, smoke-test the live site.
