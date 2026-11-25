import type { LocationQuery } from 'vue-router'
import { diatonicIndex, parsePitch, SOLFEGE, type Clef, type Pitch } from '@/music/model'
import { MAX_STEP, MIN_STEP, pitchAtStep } from '@/music/render/pitchFromY'

export type ClefMode = 'treble' | 'bass' | 'both'

export const CLEF_MODES: { value: ClefMode; label: string }[] = [
  { value: 'treble', label: 'Clé de Sol' },
  { value: 'bass', label: 'Clé de Fa' },
  { value: 'both', label: 'Sol + Fa' },
]

export function isClefMode(v: unknown): v is ClefMode {
  return v === 'treble' || v === 'bass' || v === 'both'
}

export interface PitchRange {
  /** Notation anglaise sans altération, ex. 'E4'. */
  low: string
  high: string
}

export interface ReadingSettings {
  clefMode: ClefMode
  ranges: Record<Clef, PitchRange>
  /** Saut maximum entre deux notes, en degrés (1 = seconde) ; Infinity = libre. */
  maxLeap: number
  /** Durée d'une partie, en secondes ; Infinity = sans limite (pas de record). */
  duration: number
}

export const DEFAULT_SETTINGS: ReadingSettings = {
  clefMode: 'treble',
  ranges: { treble: { low: 'E4', high: 'F5' }, bass: { low: 'G2', high: 'A3' } },
  maxLeap: 2,
  duration: 60,
}

function fmt(p: Pitch): string {
  return `${p.step}${p.octave}`
}

function allowedFor(clef: Clef): PitchRange {
  return { low: fmt(pitchAtStep(clef, 0, MAX_STEP)), high: fmt(pitchAtStep(clef, 0, MIN_STEP)) }
}

/** Tessiture accessible par clé : D3–G6 en Sol, F1–B4 en Fa. */
export const ALLOWED: Record<Clef, PitchRange> = {
  treble: allowedFor('treble'),
  bass: allowedFor('bass'),
}

const LEAP_NAMES = ['seconde', 'tierce', 'quarte', 'quinte', 'sixte', 'septième', 'octave']

export const LEAP_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '2de' },
  { value: 2, label: '3ce' },
  { value: 3, label: '4te' },
  { value: 4, label: '5te' },
  { value: 5, label: '6te' },
  { value: 6, label: '7e' },
  { value: 7, label: 'Octave' },
  { value: Infinity, label: 'Libre' },
]

/** Crans du curseur de durée : de 30 s à 5 min, toutes les 30 s. */
export const DURATION_STEPS: number[] = Array.from({ length: 10 }, (_, i) => (i + 1) * 30)

function isDuration(v: unknown): v is number {
  return v === Infinity || (typeof v === 'number' && DURATION_STEPS.includes(v))
}

export function isTimed(s: ReadingSettings): boolean {
  return Number.isFinite(s.duration)
}

/** « 30 s », « 1 min », « 1 min 30 », « sans limite ». */
export function durationLabel(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'sans limite'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (!m) return `${s} s`
  return s ? `${m} min ${String(s).padStart(2, '0')}` : `${m} min`
}

const NUMBERS = ['', 'Une', 'Deux', 'Trois', 'Quatre', 'Cinq']
/** En toutes lettres pour le texte du menu : « Une minute trente », « Trente secondes ». */
export function durationWords(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'Sans limite de temps'
  const m = Math.floor(seconds / 60)
  const half = seconds % 60 === 30
  if (!m) return 'Trente secondes'
  return `${NUMBERS[m] ?? m} minute${m > 1 ? 's' : ''}${half ? ' trente' : ''}`
}

function isLeap(v: unknown): v is number {
  return typeof v === 'number' && LEAP_OPTIONS.some((o) => o.value === v)
}

export function playedClefs(mode: ClefMode): Clef[] {
  return mode === 'both' ? ['treble', 'bass'] : [mode]
}

/** Note naturelle valide, sinon null. */
function parseNatural(s: unknown): Pitch | null {
  if (typeof s !== 'string') return null
  try {
    const p = parsePitch(s)
    return p.alter ? null : p
  } catch {
    return null
  }
}

/** Notes naturelles, dans ALLOWED, grave strictement sous l'aiguë. */
export function isValidRange(clef: Clef, r: PitchRange): boolean {
  const low = parseNatural(r.low)
  const high = parseNatural(r.high)
  const min = parseNatural(ALLOWED[clef].low)!
  const max = parseNatural(ALLOWED[clef].high)!
  if (!low || !high) return false
  const l = diatonicIndex(low)
  const h = diatonicIndex(high)
  return l >= diatonicIndex(min) && h <= diatonicIndex(max) && l < h
}

const STORAGE_KEY = 'sheet-music:last-settings'

function cloneDefaults(): ReadingSettings {
  return {
    clefMode: DEFAULT_SETTINGS.clefMode,
    ranges: { treble: { ...DEFAULT_SETTINGS.ranges.treble }, bass: { ...DEFAULT_SETTINGS.ranges.bass } },
    maxLeap: DEFAULT_SETTINGS.maxLeap,
    duration: DEFAULT_SETTINGS.duration,
  }
}

