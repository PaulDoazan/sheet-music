import { LINE_SPACING } from './layout'
import { MAX_STEP, MIN_STEP } from './pitchFromY'

/** Au-delà de MIN_STEP/MAX_STEP de cette marge (en degrés), la pose est annulée. */
export const CANCEL_MARGIN = 6

/** Degré (demi-interlignes sous la ligne du haut) à l'ordonnée logique `ly`. */
export function stepAtY(ly: number, staffTop: number): number {
  return Math.round((ly - staffTop) / (LINE_SPACING / 2))
}

/** Degré borné à [minStep, maxStep] et indicateur d'annulation (au-delà de ±CANCEL_MARGIN). */
export function resolveStep(
  raw: number,
  minStep: number = MIN_STEP,
  maxStep: number = MAX_STEP,
): { step: number; cancelled: boolean } {
  return {
    step: Math.max(minStep, Math.min(maxStep, raw)),
    cancelled: raw < MIN_STEP - CANCEL_MARGIN || raw > MAX_STEP + CANCEL_MARGIN,
  }
}

/** Degrés des lignes supplémentaires à tracer pour un degré donné. */
export function ledgerSteps(step: number): number[] {
  const out: number[] = []
  for (let k = -2; k >= step; k -= 2) out.push(k)
  for (let k = 10; k <= step; k += 2) out.push(k)
  return out
}
