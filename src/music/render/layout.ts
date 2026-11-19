import type { Clef } from '@/music/model'

/** Marge à réserver au-dessus/au-dessous d'une portée, en interlignes (1 = 10 unités VexFlow). */
export interface StaffExtent {
  above: number
  below: number
}

export interface NoteLayout {
  /** Centre de la tête de note, en px dans le repère du composant. */
  x: number
  y: number
  staffIndex: number
  stemUp: boolean
}

export const LINE_SPACING = 10

/**
 * Marges nécessaires pour une tessiture (index diatoniques extrêmes) : l'échelle de la portée
 * reste ainsi stable pendant toute une partie. Inclut la place d'une étiquette sous/sur la note.
 */
export function extentForRange(clef: Clef, lowIndex: number, highIndex: number, labelRoom = 2.4): StaffExtent {
  const top = clef === 'treble' ? 38 : 26 // F5 / A3
  const bottom = clef === 'treble' ? 30 : 18 // E4 / G2
  // 1 degré = ½ interligne. Les notes hors portée ont la hampe vers la portée.
  return {
    above: Math.max(1.5, (highIndex - top) / 2 + 0.5) + labelRoom,
    below: Math.max(1.5, (bottom - lowIndex) / 2 + 0.5) + labelRoom,
  }
}
