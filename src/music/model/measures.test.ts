import { describe, expect, it } from 'vitest'
import { LINE_MEASURES, measureFill, migrateScore, timeline } from './measures'
import type { Note, Score } from './types'

let k = 0
const q = (over: Partial<Note> = {}): Note => ({ id: `n${k++}`, pitch: { step: 'C', octave: 5 }, duration: 'q', ...over })
const base = (): Score => ({
  id: 's',
  bpm: 80,
  timeSignature: [4, 4],
  staves: [{ id: 'a', clef: 'treble', voices: [{ id: 'v', notes: [] }] }],
})

describe('measures', () => {
  it('measureFill : 5 états', () => {
    expect(measureFill([], 4).state).toBe('empty')
    expect(measureFill([q({ point: true }), q({ duration: 'w' })], 4).state).toBe('points')
    expect(measureFill([q(), q(), q(), q()], 4)).toEqual({ used: 4, state: 'full' })
    expect(measureFill([q({ duration: 'h' })], 4)).toEqual({ used: 2, state: 'under' })
    expect(measureFill([q({ duration: 'w' }), q()], 4)).toEqual({ used: 5, state: 'over' })
  })

  it('migre une partition v1 en mesures (multiple de 4), de façon idempotente', () => {
    const s = base()
    s.staves[0].voices[0].notes = Array.from({ length: 6 }, () => q())
    const m = migrateScore(s)
    expect(LINE_MEASURES).toBe(4)
    expect(m.measureCount).toBe(4)
    expect(m.staves[0].voices[0].measures!.map((x) => x.length)).toEqual([4, 2, 0, 0])
    expect(m.staves[0].voices[0].notes).toEqual([])
    expect(migrateScore(m)).toEqual(m)
  })

  it('aligne toutes les voix sur le même nombre de mesures', () => {
    const s = base()
    s.staves.push({ id: 'b', clef: 'bass', voices: [{ id: 'v', notes: [], measures: [[], [], [], [], [q()]] }] })
    const m = migrateScore(s)
    expect(m.measureCount).toBe(8)
    expect(m.staves.map((st) => st.voices[0].measures!.length)).toEqual([8, 8])
  })

  it('timeline : chaque mesure démarre à index × longueur, même si la précédente déborde', () => {
    const over = [q(), q(), q(), q(), q()]
    const second = q()
    const s = { ...base(), measureCount: 4 }
    s.staves[0].voices[0].measures = [over, [second], [], []]
    const t = timeline(s)
    expect(t.find((e) => e.note === over[4])!.start).toBe(4)
    expect(t.find((e) => e.note === second)!.start).toBe(4)
  })
})
