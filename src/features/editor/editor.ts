/**
 * Logique de l'éditeur, indépendante du rendu : curseur d'insertion par portée, saisie, historique.
 * La « note sélectionnée » est celle juste avant le curseur (la dernière saisie, ou celle qu'on a tapée).
 */
import { computed, reactive, ref, type Ref } from 'vue'
import {
  diatonicIndex,
  fitDuration,
  fromDiatonicIndex,
  measureBeats,
  noteBeats,
  noteStarts,
  type Alter,
  type Duration,
  type Note,
  type Score,
  type Staff,
  type Step,
  STEPS,
} from '@/music/model'
import { uid } from './templates'

/** Note de référence pour la première saisie d'une portée : la ligne du milieu. */
export function centerIndex(staff: Staff): number {
  const base = staff.clef === 'bass' ? 3 * 7 + 1 /* D3 */ : 4 * 7 + 6 /* B4 */
  return base + (staff.clefOctave ?? 0) * 7
}

/** Octave la plus proche de la référence pour un degré donné. */
export function nearestIndex(step: Step, refIndex: number): number {
  const s = STEPS.indexOf(step)
  const oct = Math.round((refIndex - s) / 7)
  return oct * 7 + s
}

const HISTORY_MAX = 200

export function createScoreEditor(score: Ref<Score>) {
  const cursor = reactive({ staff: 0, index: 0 })
  const duration = ref<Duration>('q')
  const dotted = ref(false)
  /**
   * Vrai quand l'utilisateur a désigné une note (tap, flèches) : changer de durée la modifie.
   * Faux juste après une saisie : la durée choisie vaut pour la note suivante.
   */
  const editingSelected = ref(false)
  const undoStack: string[] = []
  const redoStack: string[] = []
  const historyVersion = ref(0) // rend canUndo/canRedo réactifs

  const notesOf = (si: number): Note[] => score.value.staves[si]?.voices[0]?.notes ?? []
  const currentNotes = computed(() => notesOf(cursor.staff))
  const selected = computed<Note | null>(() => currentNotes.value[cursor.index - 1] ?? null)
  const perMeasure = computed(() => measureBeats(score.value.timeSignature))

  function snapshot() {
    undoStack.push(JSON.stringify({ staves: score.value.staves, cursor: { ...cursor } }))
    if (undoStack.length > HISTORY_MAX) undoStack.shift()
    redoStack.length = 0
    historyVersion.value++
  }
  function restore(raw: string) {
    const s = JSON.parse(raw) as { staves: Staff[]; cursor: { staff: number; index: number } }
    score.value.staves = s.staves
    Object.assign(cursor, s.cursor)
  }
  function current() {
    return JSON.stringify({ staves: score.value.staves, cursor: { ...cursor } })
  }
  function undo() {
    const s = undoStack.pop()
    if (!s) return
    redoStack.push(current())
    restore(s)
    historyVersion.value++
  }
  function redo() {
    const s = redoStack.pop()
    if (!s) return
    undoStack.push(current())
    restore(s)
    historyVersion.value++
  }
  const canUndo = computed(() => (historyVersion.value, undoStack.length > 0))
  const canRedo = computed(() => (historyVersion.value, redoStack.length > 0))

  /** Place restante dans la mesure, à la position du curseur. */
  function roomAtCursor(): number {
    const notes = currentNotes.value
    const starts = noteStarts(notes)
    const t = cursor.index < notes.length ? starts[cursor.index] : starts.length ? starts[starts.length - 1] + noteBeats(notes[notes.length - 1]) : 0
    const pm = perMeasure.value
    const pos = t - Math.floor(t / pm + 1e-6) * pm
    return pm - pos
  }

  function insert(pitch: Note['pitch']) {
    const fit = fitDuration({ duration: duration.value, dots: dotted.value ? 1 : 0 }, roomAtCursor())
    if (!fit) return
    snapshot()
    const note: Note = { id: uid('n'), pitch, duration: fit.duration, ...(fit.dots ? { dots: 1 as const } : {}) }
    currentNotes.value.splice(cursor.index, 0, note)
    cursor.index++
    editingSelected.value = false
    return note
  }

  function refIndex(): number {
    const notes = currentNotes.value
    for (let i = cursor.index - 1; i >= 0; i--) {
      const p = notes[i].pitch
      if (p) return diatonicIndex(p)
    }
    return centerIndex(score.value.staves[cursor.staff])
  }

  function insertNote(step: Step) {
    const idx = nearestIndex(step, refIndex())
    return insert(fromDiatonicIndex(idx))
  }

  function insertRest() {
    return insert(null)
  }

  function removeSelected() {
    if (cursor.index === 0) return
    snapshot()
    currentNotes.value.splice(cursor.index - 1, 1)
    cursor.index--
  }

  /** Monte/descend la note sélectionnée de `degrees` degrés (7 = une octave). */
  function transposeSelected(degrees: number) {
    const n = selected.value
    if (!n?.pitch) return
    snapshot()
    const p = fromDiatonicIndex(diatonicIndex(n.pitch) + degrees)
    n.pitch = { ...p, ...(n.pitch.alter ? { alter: n.pitch.alter } : {}) }
  }

  function setAlter(alter: Alter) {
    const n = selected.value
    if (!n?.pitch) return
    snapshot()
    const next = (n.pitch.alter ?? 0) === alter ? 0 : alter
    const { step, octave } = n.pitch
    n.pitch = next ? { step, octave, alter: next } : { step, octave }
  }

  /** Change la durée courante ; l'applique aussi à la note sélectionnée si elle tient. */
  function setDuration(d: Duration) {
    duration.value = d
    applyDurationToSelected()
  }
  function toggleDot() {
    dotted.value = !dotted.value
    applyDurationToSelected()
  }
  function applyDurationToSelected() {
    const n = selected.value
    if (!n || !editingSelected.value) return
    const want = { duration: duration.value, dots: (dotted.value ? 1 : 0) as 0 | 1 }
    if (n.duration === want.duration && (n.dots ?? 0) === want.dots) return
    snapshot()
    n.duration = want.duration
    if (want.dots) n.dots = 1
    else delete n.dots
  }

  function selectAfter(staff: number, index: number) {
    cursor.staff = Math.max(0, Math.min(score.value.staves.length - 1, staff))
    cursor.index = Math.max(0, Math.min(notesOf(cursor.staff).length, index))
    editingSelected.value = cursor.index > 0
    syncPaletteFromSelected()
  }
  function syncPaletteFromSelected() {
    const n = selected.value
    if (!n) return
    duration.value = n.duration
    dotted.value = !!n.dots
  }
  function move(delta: number) {
    selectAfter(cursor.staff, cursor.index + delta)
  }
  /** Change de portée en gardant à peu près la même position temporelle. */
  function moveStaff(delta: number) {
    const from = noteStarts(currentNotes.value)
    const t = cursor.index > 0 ? from[cursor.index - 1] : -1
    const target = cursor.staff + delta
    if (target < 0 || target >= score.value.staves.length) return
    const starts = noteStarts(notesOf(target))
    let index = 0
    while (index < starts.length && starts[index] <= t + 1e-6) index++
    selectAfter(target, index)
  }

  return {
    cursor,
    editingSelected,
    duration,
    dotted,
    selected,
    perMeasure,
    canUndo,
    canRedo,
    insertNote,
    insertRest,
    removeSelected,
    transposeSelected,
    setAlter,
    setDuration,
    toggleDot,
    selectAfter,
    move,
    moveStaff,
    undo,
    redo,
  }
}

export type ScoreEditor = ReturnType<typeof createScoreEditor>
