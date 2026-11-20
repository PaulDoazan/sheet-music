import { diatonicIndex, fromDiatonicIndex, type Clef, type Pitch } from '@/music/model'

/** Index diatonique de la ligne du haut (F5 en Sol, A3 en Fa), décalé par la clé octaviée. */
export function topIndex(clef: Clef, clefOctave: number): number {
  return (clef === 'treble' ? 38 : 26) + clefOctave * 7
}

/** Plage accessible : 4 lignes supplémentaires au-dessus et au-dessous (8 degrés). */
export const MIN_STEP = -8
export const MAX_STEP = 16

/** Hauteur à `steps` demi-interlignes sous la ligne du haut (négatif = au-dessus), bornée. */
export function pitchAtStep(clef: Clef, clefOctave: number, steps: number): Pitch {
  const s = Math.max(MIN_STEP, Math.min(MAX_STEP, Math.round(steps)))
  return fromDiatonicIndex(topIndex(clef, clefOctave) - s)
}

export function stepOfPitch(clef: Clef, clefOctave: number, p: Pitch): number {
  return topIndex(clef, clefOctave) - diatonicIndex(p)
}
