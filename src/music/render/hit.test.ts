import { describe, expect, it } from 'vitest'
import { hitElement } from './hit'

describe('hitElement', () => {
  const elems = [
    { id: 'a', x: 100, y: 50 },
    { id: 'b', x: 120, y: 70 },
  ]
  it('touche la note la plus proche, près de sa tête', () => {
    expect(hitElement(elems, 104, 52)?.id).toBe('a')
    expect(hitElement(elems, 113, 72)?.id).toBe('b')
  })
  it('loin verticalement : pas de sélection (on pose un point entre/au-dessus)', () => {
    expect(hitElement(elems, 110, 10)).toBeNull()
    expect(hitElement(elems, 101, 90)).toBeNull()
  })
})
