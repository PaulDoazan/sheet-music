import { measureBeats, noteBeats, splitMeasures } from './time'
import type { Note, Score } from './types'

/** Mesures par ligne de la page de l'éditeur. */
export const LINE_MEASURES = 4

export type FillState = 'empty' | 'points' | 'full' | 'under' | 'over'

export function measureFill(m: Note[], perMeasure: number): { used: number; state: FillState } {
  const used = m.reduce((t, n) => t + noteBeats(n), 0)
  if (m.length === 0) return { used, state: 'empty' }
  if (m.some((n) => n.point)) return { used, state: 'points' }
  const d = used - perMeasure
  return { used, state: Math.abs(d) < 1e-6 ? 'full' : d < 0 ? 'under' : 'over' }
}

const roundUp = (n: number) => Math.max(LINE_MEASURES, Math.ceil(n / LINE_MEASURES) * LINE_MEASURES)

/** Partition v1 (notes) → mesures explicites, toutes les voix à `measureCount` (multiple de 4). Idempotent. */
export function migrateScore(s: Score): Score {
  const pm = measureBeats(s.timeSignature)
  const staves = s.staves.map((st) => ({
    ...st,
    voices: st.voices.map((v) => ({
      ...v,
      notes: [] as Note[],
      measures: v.measures ? v.measures.map((m) => [...m]) : splitMeasures(v.notes, pm),
    })),
  }))
  const count = roundUp(
    Math.max(s.measureCount ?? 0, ...staves.flatMap((st) => st.voices.map((v) => v.measures.length))),
  )
  staves.forEach((st) =>
    st.voices.forEach((v) => {
      while (v.measures.length < count) v.measures.push([])
    }),
  )
  return { ...s, staves, measureCount: count }
}

/** Événements datés (en noires) : chaque mesure démarre à index × longueur de mesure. */
export function timeline(s: Score): { staff: number; note: Note; start: number }[] {
  const pm = measureBeats(s.timeSignature)
  const out: { staff: number; note: Note; start: number }[] = []
  s.staves.forEach((st, si) =>
    st.voices.forEach((v) =>
      (v.measures ?? []).forEach((m, mi) => {
        let t = mi * pm
        for (const note of m) {
          out.push({ staff: si, note, start: t })
          t += noteBeats(note)
        }
      }),
    ),
  )
  return out
}
