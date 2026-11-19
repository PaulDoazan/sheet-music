import { describe, expect, it } from 'vitest'
import { diatonicIndex, parsePitch, samePitch } from '@/music/model'
import { generateNotes, seededRng } from './generator'
import { LEVEL_SPECS, LEVELS, type ClefMode } from './levels'

const MODES: ClefMode[] = ['treble', 'bass', 'both']

describe('generateNotes', () => {
  for (const level of LEVELS) {
    for (const clefMode of MODES) {
      it(`respecte tessiture et sauts — niveau ${level}, ${clefMode}`, () => {
        const spec = LEVEL_SPECS[level]
        const notes = generateNotes({ clefMode, level, count: 400 }, seededRng(level * 31 + clefMode.length))
        expect(notes).toHaveLength(400)
        let run = 0
        notes.forEach((n, i) => {
          if (clefMode !== 'both') expect(n.clef).toBe(clefMode)
          const r = spec.ranges[n.clef]
          const idx = diatonicIndex(n.pitch)
          expect(idx).toBeGreaterThanOrEqual(diatonicIndex(parsePitch(r.low)))
          expect(idx).toBeLessThanOrEqual(diatonicIndex(parsePitch(r.high)))
          const prev = notes[i - 1]
          if (prev && prev.clef === n.clef) {
            expect(samePitch(prev.pitch, n.pitch)).toBe(false)
            expect(Math.abs(idx - diatonicIndex(prev.pitch))).toBeLessThanOrEqual(spec.maxLeap)
          }
          run = prev && prev.clef === n.clef ? run + 1 : 1
          if (clefMode === 'both') expect(run).toBeLessThanOrEqual(3)
        })
        if (clefMode === 'both') {
          expect(notes.some((n) => n.clef === 'treble')).toBe(true)
          expect(notes.some((n) => n.clef === 'bass')).toBe(true)
        }
      })
    }
  }

  it('continue la marche depuis la page précédente', () => {
    const rng = seededRng(7)
    const first = generateNotes({ clefMode: 'treble', level: 1, count: 8 }, rng)
    const next = generateNotes({ clefMode: 'treble', level: 1, count: 1, previous: first }, rng)
    const gap = Math.abs(diatonicIndex(next[0].pitch) - diatonicIndex(first[7].pitch))
    expect(gap).toBeGreaterThan(0)
    expect(gap).toBeLessThanOrEqual(2)
  })
})
