/**
 * Logique de l'éditeur v2, indépendante du rendu.
 * Mesures explicites ; on pose des points (hauteur sans rythme), puis on leur donne une durée.
 * La sélection est une liste d'ids de notes ; le premier est l'élément « principal ».
 */
import { computed, ref, type Ref } from 'vue'
import {
  diatonicIndex,
  fromDiatonicIndex,
  keyAlter,
  LINE_MEASURES,
  rekeyPitch,
  withKey,
  STEPS,
  type Alter,
  type Duration,
  type Note,
  type Pitch,
  type Score,
  type Staff,
  type Step,
} from '@/music/model'
import { uid } from './templates'

export interface Loc {
  staff: number
  measure: number
  index: number
  note: Note
}

/** Note de référence d'une portée vide : la ligne du milieu. */
export function centerIndex(staff: Staff): number {
  const base = staff.clef === 'bass' ? 3 * 7 + 1 /* D3 */ : 4 * 7 + 6 /* B4 */
  return base + (staff.clefOctave ?? 0) * 7
}

/** Octave la plus proche de la référence pour un degré donné. */
export function nearestIndex(step: Step, refIndex: number): number {
  const s = STEPS.indexOf(step)
  return Math.round((refIndex - s) / 7) * 7 + s
}

const HISTORY_MAX = 200

