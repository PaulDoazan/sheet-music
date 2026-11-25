import { beforeEach, describe, expect, it } from 'vitest'
import {
  ALLOWED,
  DEFAULT_SETTINGS,
  DURATION_STEPS,
  durationLabel,
  durationWords,
  isTimed,
  isValidRange,
  loadSettings,
  playedClefs,
  recordKey,
  saveSettings,
  settingsFromQuery,
  settingsToQuery,
  summary,
  type ReadingSettings,
} from './settings'

const KEY = 'sheet-music:last-settings'
const fb = DEFAULT_SETTINGS
const both: ReadingSettings = { ...DEFAULT_SETTINGS, clefMode: 'both' }

beforeEach(() => localStorage.clear())

describe('constantes', () => {
  it('défauts et plages autorisées', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      clefMode: 'treble',
      ranges: { treble: { low: 'E4', high: 'F5' }, bass: { low: 'G2', high: 'A3' } },
      maxLeap: 2,
      duration: 60,
    })
    expect(ALLOWED).toEqual({ treble: { low: 'D3', high: 'G6' }, bass: { low: 'F1', high: 'B4' } })
  })
  it('playedClefs', () => {
    expect(playedClefs('treble')).toEqual(['treble'])
    expect(playedClefs('bass')).toEqual(['bass'])
    expect(playedClefs('both')).toEqual(['treble', 'bass'])
  })
  it('isValidRange', () => {
    expect(isValidRange('treble', { low: 'E4', high: 'F5' })).toBe(true)
    expect(isValidRange('treble', { low: 'D3', high: 'G6' })).toBe(true)
    expect(isValidRange('treble', { low: 'F5', high: 'E4' })).toBe(false)
    expect(isValidRange('treble', { low: 'E4', high: 'E4' })).toBe(false)
    expect(isValidRange('treble', { low: 'C3', high: 'F5' })).toBe(false)
    expect(isValidRange('treble', { low: 'E4', high: 'A6' })).toBe(false)
    expect(isValidRange('bass', { low: 'F1', high: 'B4' })).toBe(true)
    expect(isValidRange('treble', { low: 'F#4', high: 'F5' })).toBe(false)
    expect(isValidRange('treble', { low: 'Z9', high: 'F5' })).toBe(false)
  })
})

describe('loadSettings / saveSettings', () => {
  it('sans rien → défauts', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
  it('ancien format {clef, level} → défauts avec clef conservée', () => {
    localStorage.setItem(KEY, '{"clef":"bass","level":3}')
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, clefMode: 'bass' })
  })
  it('JSON corrompu → défauts', () => {
    localStorage.setItem(KEY, '{')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
  it('aller-retour, y compris maxLeap Infinity', () => {
    const s: ReadingSettings = {
      clefMode: 'both',
      ranges: { treble: { low: 'A3', high: 'C6' }, bass: { low: 'C2', high: 'E4' } },
      maxLeap: Infinity,
      duration: 180,
    }
    saveSettings(s)
    expect(localStorage.getItem(KEY)).toContain('"free"')
    expect(loadSettings()).toEqual(s)
  })
  it('réglages enregistrés avant la durée → 1 min', () => {
    localStorage.setItem(KEY, '{"clefMode":"bass","maxLeap":3}')
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, clefMode: 'bass', maxLeap: 3, duration: 60 })
  })
  it('valeurs invalides stockées → défauts champ par champ', () => {
    localStorage.setItem(KEY, '{"clefMode":"both","ranges":{"treble":{"low":"F5","high":"E4"}},"maxLeap":99,"duration":45}')
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, clefMode: 'both' })
  })
})

