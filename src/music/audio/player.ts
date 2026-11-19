/**
 * Lecture d'une partition avec Tone.js (chargé à la demande).
 * Les temps sont exprimés en ticks du Transport : changer le BPM pendant la lecture fonctionne.
 */
import { noteBeats, noteStarts, pitchToMidi, totalBeats, type Score } from '@/music/model'

type ToneNS = typeof import('tone')

export interface PlayOptions {
  fromBeat?: number
  muted?: boolean[]
  onEnd?: () => void
}

export function createPlayer() {
  let Tone: ToneNS | null = null
  let disposers: (() => void)[] = []
  let volumes: { mute: boolean }[] = []
  let origin = 0
  let playing = false

  async function load(): Promise<ToneNS> {
    if (!Tone) Tone = await import('tone')
    return Tone
  }

  function stop() {
    if (!Tone) return
    const t = Tone.getTransport()
    t.stop()
    t.cancel()
    disposers.forEach((d) => d())
    disposers = []
    volumes = []
    playing = false
  }

  async function play(score: Score, opts: PlayOptions = {}) {
    const T = await load()
    await T.start() // débloque l'audio (geste utilisateur, iOS)
    stop()
    const t = T.getTransport()
    t.bpm.value = score.bpm
    const ppq = t.PPQ
    const from = opts.fromBeat ?? 0
    origin = from
    const ticks = (beats: number) => `${Math.max(0, Math.round(beats * ppq))}i`

    score.staves.forEach((staff, si) => {
      const vol = new T.Volume(-10).toDestination()
      vol.mute = !!opts.muted?.[si]
      const piano = (staff.program ?? 0) < 8
      const synth = new T.PolySynth(T.Synth, {
        oscillator: { type: piano ? 'triangle' : 'sine' },
        envelope: piano
          ? { attack: 0.005, decay: 0.5, sustain: 0.25, release: 0.6 }
          : { attack: 0.07, decay: 0.15, sustain: 0.8, release: 0.35 },
      }).connect(vol)
      const events: { time: string; freq: number; dur: string }[] = []
      for (const voice of staff.voices) {
        const starts = noteStarts(voice.notes)
        voice.notes.forEach((n, k) => {
          if (!n.pitch || starts[k] + noteBeats(n) <= from) return
          if (starts[k] < from) return // note commencée avant le point de départ : on ne la joue pas
          events.push({
            time: ticks(starts[k] - from),
            freq: T.Frequency(pitchToMidi(n.pitch), 'midi').toFrequency(),
            dur: ticks(noteBeats(n) * 0.95),
          })
        })
      }
      const part = new T.Part<{ time: string; freq: number; dur: string }>((time, ev) => {
        synth.triggerAttackRelease(ev.freq, ev.dur, time)
      }, events).start(0)
      volumes.push(vol)
      disposers.push(() => {
        part.dispose()
        synth.releaseAll()
        setTimeout(() => {
          synth.dispose()
          vol.dispose()
        }, 800)
      })
    })

    const end = Math.max(0, ...score.staves.map((s) => totalBeats(s.voices[0]?.notes ?? [])))
    t.scheduleOnce(() => {
      setTimeout(() => {
        stop()
        opts.onEnd?.()
      }, 0)
    }, ticks(end - from + 0.25))
    t.position = 0
    t.start('+0.05')
    playing = true
  }

  /** Temps (en noires) en cours de lecture, ou null à l'arrêt. */
  function currentBeat(): number | null {
    if (!Tone || !playing) return null
    const t = Tone.getTransport()
    if (t.state !== 'started') return null
    return origin + t.ticks / t.PPQ
  }

  function setBpm(bpm: number) {
    if (Tone) Tone.getTransport().bpm.value = bpm
  }

  function setMuted(staffIndex: number, muted: boolean) {
    const v = volumes[staffIndex]
    if (v) v.mute = muted
  }

  return { play, stop, currentBeat, setBpm, setMuted, isPlaying: () => playing }
}

export type Player = ReturnType<typeof createPlayer>
