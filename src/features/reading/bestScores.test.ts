import { beforeEach, describe, expect, it } from 'vitest'
import { getBestScore, readRecords, saveBestScore, writeRecords } from './bestScores'
import { DEFAULT_SETTINGS } from './settings'

describe('bestScores', () => {
  beforeEach(() => localStorage.clear())

  it('sans limite de temps : aucun record lu ni écrit', () => {
    const free = { ...DEFAULT_SETTINGS, duration: Infinity }
    expect(saveBestScore(free, 50)).toBe(false)
    expect(getBestScore(free)).toBe(0)
    expect(readRecords()).toEqual({})
  })

  it('0 par défaut', () => {
    expect(getBestScore(DEFAULT_SETTINGS)).toBe(0)
  })

  it('records indépendants selon le saut', () => {
    const a = { ...DEFAULT_SETTINGS, maxLeap: 2 }
    const b = { ...DEFAULT_SETTINGS, maxLeap: 3 }
    saveBestScore(a, 10)
    expect(getBestScore(a)).toBe(10)
    expect(getBestScore(b)).toBe(0)
    saveBestScore(b, 4)
    expect(getBestScore(a)).toBe(10)
    expect(getBestScore(b)).toBe(4)
  })

  it('renvoie true puis false pour un score égal', () => {
    expect(saveBestScore(DEFAULT_SETTINGS, 5)).toBe(true)
    expect(saveBestScore(DEFAULT_SETTINGS, 5)).toBe(false)
    expect(saveBestScore(DEFAULT_SETTINGS, 3)).toBe(false)
  })

  it("ignore l'ancienne clé best-scores", () => {
    localStorage.setItem('sheet-music:best-scores', JSON.stringify({ 'treble-1': 99 }))
    expect(getBestScore(DEFAULT_SETTINGS)).toBe(0)
    expect(readRecords()).toEqual({})
  })

  it('readRecords / writeRecords font l’aller-retour', () => {
    writeRecords({ x: 3 })
    expect(readRecords()).toEqual({ x: 3 })
    expect(JSON.parse(localStorage.getItem('sheet-music:records-v2')!)).toEqual({ x: 3 })
  })
})
