/** Largeurs des mesures d'une ligne : 4 fractions de la largeur utile (de somme 1). */
const EQUAL = [0.25, 0.25, 0.25, 0.25]

export function lineFractions(w: number[] | null | undefined): number[] {
  if (!w || w.length !== 4 || w.some((f) => !Number.isFinite(f) || f < 0)) return [...EQUAL]
  const sum = w.reduce((a, b) => a + b, 0)
  return sum > 0 ? w.map((f) => f / sum) : [...EQUAL]
}

/** Abscisses des 3 barres intermédiaires entre `start` (début des notes) et `end` (fin de ligne). */
export function barsFromFractions(fr: number[], start: number, end: number): number[] {
  const out: number[] = []
  let x = start
  for (let k = 0; k < 3; k++) {
    x += fr[k] * (end - start)
    out.push(x)
  }
  return out
}

const round = (v: number) => Math.round(v * 1e6) / 1e6

/** Barre `k` (0…2) amenée en `x`, bornée pour garder `min` aux deux mesures voisines → nouvelles fractions. */
export function dragFractions(bars: number[], start: number, end: number, k: number, x: number, min: number): number[] {
  const b = [...bars]
  if (Number.isFinite(x)) {
    const lo = (k === 0 ? start : b[k - 1]) + min
    const hi = (k === 2 ? end : b[k + 1]) - min
    b[k] = lo <= hi ? Math.max(lo, Math.min(hi, x)) : b[k]
  }
  const edges = [start, ...b, end]
  const total = end - start
  return [0, 1, 2, 3].map((i) => round((edges[i + 1] - edges[i]) / total))
}
