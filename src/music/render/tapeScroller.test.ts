import { describe, expect, it } from 'vitest'
import { createTapeScroller } from './tapeScroller'

const OPTS = { spacing: 60, targetX: 120, minX: 30 }
const FPS = 60

function simulate(intervalMs: number | null, seconds: number) {
  const s = createTapeScroller(OPTS)
  let cursor = 0
  s.reset(0)
  s.start(0)
  const xs: number[] = []
  let nextAnswer = intervalMs ?? Infinity
  for (let f = 1; f <= seconds * FPS; f++) {
    const now = (f * 1000) / FPS
    if (now >= nextAnswer) {
      cursor++
      s.answered(now)
      nextAnswer += intervalMs!
    }
    s.step(1 / FPS, cursor)
    xs.push(s.xOf(cursor))
  }
  return { s, xs, cursor }
}

describe('tapeScroller', () => {
  it('démarre avec la note courante sur la cible', () => {
    const s = createTapeScroller(OPTS)
    s.reset(5)
    expect(s.xOf(5)).toBe(120)
  })

  it("s'arrête avant minX si le joueur ne répond pas", () => {
    const { xs } = simulate(null, 30)
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(30 - 1e-9)
    expect(xs[xs.length - 1]).toBeLessThan(40) // freine en douceur jusqu’à l’arrêt près de minX
  })

  it('suit un joueur rapide sans laisser la note filer à droite', () => {
    const { xs, s } = simulate(400, 20) // 2,5 notes/s
    const tail = xs.slice(-5 * FPS)
    expect(Math.max(...tail)).toBeLessThan(120 + 60 * 1.5)
    expect(Math.min(...tail)).toBeGreaterThanOrEqual(30)
    expect(s.rate).toBeGreaterThan(2)
  })

  it('va plus vite pour un joueur rapide que pour un lent', () => {
    const fast = simulate(400, 10)
    const slow = simulate(2000, 10)
    expect(fast.s.scroll).toBeGreaterThan(slow.s.scroll * 3)
  })
})
