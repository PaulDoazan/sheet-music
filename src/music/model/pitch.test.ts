import { describe, expect, it } from 'vitest'
import { diatonicIndex, fromDiatonicIndex, parsePitch, pitchToMidi, pitchToVexKey } from './pitch'

describe('pitch', () => {
  it('convertit en MIDI', () => {
    expect(pitchToMidi(parsePitch('C4'))).toBe(60)
    expect(pitchToMidi(parsePitch('A4'))).toBe(69)
    expect(pitchToMidi({ step: 'F', octave: 4, alter: 1 })).toBe(66)
  })
  it('aller-retour diatonique', () => {
    for (const s of ['C1', 'B2', 'E4', 'A6']) {
      const p = parsePitch(s)
      expect(fromDiatonicIndex(diatonicIndex(p))).toEqual(p)
    }
    expect(diatonicIndex(parsePitch('D4')) - diatonicIndex(parsePitch('B3'))).toBe(2)
  })
  it('clé VexFlow', () => {
    expect(pitchToVexKey(parsePitch('G5'))).toBe('g/5')
  })
})
