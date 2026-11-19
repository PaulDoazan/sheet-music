import { describe, expect, it } from 'vitest'
import { fillerRests, fitDuration, measureBeats, noteBeats, splitMeasures } from './time'
import type { Note } from './types'

const n = (duration: Note['duration'], dots?: 1): Note => ({ id: Math.random().toString(), pitch: null, duration, dots })

describe('time', () => {
  it('mesure et durées', () => {
    expect(measureBeats([4, 4])).toBe(4)
    expect(measureBeats([6, 8])).toBe(3)
    expect(noteBeats(n('h', 1))).toBe(3)
  })
  it('raccourcit une note qui ne tient pas dans la mesure', () => {
    expect(fitDuration({ duration: 'w' }, 4)).toEqual({ duration: 'w', dots: 0 })
    expect(fitDuration({ duration: 'w' }, 3)).toEqual({ duration: 'h', dots: 1 })
    expect(fitDuration({ duration: 'q' }, 0.75)).toEqual({ duration: '8', dots: 1 })
    expect(fitDuration({ duration: 'q' }, 0)).toBeNull()
  })
  it('répartit par mesure', () => {
    const m = splitMeasures([n('h'), n('h'), n('q'), n('w')], 4)
    expect(m.map((x) => x.length)).toEqual([2, 2])
  })
  it('silences de remplissage', () => {
    expect(fillerRests(3).map((r) => r.duration)).toEqual(['h', 'q'])
    expect(fillerRests(0.75).map((r) => r.duration)).toEqual(['8', '16'])
  })
})
