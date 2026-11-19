import type { Duration, Note } from './types'

/** Durée en temps de noire. */
export const DURATION_BEATS: Record<Duration, number> = { w: 4, h: 2, q: 1, '8': 0.5, '16': 0.25 }
export const DURATIONS: Duration[] = ['w', 'h', 'q', '8', '16']

export function noteBeats(n: Pick<Note, 'duration' | 'dots'>): number {
  return DURATION_BEATS[n.duration] * (n.dots ? 1.5 : 1)
}

/** Longueur d'une mesure en temps de noire (6/8 → 3). */
export function measureBeats([num, den]: [number, number]): number {
  return (num * 4) / den
}

const EPS = 1e-6

/** Plus grande valeur (éventuellement pointée) qui tient dans `room` temps, ou null. */
export function fitDuration(
  wanted: { duration: Duration; dots?: 0 | 1 },
  room: number,
): { duration: Duration; dots: 0 | 1 } | null {
  if (noteBeats(wanted) <= room + EPS) return { duration: wanted.duration, dots: wanted.dots ?? 0 }
  for (const d of DURATIONS) {
    if (DURATION_BEATS[d] * 1.5 <= room + EPS && DURATION_BEATS[d] * 1.5 <= noteBeats(wanted)) return { duration: d, dots: 1 }
    if (DURATION_BEATS[d] <= room + EPS) return { duration: d, dots: 0 }
  }
  return null
}

/** Temps de début de chaque note. */
export function noteStarts(notes: Note[]): number[] {
  const out: number[] = []
  let t = 0
  for (const n of notes) {
    out.push(t)
    t += noteBeats(n)
  }
  return out
}

export function totalBeats(notes: Note[]): number {
  return notes.reduce((t, n) => t + noteBeats(n), 0)
}

/** Répartit les notes par mesure (une note appartient à la mesure où elle commence). */
export function splitMeasures(notes: Note[], perMeasure: number): Note[][] {
  const out: Note[][] = []
  let t = 0
  for (const n of notes) {
    const m = Math.floor(t / perMeasure + EPS)
    while (out.length <= m) out.push([])
    out[m].push(n)
    t += noteBeats(n)
  }
  return out
}

/** Silences qui comblent `room` temps à partir d'une position `offset` dans la mesure (plus grands d'abord). */
export function fillerRests(room: number): { duration: Duration; dots: 0 | 1 }[] {
  const out: { duration: Duration; dots: 0 | 1 }[] = []
  let r = room
  while (r > EPS) {
    const f = fitDuration({ duration: 'w' }, r)
    if (!f) break
    out.push({ duration: f.duration, dots: 0 })
    r -= DURATION_BEATS[f.duration]
  }
  return out
}
