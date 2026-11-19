import { computed, reactive } from 'vue'
import type { Clef, Pitch, Step } from '@/music/model'
import { generateNotes, type ExerciseNote, type Rng } from './generator'
import type { ClefMode, Level } from './levels'
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
  pageDone: boolean
}

let noteSeq = 0

/**
 * État d'une partie de lecture (state local, réactivité Vue — pas de lib de store).
 * Une instance par partie : GameView en crée une, les tests aussi.
 */
export function createReadingGame() {
  const state = reactive({
    clefMode: 'treble' as ClefMode,
    level: 1 as Level,
    phase: 'idle' as Phase,
    pageSize: 8,
    page: [] as PageNote[],
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

  const currentNote = computed<PageNote | undefined>(() => state.page[state.cursor])
  const accuracy = computed(() => {
    const n = state.correct + state.wrong
    return n ? Math.round((100 * state.correct) / n) : 0
  })
  /** Objectif de la jauge : le record (clé, niveau), 30 par défaut. */
  const target = computed(() => Math.max(state.bestBefore, 30))

  function fillPage() {
    const notes = generateNotes(
      { clefMode: state.clefMode, level: state.level, count: state.pageSize, previous: history.slice(-4) },
      rng,
    )
    history = [...history.slice(-4), ...notes]
    state.page = notes.map((n) => ({ ...n, id: `n${++noteSeq}`, status: 'pending' as NoteStatus }))
    state.cursor = 0
  }

  function setup(clefMode: ClefMode, level: Level, pageSize: number, random: Rng = Math.random) {
    Object.assign(state, {
      clefMode,
      level,
      pageSize,
      phase: 'idle',
      correct: 0,
      wrong: 0,
      score: 0,
      endsAt: 0,
      remainingMs: GAME_DURATION_MS,
      newRecord: false,
      bestBefore: getBestScore(clefMode, level),
    })
    history = []
    rng = random
    fillPage()
  }

  /** Change la taille de page (rotation) : régénère la page si rien n'y a encore été joué. */
  function resizePage(pageSize: number) {
    if (pageSize === state.pageSize) return
    state.pageSize = pageSize
    if (state.cursor === 0) {
      history = history.slice(0, -state.page.length)
      fillPage()
    }
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
    state.newRecord = saveBestScore(state.clefMode, state.level, state.score)
  }

  function tick(now = Date.now()) {
    if (state.phase !== 'playing') return
    state.remainingMs = Math.max(0, state.endsAt - now)
    if (state.remainingMs === 0) finish()
  }

  function answer(step: Step): AnswerResult | null {
    if (state.phase !== 'playing') return null
    const note = state.page[state.cursor]
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
    return { ok, note, index, pageDone: state.cursor >= state.page.length }
  }

  return { state, currentNote, accuracy, target, setup, fillPage, resizePage, start, tick, answer, finish }
}

export type ReadingGame = ReturnType<typeof createReadingGame>
