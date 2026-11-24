import { describe, expect, it } from 'vitest'
import { CANCEL_MARGIN, ledgerSteps, resolveStep, stepAtY } from './placeGesture'

describe('stepAtY', () => {
  it('convertit une ordonnée en degré (demi-interlignes sous la ligne du haut)', () => {
    const top = 100
    expect(stepAtY(top + 25, top)).toBe(5)
    expect(stepAtY(top - 7, top)).toBe(-1)
  })
})

describe('resolveStep', () => {
  it('borne à MIN_STEP/MAX_STEP et annule au-delà de la marge', () => {
    expect(CANCEL_MARGIN).toBe(6)
    expect(resolveStep(20)).toEqual({ step: 16, cancelled: false })
    expect(resolveStep(23)).toEqual({ step: 16, cancelled: true })
    expect(resolveStep(-15)).toEqual({ step: -8, cancelled: true })
  })
  it('borne selon les bornes passées, annule selon MIN_STEP/MAX_STEP', () => {
    expect(resolveStep(3, -8, 1)).toEqual({ step: 1, cancelled: false })
    // l'annulation ignore les bornes resserrées
    expect(resolveStep(20, -8, 1)).toEqual({ step: 1, cancelled: false })
  })
})

describe('ledgerSteps', () => {
  it('liste les lignes supplémentaires', () => {
    expect(ledgerSteps(4)).toEqual([])
    expect(ledgerSteps(-5)).toEqual([-2, -4])
    expect(ledgerSteps(13)).toEqual([10, 12])
  })
})
