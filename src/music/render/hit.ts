import { LINE_SPACING } from './layout'

export const HIT_X = 14
export const HIT_Y = 2.5 * LINE_SPACING

/** Élément touché : le plus proche en x, et proche de sa tête en y (sinon on pose un point). */
export function hitElement<T extends { x: number; y: number }>(elems: T[], lx: number, ly: number): T | null {
  let hit: T | null = null
  for (const el of elems) {
    if (Math.abs(el.x - lx) >= HIT_X || Math.abs(el.y - ly) >= HIT_Y) continue
    if (!hit || Math.abs(el.x - lx) < Math.abs(hit.x - lx)) hit = el
  }
  return hit
}
