/**
 * Pilote du ruban défilant (droite → gauche).
 *
 * Repère : la note i est à l'abscisse `i * spacing - scroll` (unités logiques, origine = début de la zone de notes).
 * - avance « au rythme » du joueur (moyenne glissante de ses réponses/s) ;
 * - rattrape quand le joueur va plus vite (la note courante est à droite de la cible) ;
 * - freine en douceur et s'arrête avant `minX` quand le joueur ralentit : aucune note n'est perdue.
 */
export interface TapeScrollerOptions {
  spacing: number
  /** Position visée pour la note courante. */
  targetX: number
  /** Position où le ruban s'arrête si le joueur ne répond pas. */
  minX: number
  /** Gain de rattrapage (1/s). */
  catchUp?: number
  /** Rythme supposé au départ (notes/s). */
  initialRate?: number
}

const smoothstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

export function createTapeScroller(opts: TapeScrollerOptions) {
  let o = { catchUp: 2.2, initialRate: 0.45, ...opts }
  let scroll = 0
  let rate = o.initialRate
  let lastAnswerAt: number | null = null

  return {
    get scroll() {
      return scroll
    },
    get rate() {
      return rate
    },
    /** Abscisse actuelle de la note i. */
    xOf(i: number) {
      return i * o.spacing - scroll
    },
    /** Place la note `cursor` sur la cible, rythme réinitialisé. */
    reset(cursor: number) {
      scroll = cursor * o.spacing - o.targetX
      rate = o.initialRate
      lastAnswerAt = null
    },
    /** Nouvelle géométrie (redimensionnement) : garde la note courante au même endroit relatif. */
    configure(next: TapeScrollerOptions, cursor: number) {
      const rel = (this.xOf(cursor) - o.minX) / Math.max(1, o.targetX - o.minX)
      o = { ...o, ...next }
      scroll = cursor * o.spacing - (o.minX + rel * (o.targetX - o.minX))
    },
    start(now: number) {
      lastAnswerAt = now
    },
    answered(now: number) {
      if (lastAnswerAt !== null) {
        const dt = Math.min(5, Math.max(0.2, (now - lastAnswerAt) / 1000))
        rate = 0.65 * rate + 0.35 * (1 / dt)
      }
      lastAnswerAt = now
    },
    /** Avance de `dt` secondes ; renvoie la vitesse appliquée (unités/s). */
    step(dt: number, cursor: number): number {
      const x = this.xOf(cursor)
      const flow = rate * o.spacing * smoothstep((x - o.minX) / Math.max(1, o.targetX - o.minX))
      const pull = o.catchUp * Math.max(0, x - o.targetX)
      const v = flow + pull
      // jamais au-delà de minX
      scroll = Math.min(scroll + v * dt, cursor * o.spacing - o.minX)
      return v
    },
  }
}

export type TapeScroller = ReturnType<typeof createTapeScroller>
