import { beforeEach, describe, expect, it } from 'vitest'
import { LOOKAHEAD, createReadingGame } from './game'
import { seededRng } from './generator'
import { STEPS, type Step } from '@/music/model'
import { DEFAULT_SETTINGS, type ClefMode, type ReadingSettings } from './settings'

function settingsFor(clefMode: ClefMode, maxLeap = 2): ReadingSettings {
  return { ...DEFAULT_SETTINGS, clefMode, maxLeap }
}

function wrongStep(s: Step): Step {
  return STEPS[(STEPS.indexOf(s) + 1) % 7]
}

describe('createReadingGame', () => {
  beforeEach(() => localStorage.clear())

  it('compte juste / faux, plancher à 0, avance le curseur', () => {
    const g = createReadingGame()
    g.setup(settingsFor('treble'), seededRng(1))
    expect(g.answer('C')).toBeNull() // pas encore démarré
    g.start(0)
    const r1 = g.answer(wrongStep(g.currentNote.value!.pitch.step))!
    expect(r1.ok).toBe(false)
    expect(g.state.score).toBe(0)
    expect(g.state.wrong).toBe(1)
    expect(g.state.notes[0].status).toBe('wrong')
    expect(g.state.cursor).toBe(1)
    g.answer(g.currentNote.value!.pitch.step)
    g.answer(g.currentNote.value!.pitch.step)
    expect(g.state.score).toBe(2)
    g.answer(wrongStep(g.currentNote.value!.pitch.step))
    expect(g.state.score).toBe(1)
    expect(g.accuracy.value).toBe(50)
  })

  it('garde toujours des notes d\'avance sur le ruban', () => {
    const g = createReadingGame()
    g.setup(settingsFor('both', 5), seededRng(2))
    g.start(0)
    expect(g.state.notes).toHaveLength(LOOKAHEAD)
    const firstIds = g.state.notes.map((n) => n.id)
    for (let i = 0; i < 50; i++) g.answer(g.currentNote.value!.pitch.step)
    expect(g.state.cursor).toBe(50)
    expect(g.state.notes.length - g.state.cursor).toBe(LOOKAHEAD)
    expect(g.state.notes.slice(0, LOOKAHEAD).map((n) => n.id)).toEqual(firstIds)
    expect(g.state.notes.slice(0, 50).every((n) => n.status === 'correct')).toBe(true)
    expect(new Set(g.state.notes.map((n) => n.id)).size).toBe(g.state.notes.length)
  })

  it('dure 1 min par défaut', () => {
    const g = createReadingGame()
    g.setup(settingsFor('treble'), seededRng(1))
    expect(g.durationMs.value).toBe(60_000)
    expect(g.state.remainingMs).toBe(60_000)
    g.start(0)
    g.tick(59_999)
    expect(g.state.phase).toBe('playing')
    g.tick(60_000)
    expect(g.state.phase).toBe('finished')
  })

  it('termine à la durée réglée et enregistre le record', () => {
    const g = createReadingGame()
    g.setup({ ...settingsFor('bass', 4), duration: 180 }, seededRng(3))
    g.start(1000)
    g.answer(g.currentNote.value!.pitch.step)
    g.tick(1000 + 180_000 - 1)
    expect(g.state.phase).toBe('playing')
    g.tick(1000 + 180_000)
    expect(g.state.phase).toBe('finished')
    expect(g.state.newRecord).toBe(true)
    expect(g.answer('C')).toBeNull()

    g.setup({ ...settingsFor('bass', 4), duration: 180 }, seededRng(4))
    expect(g.state.bestBefore).toBe(1)
    // record propre à la durée
    g.setup({ ...settingsFor('bass', 4), duration: 60 }, seededRng(4))
    expect(g.state.bestBefore).toBe(0)
  })
})