export function createScoreEditor(score: Ref<Score>) {
  const selectedIds = ref<string[]>([])
  const multi = ref(false)
  const duration = ref<Duration>('q')
  const dotted = ref(false)
  /** « Vérifier le rythme » : signale en rouge les mesures fausses, ne modifie rien. */
  const checkRhythm = ref(false)
  const undoStack: string[] = []
  const redoStack: string[] = []
  const historyVersion = ref(0)

  const measuresOf = (si: number): Note[][] => score.value.staves[si]?.voices[0]?.measures ?? []

  function locate(id: string): Loc | null {
    const staves = score.value.staves
    for (let s = 0; s < staves.length; s++) {
      const ms = measuresOf(s)
      for (let m = 0; m < ms.length; m++) {
        const index = ms[m].findIndex((n) => n.id === id)
        if (index >= 0) return { staff: s, measure: m, index, note: ms[m][index] }
      }
    }
    return null
  }
  const primary = computed<Loc | null>(() => (selectedIds.value[0] ? locate(selectedIds.value[0]) : null))
  const selectedNotes = () => selectedIds.value.map(locate).filter((l): l is Loc => !!l)

  // --- historique -----------------------------------------------------------------------
  const state = () =>
    JSON.stringify({
      staves: score.value.staves,
      measureCount: score.value.measureCount,
      timeSignature: score.value.timeSignature,
      keySignature: score.value.keySignature ?? 0,
      lineWidths: score.value.lineWidths ?? [],
      selectedIds: selectedIds.value,
    })
  function snapshot() {
    undoStack.push(state())
    if (undoStack.length > HISTORY_MAX) undoStack.shift()
    redoStack.length = 0
    historyVersion.value++
  }
  function restore(raw: string) {
    const s = JSON.parse(raw)
    score.value.staves = s.staves
    score.value.measureCount = s.measureCount
    score.value.timeSignature = s.timeSignature
    score.value.keySignature = s.keySignature
    score.value.lineWidths = s.lineWidths
    selectedIds.value = s.selectedIds
  }
  function undo() {
    const s = undoStack.pop()
    if (!s) return
    redoStack.push(state())
    restore(s)
    historyVersion.value++
  }
  function redo() {
    const s = redoStack.pop()
    if (!s) return
    undoStack.push(state())
    restore(s)
    historyVersion.value++
  }
  const canUndo = computed(() => (historyVersion.value, undoStack.length > 0))
  const canRedo = computed(() => (historyVersion.value, redoStack.length > 0))

  // --- parcours d'une portée ----------------------------------------------------------------
  function flat(staff: number): Loc[] {
    const out: Loc[] = []
    measuresOf(staff).forEach((m, measure) => m.forEach((note, index) => out.push({ staff, measure, index, note })))
    return out
  }
  function neighbour(loc: Loc, delta: number): Loc | null {
    const list = flat(loc.staff)
    const k = list.findIndex((l) => l.note.id === loc.note.id)
    return list[k + delta] ?? null
  }

  // --- sélection ----------------------------------------------------------------------------
  function selectOnly(id: string | null) {
    selectedIds.value = id ? [id] : []
    syncPalette()
  }
  function syncPalette() {
    const n = primary.value?.note
    if (!n || n.point) return
    duration.value = n.duration
    dotted.value = !!n.dots
  }
  function tapElement(id: string) {
    if (!multi.value) return selectOnly(id)
    const has = selectedIds.value.includes(id)
    selectedIds.value = has ? selectedIds.value.filter((x) => x !== id) : [...selectedIds.value, id]
  }
  function selectMeasure(staff: number, measure: number) {
    const ids = (measuresOf(staff)[measure] ?? []).map((n) => n.id)
    selectedIds.value = multi.value ? [...new Set([...selectedIds.value, ...ids])] : ids
  }
  function clearSelection() {
    selectedIds.value = []
  }

  // --- saisie -------------------------------------------------------------------------------
  const key = () => score.value.keySignature ?? 0
  /** Une hauteur venue du toucher ou du clavier (naturelle) prend l'altération de l'armure. */
  const keyed = (p: Pitch): Pitch => (p.alter == null ? withKey(p, key()) : { ...p })
  function newPoint(pitch: Pitch): Note {
    return { id: uid('n'), pitch: keyed(pitch), duration: 'q', point: true }
  }
  function placePoint(staff: number, measure: number, index: number, pitch: Pitch): Note {
    snapshot()
    const m = measuresOf(staff)[measure]
    const note = newPoint(pitch)
    m.splice(Math.max(0, Math.min(m.length, index)), 0, note)
    selectedIds.value = [note.id]
    return note
  }

  function insertPointAfterSelection(step: Step): Note {
    const p = primary.value
    let ref: number
    let at: { staff: number; measure: number; index: number }
    if (p) {
      at = { staff: p.staff, measure: p.measure, index: p.index + 1 }
      let back: Loc | null = p
      while (back && !back.note.pitch) back = neighbour(back, -1)
      ref = back?.note.pitch ? diatonicIndex(back.note.pitch) : centerIndex(score.value.staves[p.staff])
    } else {
      at = { staff: 0, measure: 0, index: 0 }
      ref = centerIndex(score.value.staves[0])
    }
    return placePoint(at.staff, at.measure, at.index, fromDiatonicIndex(nearestIndex(step, ref)))
  }

  function applyRhythm(fn: (n: Note) => void) {
    const sel = selectedNotes()
    if (!sel.length) return
    snapshot()
    sel.forEach((l) => fn(l.note))
    if (sel.length === 1) {
      const next = neighbour(sel[0], 1)
      if (next) selectedIds.value = [next.note.id]
      dotted.value = false // le point de durée ne vaut que pour une note
    }
  }
  const setNoteDuration = (n: Note) => {
    n.duration = duration.value
    if (dotted.value) n.dots = 1
    else delete n.dots
    delete n.point
  }
  function setDuration(d: Duration) {
    duration.value = d
    applyRhythm(setNoteDuration)
  }
  function toggleDot() {
    dotted.value = !dotted.value
    const sel = selectedNotes()
    if (!sel.length) return
    snapshot()
    sel.forEach((l) => setNoteDuration(l.note)) // le point modifie la note, sans avancer
  }
  function toRest() {
    applyRhythm((n) => {
      n.pitch = null
      if (n.point) {
        n.duration = 'q' // un point sans rythme devient un soupir
        delete n.dots
        delete n.point
      }
    })
  }

  function editPitches(fn: (p: Pitch) => Pitch) {
    const sel = selectedNotes().filter((l) => l.note.pitch)
    if (!sel.length) return
    snapshot()
    sel.forEach((l) => (l.note.pitch = fn(l.note.pitch!)))
  }
  const make = (step: Step, octave: number, alter: number): Pitch => (alter ? { step, octave, alter: alter as Alter } : { step, octave })
  /** Une note qui suit l'armure la suit encore ; une altération hors armure est conservée. */
  function transpose(degrees: number) {
    editPitches((p) => {
      const q = fromDiatonicIndex(diatonicIndex(p) + degrees)
      const followed = (p.alter ?? 0) === keyAlter(key(), p.step)
      return make(q.step, q.octave, followed ? keyAlter(key(), q.step) : (p.alter ?? 0))
    })
  }
  /** ♮ (0) force le naturel ; ♯/♭ basculent : si toute la sélection l'a déjà, retour à l'armure. */
  function setAlter(alter: Alter) {
    const sel = selectedNotes().filter((l) => l.note.pitch)
    const allSame = alter !== 0 && sel.every((l) => (l.note.pitch!.alter ?? 0) === alter)
    editPitches(({ step, octave }) => make(step, octave, allSame ? keyAlter(key(), step) : alter))
  }
  function setPitch(id: string, pitch: Pitch) {
    const l = locate(id)
    if (!l) return
    snapshot()
    const wasRest = !l.note.pitch
    l.note.pitch = withKey(pitch, key())
    if (wasRest) delete l.note.point
  }

  function removeSelected() {
    const sel = selectedNotes()
    if (!sel.length) return
    const p = primary.value!
    const prev = neighbour(p, -1)
    snapshot()
    const ids = new Set(sel.map((l) => l.note.id))
    score.value.staves.forEach((_, si) =>
      measuresOf(si).forEach((m) => {
        for (let k = m.length - 1; k >= 0; k--) if (ids.has(m[k].id)) m.splice(k, 1)
      }),
    )
    selectedIds.value = prev && !ids.has(prev.note.id) ? [prev.note.id] : []
  }

  // --- lignes / chiffrage --------------------------------------------------------------------
  const lineCount = () => Math.ceil((score.value.measureCount ?? 0) / LINE_MEASURES)
  /** Largeurs alignées sur le nombre de lignes (null = égales). */
  function widths(): (number[] | null)[] {
    const w = [...(score.value.lineWidths ?? [])]
    while (w.length < lineCount()) w.push(null)
    return w.slice(0, lineCount())
  }
  /** Insère 4 mesures vides à toutes les voix avant la ligne `at` (par défaut : à la fin). */
  function addLine(at?: number) {
    const lines = lineCount()
    const line = Math.max(0, Math.min(lines, at ?? lines))
    snapshot()
    const w = widths()
    score.value.staves.forEach((_, si) => {
      const empty = Array.from({ length: LINE_MEASURES }, () => [] as Note[])
      measuresOf(si).splice(line * LINE_MEASURES, 0, ...empty)
    })
    w.splice(line, 0, null)
    score.value.measureCount = (score.value.measureCount ?? 0) + LINE_MEASURES
    score.value.lineWidths = w
  }
  /** Largeurs des 4 mesures de la ligne (normalisées, somme 1). Ignore une saisie invalide. */
  function setLineWidths(line: number, fractions: number[]) {
    if (line < 0 || line >= lineCount() || fractions.length !== LINE_MEASURES) return
    if (fractions.some((f) => !Number.isFinite(f) || f < 0)) return
    const sum = fractions.reduce((a, b) => a + b, 0)
    if (!(sum > 0)) return
    snapshot()
    const w = widths()
    w[line] = fractions.map((f) => f / sum)
    score.value.lineWidths = w
  }
  function setKeySignature(k: number) {
    const to = Math.max(-4, Math.min(4, Math.round(k)))
    const from = key()
    if (to === from) return
    snapshot()
    score.value.staves.forEach((_, si) =>
      measuresOf(si).forEach((m) =>
        m.forEach((n) => {
          if (n.pitch) n.pitch = rekeyPitch(n.pitch, from, to)
        }),
      ),
    )
    score.value.keySignature = to
  }
  function removeLine(line: number) {
    const count = score.value.measureCount ?? 0
    if (count <= LINE_MEASURES) return
    snapshot()
    const w = widths()
    w.splice(line, 1)
    const removed = new Set<string>()
    score.value.staves.forEach((_, si) =>
      measuresOf(si)
        .splice(line * LINE_MEASURES, LINE_MEASURES)
        .forEach((m) => m.forEach((n) => removed.add(n.id))),
    )
    score.value.measureCount = count - LINE_MEASURES
    score.value.lineWidths = w
    selectedIds.value = selectedIds.value.filter((id) => !removed.has(id))
  }
  function setTimeSignature(ts: [number, number]) {
    snapshot()
    score.value.timeSignature = [ts[0], ts[1]]
  }

  // --- navigation ---------------------------------------------------------------------------
  function move(delta: number) {
    const p = primary.value
    if (!p) {
      const first = flat(0)[0]
      if (first) selectOnly(first.note.id)
      return
    }
    const n = neighbour(p, delta)
    if (n) selectOnly(n.note.id)
  }
  /** Élément de la portée voisine qui commence au même endroit (même mesure, même rang ou le dernier avant). */
  function moveStaff(delta: number) {
    const p = primary.value
    if (!p) return
    const target = p.staff + delta
    if (target < 0 || target >= score.value.staves.length) return
    const ms = measuresOf(target)
    for (let m = p.measure; m >= 0; m--) {
      const list = ms[m] ?? []
      if (!list.length) continue
      const idx = m === p.measure ? Math.min(p.index, list.length - 1) : list.length - 1
      return selectOnly(list[idx].id)
    }
    const first = flat(target)[0]
    if (first) selectOnly(first.note.id)
  }

  return {
    selectedIds,
    multi,
    duration,
    dotted,
    checkRhythm,
    primary,
    canUndo,
    canRedo,
    locate,
    placePoint,
    insertPointAfterSelection,
    tapElement,
    selectMeasure,
    clearSelection,
    setDuration,
    toggleDot,
    toRest,
    setAlter,
    transpose,
    setPitch,
    removeSelected,
    addLine,
    removeLine,
    setLineWidths,
    setKeySignature,
    setTimeSignature,
    move,
    moveStaff,
    undo,
    redo,
  }
}

export type ScoreEditor = ReturnType<typeof createScoreEditor>
