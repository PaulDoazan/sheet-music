import { describe, expect, it } from 'vitest'
import { keyAlter, KEY_OPTIONS, rekeyPitch, VEX_KEY } from './key'

describe('armure', () => {
  it('donne l’altération de chaque degré', () => {
    expect(keyAlter(1, 'F')).toBe(1)
    expect(keyAlter(1, 'C')).toBe(0)
    expect(keyAlter(4, 'D')).toBe(1)
    expect(keyAlter(4, 'A')).toBe(0)
    expect(keyAlter(-2, 'E')).toBe(-1)
    expect(keyAlter(-2, 'A')).toBe(0)
    expect(keyAlter(0, 'F')).toBe(0)
    expect(keyAlter(undefined, 'F')).toBe(0)
  })
  it('réarme seulement les notes qui suivaient l’armure', () => {
    expect(rekeyPitch({ step: 'F', octave: 4, alter: 1 }, 1, 2)).toEqual({ step: 'F', octave: 4, alter: 1 })
    expect(rekeyPitch({ step: 'C', octave: 4 }, 1, 2)).toEqual({ step: 'C', octave: 4, alter: 1 })
    expect(rekeyPitch({ step: 'F', octave: 4 }, 1, 2)).toEqual({ step: 'F', octave: 4 })
    expect(rekeyPitch({ step: 'F', octave: 4, alter: 1 }, 1, 0)).toEqual({ step: 'F', octave: 4 })
    expect(rekeyPitch({ step: 'B', octave: 4 }, 0, -1)).toEqual({ step: 'B', octave: 4, alter: -1 })
  })
  it('expose les clés VexFlow et les 9 options', () => {
    expect(VEX_KEY[3]).toBe('A')
    expect(VEX_KEY[-3]).toBe('Eb')
    expect(KEY_OPTIONS.map((o) => o.value)).toEqual([-4, -3, -2, -1, 0, 1, 2, 3, 4])
  })
})
