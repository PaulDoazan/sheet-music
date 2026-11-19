import type { Clef } from '@/music/model'

export type ClefMode = 'treble' | 'bass' | 'both'
export type Level = 1 | 2 | 3 | 4 | 5
export const LEVELS: Level[] = [1, 2, 3, 4, 5]

export interface LevelRange {
  low: string
  high: string
}

export interface LevelSpec {
  ranges: Record<Clef, LevelRange>
  /** Saut maximum entre deux notes consécutives, en degrés (2 = tierce). */
  maxLeap: number
  label: string
}

export const LEVEL_SPECS: Record<Level, LevelSpec> = {
  1: { ranges: { treble: { low: 'E4', high: 'F5' }, bass: { low: 'G2', high: 'A3' } }, maxLeap: 2, label: 'Dans la portée, petits sauts' },
  2: { ranges: { treble: { low: 'C4', high: 'A5' }, bass: { low: 'E2', high: 'C4' } }, maxLeap: 4, label: '1 ligne supplémentaire' },
  3: { ranges: { treble: { low: 'A3', high: 'C6' }, bass: { low: 'C2', high: 'E4' } }, maxLeap: 5, label: '2 lignes supplémentaires' },
  4: { ranges: { treble: { low: 'F3', high: 'E6' }, bass: { low: 'A1', high: 'G4' } }, maxLeap: 7, label: '3 lignes, sauts d’octave' },
  5: { ranges: { treble: { low: 'C3', high: 'A6' }, bass: { low: 'E1', high: 'C5' } }, maxLeap: Infinity, label: 'Tout le clavier, sauts libres' },
}

export const CLEF_MODES: { value: ClefMode; label: string }[] = [
  { value: 'treble', label: 'Clé de Sol' },
  { value: 'bass', label: 'Clé de Fa' },
  { value: 'both', label: 'Sol + Fa' },
]

export function isClefMode(v: unknown): v is ClefMode {
  return v === 'treble' || v === 'bass' || v === 'both'
}
export function isLevel(v: unknown): v is Level {
  return typeof v === 'number' && LEVELS.includes(v as Level)
}
