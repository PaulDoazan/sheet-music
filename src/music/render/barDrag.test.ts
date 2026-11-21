import { describe, expect, it } from 'vitest'
import { barsFromFractions, dragFractions, lineFractions } from './barDrag'

describe('barres déplaçables', () => {
  it('fractions égales par défaut, positions des barres', () => {
    expect(lineFractions(undefined)).toEqual([0.25, 0.25, 0.25, 0.25])
    expect(lineFractions(null)).toEqual([0.25, 0.25, 0.25, 0.25])
    expect(lineFractions([1, 2])).toEqual([0.25, 0.25, 0.25, 0.25])
    expect(barsFromFractions([0.25, 0.25, 0.25, 0.25], 100, 500)).toEqual([200, 300, 400])
  })
  it('déplace une barre et renvoie des fractions de somme 1', () => {
    const fr = dragFractions([200, 300, 400], 100, 500, 0, 250, 40)
    expect(fr).toEqual([0.375, 0.125, 0.25, 0.25])
    expect(fr.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })
  it('respecte la largeur minimale des deux mesures voisines', () => {
    expect(dragFractions([200, 300, 400], 100, 500, 1, 1000, 40)).toEqual([0.25, 0.25 + 0.15, 0.1, 0.25])
    expect(dragFractions([200, 300, 400], 100, 500, 0, -50, 40)).toEqual([0.1, 0.4, 0.25, 0.25])
  })
  it('ignore une position invalide', () => {
    expect(dragFractions([200, 300, 400], 100, 500, 2, NaN, 40)).toEqual([0.25, 0.25, 0.25, 0.25])
  })
})
