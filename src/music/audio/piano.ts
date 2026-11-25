/**
 * Son de piano (échantillons Salamander Grand Piano, CC-BY 3.0, dans public/audio/piano).
 * Tone.js et les échantillons ne sont chargés qu'à la demande (début de partie).
 */
import { pitchToMidi, type Pitch } from '@/music/model'
import { soundOn } from './soundPref'

type ToneNS = typeof import('tone')
type Sampler = InstanceType<ToneNS['Sampler']>

const NOTES = ['C', 'Ds', 'Fs', 'A'] as const
/** Un échantillon toutes les tierces mineures, de C1 à C7 (le Sampler transpose entre deux). */
export function sampleUrls(): Record<string, string> {
  const urls: Record<string, string> = {}
  for (let o = 1; o <= 6; o++) for (const n of NOTES) urls[`${n.replace('s', '#')}${o}`] = `${n}${o}.mp3`
  urls.C7 = 'C7.mp3'
  return urls
}

let Tone: ToneNS | null = null
let ready: Promise<Sampler> | null = null

/** Charge Tone.js et les échantillons ; sans effet si déjà fait. Les erreurs sont silencieuses (pas de son). */
export function preloadPiano(): Promise<Sampler | null> {
  ready ??= (async () => {
    const T = (Tone ??= await import('tone'))
    const sampler = new T.Sampler({
      urls: sampleUrls(),
      baseUrl: `${import.meta.env.BASE_URL}audio/piano/`,
      release: 1.2,
      volume: -4,
    }).toDestination()
    await T.loaded()
    return sampler
  })()
  ready.catch(() => {
    ready = null // nouvel essai au prochain appel (réseau revenu)
  })
  return ready.catch(() => null)
}

/**
 * Joue une note. À appeler depuis un geste (tap, clic) : le contexte audio y est débloqué
 * (obligatoire sur iOS). Ne fait rien si le son est coupé ou les échantillons pas encore prêts.
 */
export function playPitch(pitch: Pitch, seconds = 1.2): void {
  if (!soundOn.value) return
  if (Tone && Tone.getContext().state !== 'running') void Tone.start()
  void preloadPiano().then((s) => {
    if (!s || !Tone || !soundOn.value) return
    s.triggerAttackRelease(Tone.Frequency(pitchToMidi(pitch), 'midi').toNote(), seconds)
  })
}
