import { describe, expect, it } from 'vitest'
import { diatonicIndex, parsePitch, samePitch } from '@/music/model'
import { generateNotes, seededRng } from './generator'
import { DEFAULT_SETTINGS, type ClefMode, type ReadingSettings } from './settings'

const MODES: ClefMode[] = ['treble', 'bass', 'both']

function make(clefMode: ClefMode, t: [string, string], b: [string, string], maxLeap: number): ReadingSettings {
  return {
    clefMode,
    ranges: { treble: { low: t[0], high: t[1] }, bass: { low: b[0], high: b[1] } },
    maxLeap,
  }
}

// Cinq réglages équivalents aux anciens niveaux (bornes ramenées dans ALLOWED).
const TABLE: { name: string; t: [string, string]; b: [string, string]; leap: number }[] = [
  { name: 'portée, petits sauts', t: ['E4', 'F5'], b: ['G2', 'A3'], leap: 2 },
  { name: '1 ligne supplémentaire', t: ['C4', 'A5'], b: ['E2', 'C4'], leap: 4 },
  { name: '2 lignes supplémentaires', t: ['A3', 'C6'], b: ['C2', 'E4'], leap: 5 },
  { name: '3 lignes, octave', t: ['F3', 'E6'], b: ['A1', 'G4'], leap: 7 },
  { name: 'tout le clavier, libre', t: ['D3', 'G6'], b: ['F1', 'B4'], leap: Infinity },
]

describe('generateNotes', () => {
  TABLE.forEach((row, li) => {
    for (const clefMode of MODES) {
      it(`respecte tessiture et sauts — ${row.name}, ${clefMode}`, () => {
        const settings = make(clefMode, row.t, row.b, row.leap)
        const notes = generateNotes({ settings, count: 400 }, seededRng((li + 1) * 31 + clefMode.length))
        expect(notes).toHaveLength(400)
        let run = 0
        notes.forEach((n, i) => {
          if (clefMode !== 'both') expect(n.clef).toBe(clefMode)
          const r = settings.ranges[n.clef]
          const idx = diatonicIndex(n.pitch)
          expect(idx).toBeGreaterThanOrEqual(diatonicIndex(parsePitch(r.low)))
          expect(idx).toBeLessThanOrEqual(diatonicIndex(parsePitch(r.high)))
          const prev = notes[i - 1]
          if (prev && prev.clef === n.clef) {
            expect(samePitch(prev.pitch, n.pitch)).toBe(false)
            expect(Math.abs(idx - diatonicIndex(prev.pitch))).toBeLessThanOrEqual(row.leap)
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
  })

  it('continue la marche depuis la page précédente', () => {
    const rng = seededRng(7)
    const settings = { ...DEFAULT_SETTINGS, maxLeap: 2 }
    const first = generateNotes({ settings, count: 8 }, rng)
    const next = generateNotes({ settings, count: 1, previous: first }, rng)
    const gap = Math.abs(diatonicIndex(next[0].pitch) - diatonicIndex(first[7].pitch))
    expect(gap).toBeGreaterThan(0)
    expect(gap).toBeLessThanOrEqual(2)
  })

  it('tessiture de deux notes, saut 2de : alterne sans répétition', () => {
    const settings = make('treble', ['E4', 'F4'], ['G2', 'A3'], 1)
    const notes = generateNotes({ settings, count: 50 }, seededRng(5))
    notes.forEach((n, i) => {
      expect(['E4', 'F4']).toContain(`${n.pitch.step}${n.pitch.octave}`)
      if (i) expect(samePitch(notes[i - 1].pitch, n.pitch)).toBe(false)
    })
  })

  it('saut libre sur D3–G6 : produit au moins un saut > 7 degrés', () => {
    const settings = make('treble', ['D3', 'G6'], ['G2', 'A3'], Infinity)
    const notes = generateNotes({ settings, count: 400 }, seededRng(11))
    const big = notes.some((n, i) => i > 0 && Math.abs(diatonicIndex(n.pitch) - diatonicIndex(notes[i - 1].pitch)) > 7)
    expect(big).toBe(true)
  })

  it('saut 7 sur tessiture E4–G4 : reste dans la tessiture', () => {
    const settings = make('treble', ['E4', 'G4'], ['G2', 'A3'], 7)
    const notes = generateNotes({ settings, count: 200 }, seededRng(3))
    for (const n of notes) expect(['E4', 'F4', 'G4']).toContain(`${n.pitch.step}${n.pitch.octave}`)
  })
})
