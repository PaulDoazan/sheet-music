import { computed, reactive } from 'vue'
import type { Clef, Pitch, Step } from '@/music/model'
import { generateNotes, type ExerciseNote, type Rng } from './generator'
import { DEFAULT_SETTINGS, type ReadingSettings } from './settings'
import { getBestScore, saveBestScore } from './bestScores'

export const GAME_DURATION_MS = 120_000

export type NoteStatus = 'pending' | 'correct' | 'wrong'
export interface PageNote {
  id: string
  clef: Clef
  pitch: Pitch
  status: NoteStatus
}
export type Phase = 'idle' | 'playing' | 'finished'

export interface AnswerResult {
  ok: boolean
  note: PageNote
  index: number
}

/** Nombre de notes générées d'avance devant le curseur (ruban défilant). */
export const LOOKAHEAD = 24

let noteSeq = 0

/**
 * État d'une partie de lecture (state local, réactivité Vue — pas de lib de store).
 * Une instance par partie : GameView en crée une, les tests aussi.
 */
export function createReadingGame() {
  const state = reactive({
    settings: structuredClone(DEFAULT_SETTINGS) as ReadingSettings,
    phase: 'idle' as Phase,
    /** Ruban de notes : celles déjà jouées restent (couleur), de nouvelles sont ajoutées au fil de l'eau. */
    notes: [] as PageNote[],
    cursor: 0,
    correct: 0,
    wrong: 0,
    score: 0,
    endsAt: 0,
    remainingMs: GAME_DURATION_MS,
    bestBefore: 0,
    newRecord: false,
  })
  let history: ExerciseNote[] = []
  let rng: Rng = Math.random

  const currentNote = computed<PageNote | undefined>(() => state.notes[state.cursor])
  const accuracy = computed(() => {
    const n = state.correct + state.wrong
    return n ? Math.round((100 * state.correct) / n) : 0
  })
  /** Objectif de la jauge : le record (selon les réglages), 30 par défaut. */
  const target = computed(() => Math.max(state.bestBefore, 30))

  function ensureAhead() {
    const missing = LOOKAHEAD - (state.notes.length - state.cursor)
    if (missing <= 0) return
    const fresh = generateNotes(
      { settings: state.settings, count: missing, previous: history.slice(-4) },
      rng,
    )
    history = [...history.slice(-4), ...fresh]
    state.notes.push(...fresh.map((n) => ({ ...n, id: `n${++noteSeq}`, status: 'pending' as NoteStatus })))
  }

  function setup(settings: ReadingSettings, random: Rng = Math.random) {
    Object.assign(state, {
      settings,
      notes: [],
      cursor: 0,
      phase: 'idle',
      correct: 0,
      wrong: 0,
      score: 0,
      endsAt: 0,
      remainingMs: GAME_DURATION_MS,
      newRecord: false,
      bestBefore: getBestScore(settings),
    })
    history = []
    rng = random
    ensureAhead()
  }

  function start(now = Date.now()) {
    state.phase = 'playing'
    state.endsAt = now + GAME_DURATION_MS
    state.remainingMs = GAME_DURATION_MS
  }

  function finish() {
    if (state.phase === 'finished') return
    state.phase = 'finished'
    state.remainingMs = 0
    state.newRecord = saveBestScore(state.settings, state.score)
  }

  function tick(now = Date.now()) {
    if (state.phase !== 'playing') return
    state.remainingMs = Math.max(0, state.endsAt - now)
    if (state.remainingMs === 0) finish()
  }

  function answer(step: Step): AnswerResult | null {
    if (state.phase !== 'playing') return null
    const note = state.notes[state.cursor]
    if (!note) return null
    const ok = note.pitch.step === step
    note.status = ok ? 'correct' : 'wrong'
    if (ok) {
      state.correct++
      state.score++
    } else {
      state.wrong++
      state.score = Math.max(0, state.score - 1)
    }
    const index = state.cursor
    state.cursor++
    ensureAhead()
    return { ok, note, index }
  }

  return { state, currentNote, accuracy, target, setup, start, tick, answer, finish }
}

export type ReadingGame = ReturnType<typeof createReadingGame>
