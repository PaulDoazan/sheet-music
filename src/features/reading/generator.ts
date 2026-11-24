import { diatonicIndex, fromDiatonicIndex, parsePitch, type Clef, type Pitch } from '@/music/model'
import type { ReadingSettings } from './settings'

export interface ExerciseNote {
  clef: Clef
  pitch: Pitch
}

export type Rng = () => number

/** RNG déterministe (mulberry32) pour les tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MAX_SAME_CLEF_RUN = 3

function pickInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

/**
 * Génère `count` notes en marche aléatoire, en continuant depuis `previous` si fourni.
 * - tessiture (par clé) et saut max selon les réglages ;
 * - jamais deux fois la même note d'affilée ;
 * - en mode Sol + Fa, clé tirée au hasard (au plus 3 d'affilée sur la même) ; changer de clé = départ libre.
 */
export function generateNotes(
  opts: { settings: ReadingSettings; count: number; previous?: ExerciseNote[] },
  rng: Rng = Math.random,
): ExerciseNote[] {
  const { clefMode, ranges, maxLeap } = opts.settings
  const history: ExerciseNote[] = [...(opts.previous ?? [])]
  const out: ExerciseNote[] = []

  for (let i = 0; i < opts.count; i++) {
    const last = history[history.length - 1]
    let clef: Clef
    if (clefMode !== 'both') {
      clef = clefMode
    } else {
      const run = trailingRun(history)
      if (last && run >= MAX_SAME_CLEF_RUN) clef = last.clef === 'treble' ? 'bass' : 'treble'
      else clef = rng() < 0.5 ? 'treble' : 'bass'
    }

    const range = ranges[clef]
    const lo = diatonicIndex(parsePitch(range.low))
    const hi = diatonicIndex(parsePitch(range.high))
    let min = lo
    let max = hi
    const prevIdx = last && last.clef === clef ? diatonicIndex(last.pitch) : undefined
    if (prevIdx !== undefined && Number.isFinite(maxLeap)) {
      min = Math.max(lo, prevIdx - maxLeap)
      max = Math.min(hi, prevIdx + maxLeap)
    }

    let idx = pickInt(rng, min, max)
    if (prevIdx !== undefined && idx === prevIdx) {
      // décale d'un cran (dans la tessiture) pour éviter la répétition
      idx = idx + 1 <= max ? idx + 1 : idx - 1
    }
    const note: ExerciseNote = { clef, pitch: fromDiatonicIndex(idx) }
    history.push(note)
    out.push(note)
  }
  return out
}

function trailingRun(history: ExerciseNote[]): number {
  if (!history.length) return 0
  const clef = history[history.length - 1].clef
  let n = 0
  for (let i = history.length - 1; i >= 0 && history[i].clef === clef; i--) n++
  return n
}
