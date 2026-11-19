/**
 * Modèle de partition partagé : jeu de lecture (brique 1), éditeur (brique 2), backend Go (JSON).
 * Types purs, sérialisables, sans dépendance au moteur de rendu.
 */
export const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export type Step = (typeof STEPS)[number]
export type Alter = -1 | 0 | 1

export interface Pitch {
  step: Step
  octave: number
  /** -1 bémol, 1 dièse. Inutilisé dans le MVP (notes naturelles). */
  alter?: Alter
}

export type Clef = 'treble' | 'bass'
export type Duration = 'w' | 'h' | 'q' | '8' | '16'

export interface Note {
  id: string
  /** null = silence */
  pitch: Pitch | null
  duration: Duration
}

export interface Voice {
  id: string
  name?: string
  notes: Note[]
}

export interface Staff {
  id: string
  clef: Clef
  voices: Voice[]
}

export interface Score {
  id: string
  title?: string
  bpm: number
  timeSignature: [number, number]
  staves: Staff[]
}
