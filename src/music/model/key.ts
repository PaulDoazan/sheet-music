import type { Alter, Pitch, Step } from './types'

/** Armure : nombre d'altérations, positif = dièses, négatif = bémols (−4…4). */
export const KEY_MAX = 4
const SHARPS: Step[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLATS: Step[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

/** Altération que l'armure donne au degré `step`. */
export function keyAlter(key: number | undefined, step: Step): Alter {
  const k = key ?? 0
  if (k > 0) return SHARPS.slice(0, k).includes(step) ? 1 : 0
  if (k < 0) return FLATS.slice(0, -k).includes(step) ? -1 : 0
  return 0
}

/** Hauteur avec l'altération de l'armure (on écrit l'altération seulement si non nulle). */
export function withKey(p: Pitch, key: number | undefined): Pitch {
  const a = keyAlter(key, p.step)
  return a ? { step: p.step, octave: p.octave, alter: a } : { step: p.step, octave: p.octave }
}

/** Changement d'armure : une note qui suivait l'ancienne armure suit la nouvelle, les autres gardent leur son. */
export function rekeyPitch(p: Pitch, from: number | undefined, to: number | undefined): Pitch {
  if ((p.alter ?? 0) !== keyAlter(from, p.step)) return p
  return withKey(p, to)
}

/** Clé VexFlow (majeur) pour `Stave.addKeySignature`. */
export const VEX_KEY: Record<number, string> = {
  [-4]: 'Ab',
  [-3]: 'Eb',
  [-2]: 'Bb',
  [-1]: 'F',
  0: 'C',
  1: 'G',
  2: 'D',
  3: 'A',
  4: 'E',
}

export const KEY_OPTIONS = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((value) => ({
  value,
  label: value === 0 ? 'Aucune' : `${Math.abs(value)} ${value > 0 ? '♯' : '♭'}`,
}))
