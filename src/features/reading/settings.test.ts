import { beforeEach, describe, expect, it } from 'vitest'
import {
  ALLOWED,
  DEFAULT_SETTINGS,
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
    }
    saveSettings(s)
    expect(localStorage.getItem(KEY)).toContain('"free"')
    expect(loadSettings()).toEqual(s)
  })
  it('valeurs invalides stockées → défauts champ par champ', () => {
    localStorage.setItem(KEY, '{"clefMode":"both","ranges":{"treble":{"low":"F5","high":"E4"}},"maxLeap":99}')
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, clefMode: 'both' })
  })
})

describe('query', () => {
  it('settingsToQuery ne garde que les clés jouées', () => {
    expect(settingsToQuery({ ...DEFAULT_SETTINGS, clefMode: 'treble', maxLeap: 2 })).toEqual({
      clef: 'treble', tl: 'E4', th: 'F5', leap: '2',
    })
    expect(settingsToQuery({ ...both, maxLeap: Infinity })).toEqual({
      clef: 'both', tl: 'E4', th: 'F5', bl: 'G2', bh: 'A3', leap: 'free',
    })
  })
  it('settingsFromQuery', () => {
    expect(settingsFromQuery({ clef: 'both', tl: 'A3', th: 'C6', leap: 'free' }, fb)).toEqual({
      clefMode: 'both',
      ranges: { treble: { low: 'A3', high: 'C6' }, bass: { low: 'G2', high: 'A3' } },
      maxLeap: Infinity,
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
  })
  it('valeur de query en tableau → première valeur', () => {
    expect(settingsFromQuery({ leap: ['3', '4'] }, fb).maxLeap).toBe(3)
  })
})

describe('recordKey / summary', () => {
  it('recordKey', () => {
    expect(recordKey({ ...fb, clefMode: 'treble', maxLeap: 2 })).toBe('treble|E4-F5|2')
    expect(recordKey({ ...fb, clefMode: 'bass', maxLeap: 7 })).toBe('bass|G2-A3|7')
    expect(recordKey({ ...both, maxLeap: Infinity })).toBe('both|E4-F5|G2-A3|free')
  })
  it('summary', () => {
    expect(summary(both)).toBe('Sol Mi4–Fa5 · Fa Sol2–La3 · sauts ≤ tierce')
    expect(summary({ ...both, maxLeap: Infinity })).toBe('Sol Mi4–Fa5 · Fa Sol2–La3 · sauts libres')
    expect(summary({ ...fb, clefMode: 'bass' })).toBe('Fa Sol2–La3 · sauts ≤ tierce')
    expect(summary(both, true)).toBe('Sol Mi4–Fa5 · Fa Sol2–La3 · ≤ tierce')
  })
})