describe('query', () => {
  it('settingsToQuery ne garde que les clés jouées', () => {
    expect(settingsToQuery({ ...DEFAULT_SETTINGS, clefMode: 'treble', maxLeap: 2 })).toEqual({
      clef: 'treble', tl: 'E4', th: 'F5', leap: '2', dur: '60',
    })
    expect(settingsToQuery({ ...both, maxLeap: Infinity })).toEqual({
      clef: 'both', tl: 'E4', th: 'F5', bl: 'G2', bh: 'A3', leap: 'free', dur: '60',
    })
  })
  it('settingsFromQuery', () => {
    expect(settingsFromQuery({ clef: 'both', tl: 'A3', th: 'C6', leap: 'free', dur: '300' }, fb)).toEqual({
      clefMode: 'both',
      ranges: { treble: { low: 'A3', high: 'C6' }, bass: { low: 'G2', high: 'A3' } },
      maxLeap: Infinity,
      duration: 300,
    })
  })
  it('ancienne URL ?clef=treble&level=3', () => {
    expect(settingsFromQuery({ clef: 'treble', level: '3' }, fb)).toEqual({ ...fb, clefMode: 'treble' })
  })
  it('paramètres invalides → fallback', () => {
    const bad: Record<string, string>[] = [{ tl: 'Z9' }, { tl: 'F5', th: 'E4' }, { tl: 'C3' }, { tl: 'F#4' }]
    for (const q of bad) {
      expect(settingsFromQuery(q, fb).ranges).toEqual(fb.ranges)
    }
    expect(settingsFromQuery({ leap: '99' }, fb).maxLeap).toBe(fb.maxLeap)
    expect(settingsFromQuery({ leap: '0' }, fb).maxLeap).toBe(fb.maxLeap)
    expect(settingsFromQuery({ clef: 'zzz' }, fb).clefMode).toBe(fb.clefMode)
    expect(settingsFromQuery({ dur: '45' }, fb).duration).toBe(fb.duration)
    expect(settingsFromQuery({ dur: 'abc' }, fb).duration).toBe(fb.duration)
    expect(settingsFromQuery({}, { ...fb, duration: 180 }).duration).toBe(180)
  })
  it('valeur de query en tableau → première valeur', () => {
    expect(settingsFromQuery({ leap: ['3', '4'] }, fb).maxLeap).toBe(3)
  })
})

describe('durée', () => {
  it('crans de 30 s à 5 min', () => {
    expect(DURATION_STEPS).toEqual([30, 60, 90, 120, 150, 180, 210, 240, 270, 300])
  })
  it('libellés courts et en toutes lettres', () => {
    expect([30, 60, 90, 300, Infinity].map(durationLabel)).toEqual(['30 s', '1 min', '1 min 30', '5 min', 'sans limite'])
    expect([30, 60, 90, 120, 270, Infinity].map(durationWords)).toEqual([
      'Trente secondes', 'Une minute', 'Une minute trente', 'Deux minutes', 'Quatre minutes trente', 'Sans limite de temps',
    ])
  })
  it('sans limite : stockage, URL, résumé', () => {
    const s: ReadingSettings = { ...DEFAULT_SETTINGS, duration: Infinity }
    expect(isTimed(s)).toBe(false)
    saveSettings(s)
    expect(JSON.parse(localStorage.getItem(KEY)!).duration).toBe('free')
    expect(loadSettings().duration).toBe(Infinity)
    expect(settingsToQuery(s).dur).toBe('free')
    expect(settingsFromQuery({ dur: 'free' }, fb).duration).toBe(Infinity)
    expect(settingsFromQuery({ dur: '90' }, fb).duration).toBe(90)
    expect(summary(s)).toBe('Sol Mi4–Fa5 · sauts ≤ tierce · sans limite')
  })
})

describe('recordKey / summary', () => {
  it('recordKey', () => {
    expect(recordKey({ ...fb, clefMode: 'treble', maxLeap: 2 })).toBe('treble|E4-F5|2|60s')
    expect(recordKey({ ...fb, clefMode: 'bass', maxLeap: 7, duration: 30 })).toBe('bass|G2-A3|7|30s')
    // 2 min : ancienne clé, les records d'avant la durée réglable restent valables
    expect(recordKey({ ...both, maxLeap: Infinity, duration: 120 })).toBe('both|E4-F5|G2-A3|free')
  })
  it('summary', () => {
    expect(summary(both)).toBe('Sol Mi4–Fa5 · Fa Sol2–La3 · sauts ≤ tierce · 1 min')
    expect(summary({ ...both, maxLeap: Infinity })).toBe('Sol Mi4–Fa5 · Fa Sol2–La3 · sauts libres · 1 min')
    expect(summary({ ...fb, clefMode: 'bass', duration: 30 })).toBe('Fa Sol2–La3 · sauts ≤ tierce · 30 s')
    expect(summary(both, true)).toBe('Sol Mi4–Fa5 · Fa Sol2–La3 · ≤ tierce · 1 min')
  })
})