function validRange(clef: Clef, v: unknown, fallback: PitchRange): PitchRange {
  if (v && typeof v === 'object') {
    const { low, high } = v as Record<string, unknown>
    if (typeof low === 'string' && typeof high === 'string' && isValidRange(clef, { low, high })) {
      return { low, high }
    }
  }
  return { ...fallback }
}

/** Derniers réglages ; tolérant (absent, corrompu, ancien format) → défauts champ par champ. */
export function loadSettings(): ReadingSettings {
  const s = cloneDefaults()
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!raw || typeof raw !== 'object') return s
    const o = raw as Record<string, unknown>
    // L'ancien format stockait `clef` ; le nouveau `clefMode`.
    const mode = isClefMode(o.clefMode) ? o.clefMode : o.clef
    if (isClefMode(mode)) s.clefMode = mode
    const ranges = (o.ranges ?? {}) as Record<string, unknown>
    s.ranges.treble = validRange('treble', ranges.treble, s.ranges.treble)
    s.ranges.bass = validRange('bass', ranges.bass, s.ranges.bass)
    const leap = o.maxLeap === 'free' ? Infinity : o.maxLeap
    if (isLeap(leap)) s.maxLeap = leap
    const dur = o.duration === 'free' ? Infinity : o.duration
    if (isDuration(dur)) s.duration = dur
  } catch {
    /* stockage illisible ou corrompu : défauts */
  }
  return s
}

/** Forme stockable : JSON ne sait pas stocker Infinity, on écrit 'free'. */
export function serializeSettings(s: ReadingSettings): Record<string, unknown> {
  const free = (v: number) => (v === Infinity ? 'free' : v)
  return { ...s, maxLeap: free(s.maxLeap), duration: free(s.duration) }
}

export function saveSettings(s: ReadingSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeSettings(s)))
  } catch {
    /* stockage indisponible : on ignore */
  }
}

/** Paramètres d'URL d'une partie : seules les clés jouées. */
export function settingsToQuery(s: ReadingSettings): Record<string, string> {
  const q: Record<string, string> = { clef: s.clefMode }
  const clefs = playedClefs(s.clefMode)
  if (clefs.includes('treble')) {
    q.tl = s.ranges.treble.low
    q.th = s.ranges.treble.high
  }
  if (clefs.includes('bass')) {
    q.bl = s.ranges.bass.low
    q.bh = s.ranges.bass.high
  }
  q.leap = s.maxLeap === Infinity ? 'free' : String(s.maxLeap)
  q.dur = s.duration === Infinity ? 'free' : String(s.duration)
  return q
}

function first(v: LocationQuery[string] | undefined): string | undefined {
  const x = Array.isArray(v) ? v[0] : v
  return typeof x === 'string' ? x : undefined
}

/** Relit une URL ; tout paramètre absent ou invalide est remplacé par `fallback`. */
export function settingsFromQuery(q: LocationQuery, fallback: ReadingSettings): ReadingSettings {
  const clef = first(q.clef)
  const range = (c: Clef, lk: string, hk: string): PitchRange => {
    const low = first(q[lk])
    const high = first(q[hk])
    if (low === undefined && high === undefined) return { ...fallback.ranges[c] }
    const cand = { low: low ?? fallback.ranges[c].low, high: high ?? fallback.ranges[c].high }
    return isValidRange(c, cand) ? cand : { ...fallback.ranges[c] }
  }
  const leapRaw = first(q.leap)
  const leap = leapRaw === 'free' ? Infinity : leapRaw === undefined ? NaN : Number(leapRaw)
  const durRaw = first(q.dur)
  const dur = durRaw === 'free' ? Infinity : Number(durRaw)
  return {
    clefMode: isClefMode(clef) ? clef : fallback.clefMode,
    ranges: { treble: range('treble', 'tl', 'th'), bass: range('bass', 'bl', 'bh') },
    maxLeap: isLeap(leap) ? leap : fallback.maxLeap,
    duration: isDuration(dur) ? dur : fallback.duration,
  }
}

/**
 * Clé de record : mode, tessitures jouées, saut, durée (sans objet en mode sans limite : pas de record).
 * Les parties de 2 min gardent l'ancienne clé (sans durée) : les records d'avant restent valables.
 */
export function recordKey(s: ReadingSettings): string {
  const parts = playedClefs(s.clefMode).map((c) => `${s.ranges[c].low}-${s.ranges[c].high}`)
  const key = [s.clefMode, ...parts, s.maxLeap === Infinity ? 'free' : String(s.maxLeap)]
  if (s.duration !== 120) key.push(`${s.duration}s`)
  return key.join('|')
}

function solfege(p: string): string {
  const { step, octave } = parsePitch(p)
  return `${SOLFEGE[step]}${octave}`
}

/** Résumé lisible ; `short` abrège le saut pour tenir dans un en-tête. */
export function summary(s: ReadingSettings, short = false): string {
  const parts = playedClefs(s.clefMode).map(
    (c) => `${c === 'treble' ? 'Sol' : 'Fa'} ${solfege(s.ranges[c].low)}–${solfege(s.ranges[c].high)}`,
  )
  if (s.maxLeap === Infinity) parts.push(short ? 'libres' : 'sauts libres')
  else parts.push(`${short ? '' : 'sauts '}≤ ${LEAP_NAMES[s.maxLeap - 1]}`)
  parts.push(durationLabel(s.duration))
  return parts.join(' · ')
}
