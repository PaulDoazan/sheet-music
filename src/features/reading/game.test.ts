import { beforeEach, describe, expect, it } from 'vitest'
import { GAME_DURATION_MS, createReadingGame } from './game'
import { seededRng } from './generator'
import { STEPS, type Step } from '@/music/model'

function wrongStep(s: Step): Step {
  return STEPS[(STEPS.indexOf(s) + 1) % 7]
}

describe('createReadingGame', () => {
  beforeEach(() => localStorage.clear())

  it('compte juste / faux, plancher à 0, avance le curseur', () => {
    const g = createReadingGame()
    g.setup('treble', 1, 8, seededRng(1))
    expect(g.answer('C')).toBeNull() // pas encore démarré
    g.start(0)
    const r1 = g.answer(wrongStep(g.currentNote.value!.pitch.step))!
    expect(r1.ok).toBe(false)
    expect(g.state.score).toBe(0)
    expect(g.state.wrong).toBe(1)
    expect(g.state.page[0].status).toBe('wrong')
    expect(g.state.cursor).toBe(1)
    g.answer(g.currentNote.value!.pitch.step)
    g.answer(g.currentNote.value!.pitch.step)
    expect(g.state.score).toBe(2)
    g.answer(wrongStep(g.currentNote.value!.pitch.step))
    expect(g.state.score).toBe(1)
    expect(g.accuracy.value).toBe(50)
  })

  it('signale la fin de page et en génère une nouvelle', () => {
    const g = createReadingGame()
    g.setup('both', 3, 4, seededRng(2))
    g.start(0)
    let r
    for (let i = 0; i < 4; i++) r = g.answer(g.currentNote.value!.pitch.step)
    expect(r!.pageDone).toBe(true)
    expect(g.answer('C')).toBeNull()
    const firstIds = g.state.page.map((n) => n.id)
    g.fillPage()
    expect(g.state.cursor).toBe(0)
    expect(g.state.page.map((n) => n.id)).not.toEqual(firstIds)
  })

  it('termine à 2 min et enregistre le record', () => {
    const g = createReadingGame()
    g.setup('bass', 2, 8, seededRng(3))
    g.start(1000)
    g.answer(g.currentNote.value!.pitch.step)
    g.tick(1000 + GAME_DURATION_MS - 1)
    expect(g.state.phase).toBe('playing')
    g.tick(1000 + GAME_DURATION_MS)
    expect(g.state.phase).toBe('finished')
    expect(g.state.newRecord).toBe(true)
    expect(g.answer('C')).toBeNull()

    g.setup('bass', 2, 8, seededRng(4))
    expect(g.state.bestBefore).toBe(1)
  })
})
