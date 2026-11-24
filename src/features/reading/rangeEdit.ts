import { parsePitch, type Clef, type Pitch } from '@/music/model'
import { MAX_STEP, MIN_STEP, pitchAtStep, stepOfPitch } from '@/music/render/pitchFromY'
import type { PitchRange } from './settings'

/** Note éditée : la plus grave ou la plus aiguë de la tessiture. */
export type Bound = 'low' | 'high'

const stepOf = (clef: Clef, p: string) => stepOfPitch(clef, 0, parsePitch(p))
const fmt = (p: Pitch) => `${p.step}${p.octave}`

/**
 * Bornes de degré (stepOfPitch, clé non octaviée) autorisées pour `bound` vu l'autre note.
 * Les degrés croissent vers le grave : la grave reste au moins un degré sous l'aiguë, et inversement.
 */
export function stepLimits(clef: Clef, range: PitchRange, bound: Bound): { minStep: number; maxStep: number } {
  return bound === 'high'
    ? { minStep: MIN_STEP, maxStep: stepOf(clef, range.low) - 1 }
    : { minStep: stepOf(clef, range.high) + 1, maxStep: MAX_STEP }
}

/** Degré visé par ▲ (+1) ou ▼ (−1), ou null en butée. */
function target(clef: Clef, range: PitchRange, bound: Bound, delta: 1 | -1): number | null {
  const { minStep, maxStep } = stepLimits(clef, range, bound)
  const step = stepOf(clef, range[bound]) - delta
  return step >= minStep && step <= maxStep ? step : null
}

export function canNudge(clef: Clef, range: PitchRange, bound: Bound, delta: 1 | -1): boolean {
  return target(clef, range, bound, delta) !== null
}

/** Monte (+1) ou descend (−1) la note d'un degré ; inchangé si en butée. */
export function nudge(clef: Clef, range: PitchRange, bound: Bound, delta: 1 | -1): PitchRange {
  const step = target(clef, range, bound, delta)
  if (step === null) return range
  return { ...range, [bound]: fmt(pitchAtStep(clef, 0, step)) }
}
