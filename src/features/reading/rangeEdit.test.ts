import { describe, expect, it } from 'vitest'
import { canNudge, nudge, stepLimits } from './rangeEdit'

describe('stepLimits', () => {
  it('aiguë : de la limite de plage jusqu’à un degré au-dessus de la grave', () => {
    expect(stepLimits('treble', { low: 'E4', high: 'F5' }, 'high')).toEqual({ minStep: -8, maxStep: 7 })
  })
  it('grave : d’un degré sous l’aiguë jusqu’à la limite de plage', () => {
    expect(stepLimits('treble', { low: 'E4', high: 'F5' }, 'low')).toEqual({ minStep: 1, maxStep: 16 })
  })
})

describe('nudge / canNudge', () => {
  it('bute à un degré de l’autre note', () => {
    const r = { low: 'E4', high: 'F4' }
    expect(nudge('treble', r, 'low', 1)).toEqual(r)
    expect(canNudge('treble', r, 'low', 1)).toBe(false)
  })
  it('bute en limite de plage', () => {
    const r = { low: 'D3', high: 'F5' }
    expect(nudge('treble', r, 'low', -1)).toEqual(r)
    expect(canNudge('treble', r, 'low', -1)).toBe(false)
  })
  it('monte d’un degré', () => {
    expect(nudge('bass', { low: 'G2', high: 'A3' }, 'high', 1)).toEqual({ low: 'G2', high: 'B3' })
    expect(canNudge('bass', { low: 'G2', high: 'A3' }, 'high', 1)).toBe(true)
  })
})
