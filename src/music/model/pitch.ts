import { STEPS, type Pitch, type Step } from './types'

const SEMITONES: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export const SOLFEGE: Record<Step, string> = {
  C: 'Do',
  D: 'Ré',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
}

/** Index diatonique absolu (C0 = 0, D0 = 1, …) : sert à mesurer les intervalles en degrés. */
export function diatonicIndex(p: Pitch): number {
  return p.octave * 7 + STEPS.indexOf(p.step)
}

export function fromDiatonicIndex(index: number): Pitch {
  const octave = Math.floor(index / 7)
  return { step: STEPS[index - octave * 7], octave }
}

/** Numéro MIDI (C4 = 60). */
export function pitchToMidi(p: Pitch): number {
  return (p.octave + 1) * 12 + SEMITONES[p.step] + (p.alter ?? 0)
}

/** Clé VexFlow, ex. { C, 4 } → "c/4". */
export function pitchToVexKey(p: Pitch): string {
  const acc = p.alter === 1 ? '#' : p.alter === -1 ? 'b' : ''
  return `${p.step.toLowerCase()}${acc}/${p.octave}`
}

/** Parse "C4", "A3" (notation anglaise, sans altération). */
export function parsePitch(s: string): Pitch {
  const m = /^([A-G])(-?\d)$/.exec(s)
  if (!m) throw new Error(`Hauteur invalide : ${s}`)
  return { step: m[1] as Step, octave: Number(m[2]) }
}

export function samePitch(a: Pitch, b: Pitch): boolean {
  return a.step === b.step && a.octave === b.octave && (a.alter ?? 0) === (b.alter ?? 0)
}
